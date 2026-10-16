import "dotenv/config";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: join(process.cwd(), ".env.local") });
import { embed, chat, CHAT_MODELS } from "../src/lib/ai.ts";

console.log("using chat models:", CHAT_MODELS.join(", "));

const v = await embed(["Do you offer payment plans?", "What does a portrait session cost?"]);
console.log("embed batches:", v.length, "dim:", v[0].length);
const a = await chat([
  { role: "system", content: "You are a photography studio front desk. Answer in one sentence under 20 words." },
  { role: "user", content: "What are your hours?" },
]);
console.log("chat:", a);