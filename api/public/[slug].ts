import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadCorpus } from "../../src/lib/corpus.js";

/**
 * GET /api/public/[slug]
 * Returns the studio profile (identity, brand, contact, geo, hero, widget,
 * replica sections, gallery, studio extras) for the studio page. Served from
 * the committed corpus file — no live database required.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Public profile data, read cross-origin by the embed loader on the client's
  // own site. No secrets here, so a permissive CORS header is safe.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const slug = (req.query.slug as string)?.trim().toLowerCase();
  if (!slug) return res.status(400).json({ error: "slug required" });

  try {
    const corpus = loadCorpus(slug);
    const p = corpus.project;
    return res.status(200).json({
      slug: p.slug,
      name: p.name,
      vertical: p.vertical ?? "studio",
      kind: p.kind ?? "",
      initial: p.initial ?? p.name.slice(0, 1).toUpperCase(),
      brand: p.brand,
      contact: p.contact,
      geo: p.geo ?? {},
      hero: p.hero ?? {},
      widget: p.widget ?? {},
      booking: p.booking,
      replica: p.replica,
      gallery: p.gallery ?? [],
      studio: p.studio,
    });
  } catch {
    return res.status(404).json({ error: "unknown studio" });
  }
}
