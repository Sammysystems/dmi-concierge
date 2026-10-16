# Onboarding a new studio

Adding a studio is a **config + content** job, not a rewrite. Everything a studio needs lives in one folder under `src/content/<slug>/`, plus its imagery under `public/images/<slug>/`. The engine in `src/`, `api/` and `server.local.ts` reads that config and serves it at `/p/<slug>`.

The shipped studio is `dmi`. Use it as the template.

---

## 1. Create the content folder

```bash
mkdir src/content/<slug>
mkdir public/images/<slug>
```

Copy the DMI shape as a starting point:

```bash
cp -r src/content/dmi/* src/content/<slug>/
```

`<slug>` is lowercase, hyphen-friendly (`[a-z0-9-_]`). It is the studio's identity everywhere: `/p/<slug>`, `/api/public/<slug>`, `data-desk-slug="<slug>"`.

## 2. Write the profile — `src/content/<slug>/project.json`

This is the studio's identity and everything the page renders. Required keys:

| Key | Purpose |
| --- | --- |
| `slug` | Must match the folder name |
| `listed` | `false` hides it from the directory at `/` |
| `vertical` | `"studio"` |
| `name`, `kind`, `initial`, `domain` | Identity + the avatar letter |
| `brand` | `primary`, `surface`, `text`, `accent`, `bodyFont`, `headingFont` (hex colours; fonts are Google font names) |
| `contact` | `phone`, `email`, `address`, `hours`, `whatsapp` (digits only) |
| `geo` | `city`, `state`, `country`, `timezone`, `currency`, `locale` |
| `hero` | `image`, `badge` |
| `widget` | `title`, `greeting`, `suggestions[]` — the desk's opening copy |
| `booking` | External booking URL for the "Book Now" actions |
| `replica` | `hero`, `services[]`, `about`, `tagline`, `layout`, `logo` |
| `studio` | `tagline`, `founder`, `services[]`, `locations[]`, `gallery[]`, `testimonials[]`, `academy`, `social[]` |
| `gallery` | Image paths for the page grid |

`rooms: []` is a legacy key; leave it empty.

All image paths are absolute from the site root, e.g. `/images/<slug>/hero.jpg`.

## 3. Write the corpus — `src/content/<slug>/*.md`

These markdown files are the **only** facts the desk may answer from. Ingest sections each file on `#`, `##` and `###` headings, and every section becomes one retrievable chunk.

Keep the DMI naming so they read in order:

```
01-overview.md              who they are, where, the promise
02-services.md              what they offer, at a glance
03-portraits.md             portrait detail
04-weddings.md              wedding packages and coverage
05-studio-space.md          the physical space
06-academy.md               the training programme
07-location-and-contact.md  addresses, hours, how to reach them
08-booking-and-policy.md    how booking works, deposits, turnaround
questions.md                a script of the questions guests actually ask (not ingested; a smoke-test list)
```

Write plainly, one fact per sentence. The desk answers in the studio's voice, so the cleaner the notes, the better the answers. **Do not put prices in the markdown** — money lives in the rate card (step 5).

## 4. Add imagery

Drop the studio's photos into `public/images/<slug>/`, then reference them from `project.json` (`hero.image`, `replica.logo`, `studio.founder.image`, `studio.gallery[]`, `testimonials[].image`, `gallery[]`).

## 5. ⚠️ The rate card — `src/lib/prices.ts`

Prices are **not** in the content folder. They live in code at `src/lib/prices.ts`, which is the single source of truth the guard checks every `₦` figure against.

> **The rate card is currently DMI-specific.** A new studio with different prices needs its own rate card — the guard in `allowedAmounts()` only knows DMI's numbers. Either:
> - parameterise `prices.ts` by slug (add a per-studio rate card), or
> - accept that the new studio will refuse/flag any amount not in DMI's list.
>
> Do not ship a second studio on DMI's rate card without deciding this.

Every amount the desk is allowed to say must appear in `allowedAmounts()`. If it isn't there, the guard will flag it and the desk will tell the guest to confirm with the team.

## 6. Ingest the knowledge base

```bash
npm run ingest -- <slug>        # needs GEMINI_API_KEY; writes src/data/<slug>.json
```

This embeds every content section and writes the committed corpus. Re-run it whenever the markdown changes. If you only changed `project.json` (not the markdown), use the fast path instead:

```bash
npm run profile -- <slug>       # copies the profile across, keeps the embeddings
```

## 7. Verify locally

```bash
npm run build
npm run serve
```

Then check:

- `http://localhost:3000/api/public/<slug>` — returns the profile
- `http://localhost:3000/p/<slug>` — the studio's page with the desk
- `http://localhost:3000/embed/<slug>` — the bare desk panel
- `npm run e2e` — the end-to-end suite (expects `npm run serve` running)

## 8. Embed it on the studio's own site

Point the loader at the new slug:

```html
<script src="https://<desk-host>/embed.js" data-desk-slug="<slug>" defer></script>
```

See [`EMBED.md`](./EMBED.md) for the full option set (own button, position, colour).

## 9. Ship

Deploy to the desk host (see README → Deployment), set `PROPERTY_SLUG` if this deploy should default to the new studio, and paste the snippet on the client's site.

---

## Checklist

- [ ] `src/content/<slug>/project.json` filled in (identity, brand, contact, geo, hero, widget, booking, replica, studio)
- [ ] `src/content/<slug>/*.md` written, one fact per line, **no prices in prose**
- [ ] Images in `public/images/<slug>/`, referenced from `project.json`
- [ ] Rate card decided in `src/lib/prices.ts` (see the warning in step 5)
- [ ] `npm run ingest -- <slug>` run; `src/data/<slug>.json` committed
- [ ] `npm run build` + `npm run lint` green
- [ ] `/api/public/<slug>`, `/p/<slug>`, `/embed/<slug>` all load
- [ ] `npm run e2e` passes
- [ ] Embed snippet added to the client's site with the right `data-desk-slug`

## Gotchas

- **Embedding dimension drift.** The corpus is embedded at one dimension (`EMBEDDING_DIM`, 3072). Changing the embedding model/dimension without re-ingesting every studio will break retrieval. Re-ingest if you change it.
- **Prices are code, not content.** A new price in the markdown will be flagged by the guard and corrected. Add it to `prices.ts`.
- **`MAIL_OVERRIDE_TO`.** While it is set, every mail redirects to one inbox. Unset it (and verify a sending domain in Resend) before real guests use the desk.
- **`questions.md` is a helper**, not corpus — ingest skips it.
- **Re-ingest, don't hand-edit** `src/data/<slug>.json`. It is generated; edits will be overwritten.
