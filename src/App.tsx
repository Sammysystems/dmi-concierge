import { useEffect, useState } from "react";
import ReplicaPage from "./components/ReplicaPage";
import EmbedDesk from "./components/EmbedDesk";

interface Studio {
  slug: string;
  name: string;
  vertical: string;
  kind: string;
  city: string;
  state: string;
  brand: { primary: string; surface: string; text: string };
  initial: string;
}

export default function App() {
  const path = window.location.pathname;

  // The bare desk panel, loaded inside the embed iframe.
  const embed = path.match(/^\/embed\/([a-z0-9-_]+)/i);
  if (embed) return <EmbedDesk slug={embed[1].toLowerCase()} />;

  // The studio's own site, with the studio desk on top.
  const m = path.match(/^\/p\/([a-z0-9-_]+)/i);
  if (m) return <ReplicaPage slug={m[1].toLowerCase()} />;

  return <Landing />;
}

function Landing() {
  const [studios, setStudios] = useState<Studio[] | null>(null);

  useEffect(() => {
    fetch("/api/public")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { studios?: Studio[]; hotels?: Studio[] }) => setStudios(d.studios ?? d.hotels ?? []))
      .catch(() => setStudios([]));
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-[#0f0f0f] px-6 py-16 text-white">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e40014] text-xl font-black text-white">
            D
          </span>
          <h1 className="mt-4 text-2xl font-extrabold">Studio Desk</h1>
          <p className="mt-2 text-sm text-white/60">
            An instant concierge for the studio: grounded answers from its published rate card and service
            information, plus a session request that hands off with a reference and WhatsApp.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {(studios ?? []).map((h) => (
            <a
              key={h.slug}
              href={`/p/${h.slug}`}
              className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full font-black text-white" style={{ background: h.brand?.primary ?? "#e40014" }}>
                {h.initial}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{h.name}</span>
                <span className="block truncate text-[11px] text-white/50">
                  {[h.kind, [h.city, h.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "Open the studio desk"}
                </span>
              </span>
            </a>
          ))}
          {studios && studios.length === 0 ? (
            <p className="col-span-full text-center text-sm text-white/40">No studios are live yet.</p>
          ) : null}
          {!studios ? <p className="col-span-full text-center text-sm text-white/30">Loading…</p> : null}
        </div>
      </div>
    </div>
  );
}
