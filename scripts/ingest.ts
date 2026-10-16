import "dotenv/config";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EMBED_DIM, EMBED_MODEL, embed } from "../src/lib/ai.ts";
import { DATA_DIR } from "../src/lib/corpus.ts";
import type { Corpus, RentbotProject } from "../src/types.ts";

/**
 * Ingest the RAG corpus for one (or every) practice in src/content/<slug>.
 * Reads <slug>/project.json + <slug>/*.md, sections each file on "# " / "## "
 * headings, embeds every section with Gemini, and writes the frozen corpus to
 * src/data/<slug>.json. Idempotent — re-running replaces the file.
 *
 * The data file is COMMITTED: it is the deterministic knowledge base the API
 * serves from. No live database needed — the widget only reads.
 *
 * Usage: npm run ingest -- dmi   (no slug → ingest every folder)
 */

const CONTENT_ROOT = join(process.cwd(), "src/content");

function sectionize(md: string): Array<{ heading: string | null; text: string }> {
  const sections: Array<{ heading: string | null; text: string }> = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let heading: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) sections.push({ heading, text });
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.*)$/);
    if (m) {
      flush();
      heading = m[2].trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

async function ingestSlug(slug: string): Promise<void> {
  const dir = join(CONTENT_ROOT, slug);
  if (!existsSync(dir)) throw new Error(`No content folder for slug "${slug}"`);
  if (!existsSync(join(dir, "project.json"))) {
    throw new Error(`Missing ${slug}/project.json`);
  }

  const project = JSON.parse(readFileSync(join(dir, "project.json"), "utf8")) as RentbotProject;
  const mdFiles = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "questions.md").sort();

  const sections: Array<{ source_file: string; heading: string | null; text: string }> = [];
  for (const file of mdFiles) {
    const raw = readFileSync(join(dir, file), "utf8");
    for (const s of sectionize(raw)) {
      sections.push({ source_file: file, heading: s.heading, text: s.text });
    }
  }

  if (sections.length === 0) throw new Error(`No markdown content found for ${slug}`);

  // Embed in batches, mapping back to section order.
  const chunks: Corpus["chunks"] = [];
  for (let i = 0; i < sections.length; i += 10) {
    const batch = sections.slice(i, i + 10);
    const vectors = await embed(batch.map((s) => s.text));
    const dims = new Set(vectors.map((v) => v.length));
    if (dims.size !== 1 || (process.env.EMBEDDING_DIM && [...dims][0] !== EMBED_DIM)) {
      throw new Error(
        `Embedding dimension mismatch: got ${[...dims].join(",")}, expected ${EMBED_DIM}. ` +
          `Embeddings and queries must share one model/dimension.`,
      );
    }
    for (let j = 0; j < batch.length; j++) {
      const s = batch[j];
      chunks.push({
        id: `${s.source_file}#${i + j}`,
        source_file: s.source_file,
        heading: s.heading,
        section_index: i + j,
        text: s.text,
        embedding: vectors[j],
      });
    }
    process.stdout.write(`  +${batch.length} embedded (${chunks.length}/${sections.length})\r`);
  }
  process.stdout.write("\n");

  const corpus: Corpus = {
    slug,
    project: { ...project, slug },
    embedding_model: EMBED_MODEL,
    dim: chunks[0].embedding.length,
    chunks,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, `${slug}.json`), JSON.stringify(corpus, null, 2));
  console.log(`Ingested ${slug} — ${chunks.length} chunks → src/data/${slug}.json (${project.name}).`);
}

async function main() {
  const want = process.argv[2];
  const slugs = want
    ? [want]
    : readdirSync(CONTENT_ROOT).filter((d) => existsSync(join(CONTENT_ROOT, d, "project.json")));
  if (slugs.length === 0) {
    console.log("No practice folders found under src/content/.");
    return;
  }
  for (const slug of slugs) {
    await ingestSlug(slug);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});