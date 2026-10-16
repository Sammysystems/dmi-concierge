import { useEffect, useRef, useState } from "react";
import { Aperture, CheckCircle2, MessageCircle, Send, X } from "lucide-react";
import type { ChatResponse, ChatStreamEvent, SessionResultInfo } from "../types";

interface Props {
  slug: string;
  brand?: { primary: string; surface: string; text: string; accent?: string; bodyFont?: string; headingFont?: string };
  title?: string;
  whatsapp?: string;
  greeting?: string;
  suggestions?: string[];
  phone?: string;
  bodyFont?: string;
  headingFont?: string;
  /** Where the "Book Now" pill in a captured-session card sends the client. */
  bookingUrl?: string;
  /**
   * Embed mode: render the desk as a panel that fills its container (used inside
   * the embed iframe). No floating launcher, always open, and the close button
   * tells the parent page to hide the iframe instead of collapsing in place.
   */
  embedded?: boolean;
}

interface Msg {
  role: "user" | "assistant";
  text: string;
  source?: ChatResponse["source"];
  sessioned?: SessionResultInfo;
  pending?: boolean;
}

const DEFAULT_GREETING =
  "Hi, welcome to DarlMac Impression. Are you booking a session, asking about a package, or looking at the studio or the academy?";

const DEFAULT_SUGGESTIONS = [
  "How much is a portrait session?",
  "Tell me about your wedding packages",
  "I want to rent the studio space",
  "What is the photography academy about?",
];

/**
 * The studio desk. One job: talk like a receptionist, then hand the client a
 * reference and a one-tap WhatsApp once the request is captured. There is no
 * second tab on purpose, because for a studio the chat IS the booking form.
 */
