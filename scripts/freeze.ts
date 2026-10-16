import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SIMILARITY_FLOOR, TOP_K, chat, embed } from "../src/lib/ai.ts";
import { loadCorpus, searchCorpus } from "../src/lib/corpus.ts";
import type { FrozenPair } from "../src/types.ts";

/**
 * RAG a fixed question script once and freeze the Q→A pairs into
 * src/fixtures/<slug>.json. The Playwright capture harness then replays the
 * fixture — no LLM, no network, during recording (clip must be deterministic).
 *
 * Usage: npm run freeze -- dmi
 */
async function answerPair(slug: string, question: string): Promise<FrozenPair> {
  const corpus = loadCorpus(slug);
  const [qVec] = await embed([question]);
  const hits = searchCorpus(corpus, qVec, { topK: TOP_K, floor: SIMILARITY_FLOOR });
  const source = hits[0];
  const byId = new Map(corpus.chunks.map((c) => [c.id, c.text]));

  let answer: string;
  if (!source) {
    answer = `I couldn't find that on the practice's site — call for the right person.`;
  } else {
    const context = hits.map((h) => `[${h.heading}] ${byId.get(h.id)}`).join("\n\n");
    answer = await chat([
      { role: "system", content: "You are the front-desk assistant. Answer ONLY from the facts below, under 60 words, warm and concrete." },
      { role: "user", content: `Question: ${question}\n\nFacts:\n${context}` },
    ]);
  }
  return {
    question,
    answer,
    source: source
      ? { heading: source.heading, source_file: source.source_file, similarity: Number(source.similarity) }
      : null,
  };
}

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("Usage: npm run freeze -- <slug>");
  const qFile = join(process.cwd(), `src/content/${slug}/questions.md`);
  if (!existsSync(qFile)) throw new Error(`Missing ${slug}/questions.md`);

  const raw = readFileSync(qFile, "utf8");
  const questions = raw
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.trim().replace(/^-\s+/, ""));

  const pairs: FrozenPair[] = [];
  for (const question of questions) {
    process.stdout.write(`  RAG "${question}" … `);
    const pair = await answerPair(slug, question);
    pairs.push(pair);
    console.log(`done (${pair.source ? "source: " + pair.source.heading : "fallback"})`);
  }

  const outDir = join(process.cwd(), "src/fixtures");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${slug}.json`);
  writeFileSync(outFile, JSON.stringify(pairs, null, 2));
  console.log(`Froze ${pairs.length} pairs → ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});