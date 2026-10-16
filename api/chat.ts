import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SIMILARITY_FLOOR, TOP_K, chat, chatStream, embed, sanitize, sanitizeChunk } from "../src/lib/ai.js";
import { loadCorpus, searchCorpus } from "../src/lib/corpus.js";
import { Receiver, sessionIsComplete, studioEssentials, studioPrompt } from "../src/lib/desk.js";
import { recordSession } from "../src/lib/session.js";
import { scanPrices } from "../src/lib/prices.js";
import type { ChatMessage } from "../src/lib/ai.js";
import type { SessionResultInfo } from "../src/types.js";

/**
 * POST /api/chat  { slug, messages: [{role, content}...] }
 *
 * The studio desk, not a Q&A box. We keep the whole conversation, ground every
 * turn in the studio's committed corpus (RAG), and stream the reply back token
 * by token so it types out like a person. The model is only allowed to read
 * from the notes we hand it, and its output is scrubbed of anything that reads
 * as machine written (em dashes, markdown, lists).
 *
 * Responses are newline-delimited JSON events:
 *   {type:"meta", source}  {type:"delta", text}
 *   {type:"session", session}  {type:"sessioned", session}
 *   {type:"done"}
 *
 * A deterministic guard keeps any reply from quoting a naira figure that is not
 * on the rate card.
 */

const MAX_TURNS = 24;
const MAX_LEN = 800;

function normalizeMessages(body: unknown): ChatMessage[] {
  const b = body as { messages?: unknown; question?: unknown } | null;
  const out: ChatMessage[] = [];
  if (Array.isArray(b?.messages)) {
    for (const raw of (b!.messages as unknown[]).slice(-MAX_TURNS)) {
      const m = raw as { role?: string; content?: string };
      const role: ChatMessage["role"] = m?.role === "assistant" ? "assistant" : "user";
      const content = String(m?.content ?? "").slice(0, MAX_LEN).trim();
      if (content) out.push({ role, content });
    }
  } else if (typeof b?.question === "string" && b.question.trim()) {
    out.push({ role: "user", content: b.question.slice(0, MAX_LEN).trim() });
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body as { slug?: string };
  const slug = body?.slug?.trim().toLowerCase();
  const history = normalizeMessages(req.body);
  if (!slug || history.length === 0) return res.status(400).json({ error: "slug and messages are required" });
  const lastUser = [...history].reverse().find((m) => m.role === "user");

  try {
    const corpus = loadCorpus(slug);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    let facts = studioEssentials(corpus);
    let best = null as { heading: string | null; source_file: string; similarity: number } | null;

    if (corpus.chunks.length <= 16) {
      // Small site: hand the desk every section and skip the embedding call
      // entirely (cheaper, and no per-turn failure point).
      facts += "\n\n" + corpus.chunks.map((c) => `[${c.heading ?? c.source_file}] ${c.text}`).join("\n\n");
      const words = new Set((lastUser?.content ?? "").toLowerCase().match(/[a-z0-9₦]+/g) ?? []);
      let top = corpus.chunks[0];
      let topScore = -1;
      for (const c of corpus.chunks) {
        const hay = (c.text ?? "").toLowerCase();
        const score = [...words].reduce((n, w) => (w.length > 2 && hay.includes(w) ? n + 1 : n), 0);
        if (score > topScore) {
          topScore = score;
          top = c;
        }
      }
      if (top) best = { heading: top.heading, source_file: top.source_file, similarity: 1 };
    } else {
      try {
        const [qVec] = await embed([lastUser?.content ?? ""]);
        const hits = searchCorpus(corpus, qVec, { topK: TOP_K, floor: SIMILARITY_FLOOR });
        if (hits.length) {
          const byId = new Map(corpus.chunks.map((c) => [c.id, c.text]));
          facts += "\n\n" + hits.map((h) => `[${h.heading ?? h.source_file}] ${byId.get(h.id) ?? ""}`).join("\n\n");
          best = { heading: hits[0].heading, source_file: hits[0].source_file, similarity: Number(hits[0].similarity) };
        }
      } catch {
        /* retrieval is best-effort; the desk still works on the essentials */
      }
    }

    const system = studioPrompt(corpus, sanitize(facts), today);
    const messages: ChatMessage[] = [{ role: "system", content: system }, ...history];

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.status(200);
    const send = (obj: unknown) => res.write(JSON.stringify(obj) + "\n");

    send({ type: "meta", source: best });

    const recv = new Receiver();
    let said = "";
    try {
      for await (const delta of chatStream(messages)) {
        const text = recv.push(delta);
        if (text) {
          said += text;
          send({ type: "delta", text: sanitizeChunk(text) });
        }
      }
    } catch {
      const answer = sanitize(await chat(messages));
      if (answer) {
        said += answer;
        send({ type: "delta", text: answer });
      }
    }
    const { text: tail, session } = recv.end();
    if (tail) {
      said += tail;
      send({ type: "delta", text: sanitizeChunk(tail) });
    }

    // Deterministic price guard: no reply may state a naira figure that is not
    // on the rate card. Streaming cannot be rewound, so if one slips through we
    // add an honest correction rather than let it stand.
    if (said.includes("\u20a6")) {
      const scan = scanPrices(said);
      if (scan.unknown.length) {
        const phone = corpus.project.contact?.phone ?? "+234 901 396 2323";
        send({
          type: "delta",
          text: ` Let me confirm that figure with the team before you rely on it. Call or WhatsApp ${phone} and we will give you the exact amount.`,
        });
      }
    }

    // The studio desk collected a session: hand it to the team and show the
    // client a reference plus a one-tap WhatsApp, right here in the chat.
    if (session && sessionIsComplete(session)) {
      try {
        const result = await recordSession({ ...session, slug, host: String(req.headers?.host ?? "") });
        const sessioned: SessionResultInfo = {
          reference: result.reference,
          whatsappUrl: result.whatsappUrl,
          emailed: result.emailed,
          service: result.service,
          location: result.location,
          date: result.date,
          pkg: result.pkg,
        };
        send({ type: "sessioned", session: sessioned });
      } catch {
        send({ type: "session", session });
      }
    } else if (session) {
      send({ type: "session", session });
    }
    send({ type: "done" });
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    if (!res.headersSent) res.status(502).json({ error: `RAG failed: ${msg}` });
    else res.end();
  }
}