export default function StudioDeskWidget({ slug, brand, title, greeting, suggestions, bodyFont, headingFont, bookingUrl, embedded = false }: Props) {
  const primary = brand?.primary ?? "#e40014";
  const surface = brand?.surface ?? "#0f0f0f";
  const bodyStack = bodyFont ? `"${bodyFont}", system-ui, sans-serif` : undefined;
  const headingStack = headingFont ? `"${headingFont}", system-ui, sans-serif` : undefined;
  const greetingText = greeting ?? DEFAULT_GREETING;
  const suggestionList = suggestions?.length ? suggestions : DEFAULT_SUGGESTIONS;

  const [open, setOpen] = useState(embedded);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", text: greetingText }]);
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // Any "Book a session" button on the page opens the desk.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(`${slug}:session`, onOpen);
    return () => window.removeEventListener(`${slug}:session`, onOpen);
  }, [slug]);

  // Embedded in an iframe: tell the parent we're up, and let it ask us to focus.
  useEffect(() => {
    if (!embedded) return;
    window.parent?.postMessage({ type: "dmi:ready", slug }, "*");
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "dmi:open") document.querySelector<HTMLInputElement>('[aria-label="Type your message"]')?.focus();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedded, slug]);

  // Close: embedded -> ask the parent to hide the iframe; page mode -> collapse.
  const requestClose = () => {
    if (embedded) {
      window.parent?.postMessage({ type: "dmi:close", slug }, "*");
      return;
    }
    setOpen(false);
  };

  const patchLast = (patch: Partial<Msg>) =>
    setMessages((prev) => {
      const i = prev.length - 1;
      if (i < 0) return prev;
      const next = prev.slice();
      next[i] = { ...prev[i], ...patch };
      return next;
    });

  async function send(text: string) {
    const q = text.trim();
    if (!q) return;
    const turns: Msg[] = [...messages, { role: "user", text: q }];
    setMessages([...turns, { role: "assistant", text: "", pending: true }]);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, messages: turns.map((m) => ({ role: m.role, content: m.text })) }),
      });
      const isStream = !!res.body && (res.headers.get("content-type") ?? "").includes("ndjson");
      if (!res.ok || !isStream) {
        const data = (await res.json()) as ChatResponse;
        patchLast({ text: data.answer || "Sorry, I did not catch that.", source: data.source, pending: false });
        return;
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          let evt: ChatStreamEvent;
          try {
            evt = JSON.parse(t) as ChatStreamEvent;
          } catch {
            continue;
          }
          if (evt.type === "meta") patchLast({ source: evt.source });
          else if (evt.type === "delta")
            setMessages((prev) => {
              const i = prev.length - 1;
              if (i < 0) return prev;
              const next = prev.slice();
              next[i] = { ...prev[i], text: prev[i].text + evt.text };
              return next;
            });
          else if (evt.type === "sessioned") patchLast({ sessioned: evt.session, pending: false });
          else if (evt.type === "done") patchLast({ pending: false });
        }
      }
    } catch {
      patchLast({ text: "Sorry, I lost you for a second there. Could you say that again?", pending: false });
    } finally {
      patchLast({ pending: false });
    }
  }

  const busyStreaming = messages[messages.length - 1]?.pending === true;
  const showPanel = embedded || open;
  const panelClass = embedded
    ? "flex h-full w-full flex-col overflow-hidden"
    : "fixed bottom-24 right-5 z-50 flex h-[min(620px,82vh)] w-[min(390px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10";

  return (
    <>
      {showPanel && (
        <div
          className={panelClass}
          style={{ background: surface, fontFamily: bodyStack }}
          role="dialog"
          aria-label={title ?? "DMI Studio Desk"}
        >
          {/* header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full text-white" style={{ background: primary }}>
                <Aperture className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight text-white" style={{ fontFamily: headingStack, letterSpacing: "0.04em" }}>
                  {title ?? "DMI Studio Desk"}
                </p>
                <p className="text-[11px] leading-tight text-white/50">At your service, live</p>
              </div>
            </div>
            <button onClick={requestClose} aria-label="Close" className="rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white">
              <X className="size-5" />
            </button>
          </div>

          {/* transcript */}
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "rounded-br-sm text-white" : "rounded-bl-sm bg-white/10 text-white/90 ring-1 ring-white/10"}`}
                    style={m.role === "user" ? { background: primary } : undefined}
                  >
                    {m.role === "assistant" && m.pending && !m.text ? (
                      <TypingDots />
                    ) : (
                      <span className="whitespace-pre-wrap">{m.text}</span>
                    )}
                    {m.role === "assistant" && m.pending && m.text ? (
                      <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse align-middle" style={{ background: primary }} />
                    ) : null}
                  </div>

                  {m.sessioned ? <SessionCard s={m.sessioned} primary={primary} bookingUrl={bookingUrl} /> : null}

                  {m.role === "assistant" && m.source && m.text ? (
                    <p className="mt-1 pl-1 text-[10px] text-white/30">from {m.source.heading ?? m.source.source_file}</p>
                  ) : null}
                </div>
              </div>
            ))}

            {messages.length === 1 ? (
              <div className="flex flex-col gap-2 pt-1">
                {suggestionList.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-2xl bg-white/10 px-3 py-2 text-left text-xs text-white/85 ring-1 ring-white/10 transition hover:bg-white/15"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* composer */}
          <form className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about sessions, packages, studio…"
              className="min-w-0 flex-1 rounded-full bg-white/8 px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none transition focus:ring-2 focus:ring-white/20"
              aria-label="Type your message"
              disabled={busyStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || busyStreaming}
              aria-label="Send"
              className="flex size-9 items-center justify-center rounded-full text-white transition disabled:opacity-40"
              style={{ background: primary }}
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}

      {!embedded ? (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close studio desk" : "Open studio desk"}
          className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105"
          style={{ background: primary }}
        >
          {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        </button>
      ) : null}
    </>
  );
}

function SessionCard({ s, primary, bookingUrl }: { s: SessionResultInfo; primary: string; bookingUrl?: string }) {
  const line = [s.service, s.location, s.date].filter(Boolean).join(" · ");
  return (
    <div className="mt-2 rounded-2xl border border-white/15 bg-black p-3 text-left text-white shadow-lg">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4" style={{ color: primary }} />
        <p className="text-sm font-semibold">Session request received</p>
      </div>
      <p className="mt-1 text-xs text-white/70">
        Your reference is
        <span className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] font-bold text-white">{s.reference}</span>
        . Quote it when you contact us.
      </p>
      {line ? <p className="mt-1 text-[11px] text-white/55">{line}</p> : null}
      <p className="mt-2 text-[11px] text-white/55">Our team confirms the date and the total shortly. No payment is taken here.</p>
      <a
        href={s.whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-black transition hover:brightness-95"
        style={{ background: "#25D366" }}
      >
        Message us on WhatsApp
      </a>
      {bookingUrl ? (
        <a
          href={bookingUrl}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
        >
          Book Now
        </a>
      ) : null}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounce rounded-full bg-white/50" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}
