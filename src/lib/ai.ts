import "dotenv/config";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: join(process.cwd(), ".env.local") });

/**
 * AI layer. Providers tried in order, so one vendor's quota cannot take the desk
 * down:
 *
 *   - OpenRouter (openrouter.ai): the default when AI_PROVIDER=openrouter. Uses
 *     the InsForge model gateway key and rotates across OPENROUTER_MODELS on
 *     429/5xx, so a single exhausted model moves to the next one on the same key.
 *   - Gemini (generativelanguage.googleapis.com): chat fallback, and ALWAYS the
 *     embedding provider. Keeps a POOL of models and rotates on 429/503/404.
 *   - NVIDIA NIM (OpenAI-compatible /chat/completions): last resort for chat.
 *
 * Order is set by AI_PROVIDER: "openrouter" (gateway, then Gemini, then NVIDIA),
 * "hybrid" (Gemini then NVIDIA), "nvidia" (NVIDIA then Gemini), or "gemini".
 *
 * Embeddings always use Gemini (validated 3072-dim); no other provider has a
 * role there.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

export const EMBED_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-2";
export const EMBED_DIM = Number(process.env.EMBEDDING_DIM ?? 3072);
export const TOP_K = Number(process.env.TOP_K ?? 4);
export const SIMILARITY_FLOOR = Number(process.env.SIMILARITY_FLOOR ?? 0.25);
export const NVIDIA_CHAT_MODEL = process.env.NVIDIA_CHAT_MODEL ?? "openai/gpt-oss-20b";
/** Reasoning budget for NVIDIA reasoning models (gpt-oss etc). "low" keeps replies fast. */
const NVIDIA_REASONING_EFFORT = (process.env.NVIDIA_REASONING_EFFORT ?? "low").trim();

/**
 * Output cap for every chat call. Deliberately generous: on reasoning models the
 * reasoning tokens count against this budget, so a small cap truncates the
 * visible reply mid-sentence and can drop the trailing [[BOOK:]] / [[SESSION:]]
 * marker. The desk's replies are short, so this is a ceiling, not a target.
 */
const REPLY_TOKENS = 1024;

/**
 * OpenRouter, reached through the InsForge model gateway key (`ai setup`
 * writes it to the env file). This is the preferred provider: one call to a
 * top-tier model instead of hoping a free-tier pool holds up. Models rotate
 * inside the provider on 429/5xx, so a single exhausted model falls through to
 * the next one on the same key before the chain reaches Gemini or NVIDIA.
 */
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-5.5";
export const OPENROUTER_MODELS: string[] = [
  OPENROUTER_MODEL,
  ...(process.env.OPENROUTER_FALLBACKS ? process.env.OPENROUTER_FALLBACKS.split(",").map((s) => s.trim()) : []),
].filter((m, i, a) => m && a.indexOf(m) === i);

/** Ordered pool of Gemini chat models — deduped, primary first. */
export const CHAT_MODELS: string[] = [
  process.env.LLM_MODEL ?? "gemini-3-flash-preview",
  ...(process.env.LLM_MODEL_FALLBACKS ? process.env.LLM_MODEL_FALLBACKS.split(",").map((s) => s.trim()) : []),
].filter((m, i, a) => m && a.indexOf(m) === i);

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function nvidiaConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function openrouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Providers to try, in order, per AI_PROVIDER. Unconfigured ones are skipped. */
function providerOrder(): Array<"openrouter" | "gemini" | "nvidia"> {
  const p = (process.env.AI_PROVIDER ?? "hybrid").toLowerCase();
  const rest: Array<"gemini" | "nvidia"> =
    p === "nvidia" ? ["nvidia", "gemini"] : p === "gemini" ? ["gemini"] : ["gemini", "nvidia"];
  const preferred: Array<"openrouter" | "gemini" | "nvidia"> =
    p === "openrouter" ? ["openrouter", ...rest] : rest;
  const guarded = (x: "openrouter" | "gemini" | "nvidia") =>
    x === "openrouter" ? openrouterConfigured() : x === "gemini" ? geminiConfigured() : nvidiaConfigured();
  return preferred.filter(guarded);
}

// ── Gemini ────────────────────────────────────────────────────────────────────

/** Split a message list into a Gemini systemInstruction + contents (roles mapped). */
function toGemini(messages: ChatMessage[]) {
  const sys = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  return { sys, contents };
}

