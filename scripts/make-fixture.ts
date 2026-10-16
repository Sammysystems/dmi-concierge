import "dotenv/config";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: join(process.cwd(), ".env.local") });
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { loadCorpus, searchCorpus } from "../src/lib/corpus.ts";
import { SIMILARITY_FLOOR, TOP_K, chat, embed } from "../src/lib/ai.ts";
import type { FrozenPair } from "../src/types.ts";

const slug = "dmi";
const qFile = join(process.cwd(), `src/content/${slug}/questions.md`);
const raw = readFileSync(qFile, "utf8");
const questions = raw
  .split(/\r?\n/)
  .filter((l) => l.trim().startsWith("- "))
  .map((l) => l.trim().replace(/^-\s+/, ""));

const corpus = loadCorpus(slug);
const byId = new Map(corpus.chunks.map((c) => [c.id, c.text]));
const pairs: FrozenPair[] = [];

for (let i = 0; i < questions.length; i++) {
  const question = questions[i];
  console.log(`Q${i + 1}/${questions.length}: ${question}`);
  const [qVec] = await embed([question]);
  const hits = searchCorpus(corpus, qVec, { topK: TOP_K, floor: SIMILARITY_FLOOR });
  const source = hits[0];
  let answer: string;
  if (!source) {
    answer = "I couldn't find that on the practice's site — call for the right person.";
  } else {
    const context = hits.map((h) => `[${h.heading}] ${byId.get(h.id)}`).join("\n\n");
    answer = await chat([
      { role: "system", content: "You are the front-desk assistant. Answer ONLY from the facts below, under 60 words, warm and concrete." },
      { role: "user", content: `Question: ${question}\n\nFacts:\n${context}` },
    ]);
  }
  pairs.push({ question, answer, source: source ? { heading: source.heading, source_file: source.source_file, similarity: Number(source.similarity) } : null });
  console.log("  →", answer);
  // pace to avoid quota: wait between questions (Gemini free-tier ~20 req/min)
  if (i < questions.length - 1) await new Promise((r) => setTimeout(r, 5000));
}

const outDir = join(process.cwd(), "src/fixtures");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${slug}.json`);
writeFileSync(outFile, JSON.stringify(pairs, null, 2));
console.log("WROTE", outFile);