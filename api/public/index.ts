import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCorpusSlugs, loadCorpus } from "../../src/lib/corpus.js";

/**
 * GET /api/public
 * Lists every shipped studio so the landing page can offer a directory
 * instead of being pinned to one studio. Each entry is a small profile the
 * client can link to at /p/<slug>.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const studios = listCorpusSlugs()
    .map((slug) => {
      try {
        const p = loadCorpus(slug).project;
        if (p.listed === false) return null;
        return {
          slug,
          name: p.name,
          vertical: p.vertical ?? "studio",
          kind: p.kind ?? "",
          city: p.geo?.city ?? "",
          state: p.geo?.state ?? "",
          brand: p.brand,
          initial: p.initial ?? p.name.slice(0, 1).toUpperCase(),
        };
      } catch {
        return null;
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return res.status(200).json({ studios });
}