function buildBody(sys: string, contents: unknown, temperature: number, maxTokens: number, thinking: boolean) {
  return {
    ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(thinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };
}

async function callGemini(model: string, action: string, body: unknown, timeoutMs: number, extraQuery = ""): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY required");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const q = extraQuery ? `?${extraQuery}&key=${key}` : `?key=${key}`;
    return await fetch(`${GEMINI_BASE}/models/${model}:${action}${q}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strip anything that reads as "AI wrote this": em/en dashes become commas,
 * markdown emphasis and bullets are removed, and the whole reply is collapsed
 * into one clean paragraph. Used on model output AND on facts fed to the model.
 */
export function sanitize(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/[\u2012\u2013\u2014\u2015]/g, ", ")
    .replace(/[*`#>_]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/^[\s,]+/, "")
    .trim();
}

/** Same clean-up for a live stream: never trims, so words cannot glue together. */
export function sanitizeChunk(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/[\u2012\u2013\u2014\u2015]/g, ", ")
    .replace(/[*`#>_]/g, "")
    .replace(/[ \t]{2,}/g, " ");
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY required");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${EMBED_MODEL}:batchEmbedContents?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] } })),
      }),
      signal: ctrl.signal,
    });
    const json = await res.json();
    const vecs = json?.embeddings as { values: number[] }[] | undefined;
    if (!Array.isArray(vecs)) {
      throw new Error(`Gemini embed failed (${res.status}): ${json?.error?.message ?? "no embeddings"}`);
    }
    return vecs.map((e) => vecs && e.values);
  } finally {
    clearTimeout(timer);
  }
}

/** Non-streaming Gemini chat with model rotation and a thinking-less retry on 400. */
async function geminiChat(messages: ChatMessage[]): Promise<string> {
  const { sys, contents } = toGemini(messages);
  for (const model of CHAT_MODELS) {
    for (const thinking of [true, false]) {
      try {
        const res = await callGemini(model, "generateContent", buildBody(sys, contents, 0.6, REPLY_TOKENS, thinking), 45000);
        if (res.status === 400 && thinking) continue; // model rejects thinkingConfig → retry without
        if (res.status === 404 || res.status === 429 || res.status === 503) break; // next model
        const json = await res.json();
        const text = (json?.candidates?.[0]?.content?.parts ?? [])
          .map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim();
        if (res.status === 200 && text) return text;
        break;
      } catch {
        break;
      }
    }
  }
  throw new Error("all gemini chat models unavailable");
}

/**
 * Streaming Gemini chat (SSE). Yields raw text deltas so the desk can type the
 * reply out like a person.
 */
async function* geminiChatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const { sys, contents } = toGemini(messages);
  let lastErr: unknown = null;
  for (const model of CHAT_MODELS) {
    for (const thinking of [true, false]) {
      let res: Response;
      try {
        res = await callGemini(model, "streamGenerateContent", buildBody(sys, contents, 0.7, REPLY_TOKENS, thinking), 60000, "alt=sse");
      } catch (err) {
        lastErr = err;
        break;
      }
      if (!res.ok || !res.body) {
        lastErr = new Error(`stream ${model} ${res.status}`);
        if (res.status === 400 && thinking) continue;
        break;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (!payload) continue;
            try {
              const j = JSON.parse(payload);
              const text = (j?.candidates?.[0]?.content?.parts ?? [])
                .map((p: { text?: string }) => p.text ?? "")
                .join("");
              if (text) yield text;
            } catch {
              /* partial frame; ignore */
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      return;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all gemini streaming models unavailable");
}

// ── NVIDIA NIM (OpenAI-compatible) ─────────────────────────────────────────────

function nvidiaBody(messages: ChatMessage[], temperature: number, maxTokens: number, stream: boolean) {
  return JSON.stringify({
    model: NVIDIA_CHAT_MODEL,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
    ...(NVIDIA_REASONING_EFFORT ? { reasoning_effort: NVIDIA_REASONING_EFFORT } : {}),
    ...(stream ? { stream: true } : {}),
  });
}

/** Non-streaming NVIDIA NIM chat. */
async function nvidiaChat(messages: ChatMessage[]): Promise<string> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY required");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: nvidiaBody(messages, 0.6, REPLY_TOKENS, false),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
    const text = json?.choices?.[0]?.message?.content;
    if (!res.ok || !text) {
      throw new Error(`NVIDIA chat failed (${res.status}): ${json?.error?.message ?? "no content"}`);
    }
    return String(text).trim();
  } finally {
    clearTimeout(timer);
  }
}

/** Streaming NVIDIA NIM chat (OpenAI SSE: `data: {...}` frames, `[DONE]` terminator). */
async function* nvidiaChatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY required");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: nvidiaBody(messages, 0.7, REPLY_TOKENS, true),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`NVIDIA stream failed (${res.status})`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
            const text = j?.choices?.[0]?.delta?.content;
            if (text) yield text;
          } catch {
            /* partial frame; ignore */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── OpenRouter (InsForge model gateway) ───────────────────────────────────────

/** Flatten OpenAI-style content that some models return as an array of parts. */
function contentText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map((p) => (typeof p === "string" ? p : (p as { text?: string })?.text ?? "")).join("");
  return "";
}

function openrouterBody(model: string, messages: ChatMessage[], temperature: number, maxTokens: number, stream: boolean) {
  return JSON.stringify({
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
    ...(stream ? { stream: true } : {}),
  });
}

/** Non-streaming OpenRouter chat, rotating across models on one gateway key. */
async function openrouterChat(messages: ChatMessage[]): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY required");
  let last: unknown = null;
  for (const model of OPENROUTER_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: openrouterBody(model, messages, 0.6, REPLY_TOKENS, false),
        signal: ctrl.signal,
      });
      const json = (await res.json().catch(() => null)) as {
        choices?: { message?: { content?: unknown } }[];
        error?: { message?: string };
      } | null;
      const text = contentText(json?.choices?.[0]?.message?.content).trim();
      if (res.ok && text) return text;
      last = new Error(`openrouter ${model} ${res.status}: ${json?.error?.message ?? "no content"}`);
    } catch (err) {
      last = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last instanceof Error ? last : new Error("all openrouter models unavailable");
}

/** Streaming OpenRouter chat (OpenAI SSE: `data: {...}` frames, `[DONE]`). */
async function* openrouterChatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY required");
  let last: unknown = null;
  for (const model of OPENROUTER_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    let res: Response;
    try {
      res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: openrouterBody(model, messages, 0.7, REPLY_TOKENS, true),
        signal: ctrl.signal,
      });
    } catch (err) {
      last = err;
      clearTimeout(timer);
      continue;
    }
    if (!res.ok || !res.body) {
      last = new Error(`openrouter stream ${model} ${res.status}`);
      clearTimeout(timer);
      continue;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let yielded = false;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload) as { choices?: { delta?: { content?: unknown } }[] };
            const text = contentText(j?.choices?.[0]?.delta?.content);
            if (text) {
              yielded = true;
              yield text;
            }
          } catch {
            /* partial frame; ignore */
          }
        }
      }
    } finally {
      reader.releaseLock();
      clearTimeout(timer);
    }
    // Model answered: stop rotating. An empty stream just means try the next model.
    if (yielded) return;
    last = new Error(`openrouter stream ${model} produced no content`);
  }
  throw last instanceof Error ? last : new Error("all openrouter streaming models unavailable");
}

// ── Public chat entry points (provider chain) ─────────────────────────────────

/** Non-streaming chat: try each configured provider in order, first success wins. */
export async function chat(messages: ChatMessage[]): Promise<string> {
  let lastErr: unknown = null;
  for (const provider of providerOrder()) {
    try {
      if (provider === "openrouter") return await openrouterChat(messages);
      return provider === "nvidia" ? await nvidiaChat(messages) : await geminiChat(messages);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all chat providers unavailable");
}

/**
 * Streaming chat across providers. Falls over to the next provider only if the
 * current one fails BEFORE it has yielded anything; a mid-stream failure is
 * rethrown so the guest never sees two half-replies stitched together.
 */
export async function* chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  let lastErr: unknown = null;
  for (const provider of providerOrder()) {
    const stream =
      provider === "openrouter" ? openrouterChatStream(messages) : provider === "nvidia" ? nvidiaChatStream(messages) : geminiChatStream(messages);
    let yielded = false;
    try {
      for await (const chunk of stream) {
        yielded = true;
        yield chunk;
      }
      if (yielded) return;
    } catch (err) {
      lastErr = err;
      if (yielded) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all streaming providers unavailable");
}
