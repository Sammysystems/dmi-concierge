# DMI Studio Desk

An embeddable concierge desk for **DarlMac Impression** (DMI) — a Nigerian photography studio working out of Uyo, Lagos and Abuja — plus the studio's own one-page site. One deployment serves both.

- **Grounded answers.** Every reply is built from the studio's own published facts (its rate card and service notes). The model is told to answer *only* from them.
- **A price guard.** `src/lib/prices.ts` is the single source of truth for money. Any reply that states a naira figure not on the rate card is caught and corrected before it stands.
- **A real hand-off.** A finished request captures the guest's name, phone and a compulsory email, mints a reference (`DMI-XXXXXX`), emails the studio and the guest, and offers a one-tap WhatsApp.
- **No database.** The knowledge base is a committed JSON file (`src/data/<slug>.json`). The app only reads.

## Two ways it ships

| Surface | URL | What it is |
| --- | --- | --- |
| Studio site | `/p/dmi` | The studio's homepage with the desk docked on it |
| Bare desk | `/embed/dmi` | The desk alone, rendered inside the embed iframe |
| Embed loader | `/embed.js` | The one-line script the client pastes onto their own site |
| Directory | `/` | Landing page listing every shipped studio |

- Full embed guide: [`EMBED.md`](./EMBED.md)
- Onboarding another studio: [`ONBOARDING.md`](./ONBOARDING.md)

## Stack

| Layer | Choice |
| --- | --- |
| Front-end | React 19 + Vite + Tailwind 4 |
| Server | Vercel serverless functions in `api/` (Node) |
| Chat | OpenRouter → Gemini → NVIDIA NIM (first configured wins; `AI_PROVIDER` sets the order) |
| Embeddings | Gemini (`gemini-embedding-2`, 3072-dim) — always |
| Email | Resend HTTP API (no SDK, no SMTP) |
| Knowledge | Committed JSON corpus — no live database |

## Quick start

```bash
# 1. Env
cp .env.example .env.local      # then fill in the keys

# 2. Install
npm install

# 3. Build the knowledge base (needs GEMINI_API_KEY)
npm run ingest -- dmi           # only needed when the content changes

# 4. Build + run the full stack
npm run build
npm run serve                   # http://localhost:3000
```

`npm run serve` (a tiny `server.local.ts`) serves the built `dist/` **and** the `api/` routes on one port, so `/p/dmi`, `/embed/dmi`, `/embed.js` and `/api/*` all work locally.

For UI-only work, `npm run dev` (Vite) is faster, but it does **not** serve the `api/` routes — API calls need `npm run serve`.

## Environment

Everything lives in `.env.local` (copy from `.env.example`).

**AI**
- `AI_PROVIDER` — `openrouter` | `hybrid` | `nvidia` | `gemini` (default `hybrid` = Gemini, then NVIDIA)
- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `OPENROUTER_FALLBACKS` — optional premium provider (via the InsForge model gateway)
- `GEMINI_API_KEY` — chat fallback **and** the only embedding provider (required for ingest)
- `NVIDIA_API_KEY` / `NVIDIA_CHAT_MODEL` / `NVIDIA_BASE_URL` — optional last-resort chat
- `LLM_MODEL` / `LLM_MODEL_FALLBACKS` — Gemini chat models
- `EMBEDDING_MODEL` / `EMBEDDING_DIM` — must stay in sync with the ingested corpus

**RAG** — `TOP_K` (default 4), `SIMILARITY_FLOOR` (default 0.25)

**Studio** — `PROPERTY_SLUG` (default `dmi`), `WHATSAPP_NUMBER` (fallback number when a profile omits one)

**Email (Resend)** — `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAIL`, and `MAIL_OVERRIDE_TO` (redirect every mail to one inbox while the sending domain is unverified; the true recipient is named in the body)

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server (UI only) |
| `npm run build` | `tsc --noEmit` + `vite build` → `dist/` |
| `npm run serve` | Local full stack on :3000 (static `dist/` + `api/`) |
| `npm run lint` | `tsc --noEmit` (typecheck) |
| `npm run typecheck` | Alias of lint |
| `npm run ingest -- <slug>` | Read `src/content/<slug>/`, embed every section → `src/data/<slug>.json` |
| `npm run profile -- <slug>` | Copy `project.json` into the committed corpus without re-embedding |
| `npm run e2e` | End-to-end suite (expects a running `npm run serve`) |
| `npm run preview` | Vite preview of the build |

## Project layout

```
api/                     Vercel serverless routes
  chat.ts                POST /api/chat — RAG + stream + price guard + session
  public/index.ts        GET  /api/public — studio directory
  public/[slug].ts       GET  /api/public/:slug — one studio profile
src/
  App.tsx                Routes: /  ·  /p/:slug  ·  /embed/:slug
  components/
    StudioPage.tsx       The studio's own site
    ReplicaPage.tsx      Loads the profile, renders StudioPage
    StudioDeskWidget.tsx The chat widget (also used as the embedded panel)
    EmbedDesk.tsx        Bare desk, inside the embed iframe
  lib/
    ai.ts                Providers, streaming, sanitize
    corpus.ts            Load + search the committed corpus
    desk.ts              Studio prompt, essentials, session rules
    prices.ts            Rate card + price guard (the single source of truth for ₦)
    session.ts           Reference, WhatsApp link, email sending
    email.ts             Resend layer + mail templates
    brandFont.ts         Brand font loader
  content/<slug>/        Authoring source (project.json + NN-*.md)
  data/<slug>.json       Committed corpus the API serves
public/
  embed.js               The one-line embed loader
  images/<slug>/         Studio imagery
server.local.ts          Local full-stack server
```

## How it works

1. **Ground** — the latest user message is embedded (Gemini) and matched against the studio corpus (`TOP_K`, `SIMILARITY_FLOOR`). Small sites (≤ 16 chunks) skip embedding entirely and hand the desk every section.
2. **Prompt** — the matched facts plus `studioEssentials` (identity, contact, today's date in Africa/Lagos) become the system prompt; the model may answer *only* from them.
3. **Stream** — the reply streams back as newline-delimited JSON events (`meta` → `delta`* → `session`/`sessioned` → `done`) and each chunk is scrubbed of anything that reads machine-written (em dashes, markdown, lists).
4. **Guard** — every `₦` figure in the finished reply is checked against `allowedAmounts()`. Any amount not on the rate card triggers an honest "let me confirm that figure with the team" correction.
5. **Hand off** — a complete session (name + phone + valid email) mints `DMI-XXXXXX`, emails the studio and the guest, and returns a WhatsApp link.

## Deployment

The app targets Vercel (`vercel.json`): static `dist/` + the `api/` functions. Set the same env vars in the Vercel project, then point the embed host (e.g. `desk.dmi.com.ng`) at the deployment. `EMBED.md` covers hosting and the paste-in snippet.

## Notes

- **Money never comes from the model.** Add every new price to `src/lib/prices.ts`; that is the set the guard checks against.
- **Re-ingest after content edits** — `npm run ingest -- <slug>`. Use `npm run profile -- <slug>` when only the profile changed (skips re-embedding).
- `src/data/<slug>.json` is committed on purpose: it is the deterministic knowledge base the API serves.
- `MAIL_OVERRIDE_TO` keeps demos honest — mail is redirected, never faked. Leave it unset in production once a sending domain is verified.

## License

The engine is MIT (see `LICENSE`). The studio's content, rate card and imagery remain the property of DarlMac Impression and are not covered by it.
