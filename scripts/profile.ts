import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../src/lib/corpus.ts";
import type { Corpus, RentbotProject } from "../src/types.ts";

/**
 * Sync the profile half of a committed corpus file from its authoring source.
 *
 * The corpus (src/data/<slug>.json) is what the API serves, and it embeds a
 * copy of the property profile. Editing src/content/<slug>/project.json alone
 * is not enough: re-ingest would re-embed every chunk (slow, and burns Gemini
 * quota). This script copies ONLY the `project` object across, leaving the
 * embeddings untouched.
 *
 * Usage: npm run profile -- dmi     (no slug → every folder with a corpus)
 */

const CONTENT_ROOT = join(process.cwd(), "src/content");

function sync(slug: string): void {
  const projectFile = join(CONTENT_ROOT, slug, "project.json");
  const dataFile = join(DATA_DIR, `${slug}.json`);
  if (!existsSync(projectFile)) {
    console.log(`skip ${slug}: no src/content/${slug}/project.json`);
    return;
  }
  if (!existsSync(dataFile)) {
    console.log(`skip ${slug}: no corpus yet (run: npm run ingest -- ${slug})`);
    return;
  }
  const project = JSON.parse(readFileSync(projectFile, "utf8")) as RentbotProject;
  const corpus = JSON.parse(readFileSync(dataFile, "utf8")) as Corpus;
  corpus.project = { ...project, slug };
  writeFileSync(dataFile, JSON.stringify(corpus, null, 2));
  console.log(`Synced ${slug} profile → src/data/${slug}.json (${project.name}).`);
}

function main(): void {
  const want = process.argv[2];
  const slugs = want
    ? [want]
    : readdirSync(CONTENT_ROOT).filter((d) => existsSync(join(CONTENT_ROOT, d, "project.json")));
  for (const slug of slugs) sync(slug);
}

main();
