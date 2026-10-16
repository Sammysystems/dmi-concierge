import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Corpus, CorpusHit } from "../types";

export const DATA_DIR = join(process.cwd(), "src/data");

export function loadCorpus(slug: string): Corpus {
  const file = join(DATA_DIR, `${slug}.json`);
  if (!existsSync(file)) throw new Error(`unknown property: ${slug}`);
  return JSON.parse(readFileSync(file, "utf8")) as Corpus;
}

/** Every shipped property, in the order the corpus files sit on disk. */
export function listCorpusSlugs(): string[] {
  if (!existsSync(DATA_DIR)) return [];
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5));
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

export function searchCorpus(
  corpus: Corpus,
  queryVec: number[],
  opts: { topK: number; floor: number },
): CorpusHit[] {
  return corpus.chunks
    .map((c) => ({ id: c.id, heading: c.heading, source_file: c.source_file, similarity: cosine(c.embedding, queryVec) }))
    .filter((h) => h.similarity >= opts.floor)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, opts.topK);
}