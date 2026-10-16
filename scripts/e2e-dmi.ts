/**
 * DMI studio vertical, end to end against a local server on :3000.
 * Run: npm run serve   (in one terminal)
 *      npm run e2e     (in another)
 */
import { scanPrices, allowedAmounts, naira } from "../src/lib/prices.ts";
import { sessionIsComplete, isEmail } from "../src/lib/desk.ts";

const BASE = "http://localhost:3000";
const SLUG = "dmi";
type Msg = { role: "user" | "assistant"; content: string };

async function chat(messages: Msg[]) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: SLUG, messages }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  const events: any[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        events.push(e);
        if (e.type === "delta") text += e.text;
      } catch {
        /* partial line */
      }
    }
  }
  return { text, events };
}

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? "  " + detail : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? "  " + detail : ""}`);
  }
}

async function main() {
  console.log("\n-- guard unit check --");
  const dirty = scanPrices(`That will be ${naira(55_000)} and also ${naira(50_000)}.`);
  check("off-card amount flagged", dirty.unknown.length === 1 && dirty.unknown[0] === 55_000, JSON.stringify(dirty));
  const clean = scanPrices(`Portraits start at ${naira(50_000)} in Uyo.`);
  check("on-card amount passes", clean.unknown.length === 0 && clean.found.length === 1);
  console.log(`  rate card holds ${allowedAmounts().length} distinct amounts`);

  console.log("\n-- email is compulsory (guard) --");
  const noEmail = sessionIsComplete({ name: "Ada", phone: "0803", service: "Portrait", location: "Uyo" });
  check("no email => not recorded", noEmail === false);
  const badEmail = sessionIsComplete({ name: "Ada", phone: "0803", service: "Portrait", location: "Uyo", email: "nope" });
  check("malformed email => not recorded", badEmail === false);
  const goodEmail = sessionIsComplete({ name: "Ada", phone: "0803", service: "Portrait", location: "Uyo", email: "ada.obi@email.com" });
  check("valid email => recorded", goodEmail === true);
  check("isEmail accepts a real address", isEmail("ada.obi@email.com") && !isEmail("ada@"));

  console.log("\n-- portrait price --");
  const q1 = await chat([
    { role: "user", content: "How much is an individual portrait session, indoors, in Uyo?" },
  ]);
  console.log("  reply:", q1.text.slice(0, 300));
  check("answers from the rate card", q1.text.includes("50,000"), "expected 50,000");
  check("no off-card naira figure", scanPrices(q1.text).unknown.length === 0, JSON.stringify(scanPrices(q1.text).unknown));
  check("streamed + done", q1.events.some((e) => e.type === "done") && q1.events.some((e) => e.type === "meta"));

  console.log("\n-- wedding price --");
  const q2 = await chat([{ role: "user", content: "What is the Diamond wedding package for a two day event?" }]);
  console.log("  reply:", q2.text.slice(0, 300));
  check("quotes 1,400,000 for two days", q2.text.includes("1,400,000"));
  check("no off-card naira figure", scanPrices(q2.text).unknown.length === 0, JSON.stringify(scanPrices(q2.text).unknown));

  console.log("\n-- studio space + academy --");
  const q3 = await chat([{ role: "user", content: "How much to rent the content space, and what does the academy cost?" }]);
  console.log("  reply:", q3.text.slice(0, 300));
  check("quotes content space 20,000", q3.text.includes("20,000"));
  check("quotes academy 200,000", q3.text.includes("200,000"));
  check("no off-card naira figure", scanPrices(q3.text).unknown.length === 0, JSON.stringify(scanPrices(q3.text).unknown));

  console.log("\n-- off-card price refuses to guess --");
  const q4 = await chat([{ role: "user", content: "How much for a baby shower shoot in Port Harcourt?" }]);
  console.log("  reply:", q4.text.slice(0, 300));
  const off = scanPrices(q4.text);
  check("either no figure or an on-card figure", off.unknown.length === 0, JSON.stringify(off.unknown));

  console.log("\n-- no email => desk will not record --");
  const noEmailTurns: Msg[] = [];
  const noEmailScript = [
    "I want to book a portrait session.",
    "In Uyo, indoors please.",
    "Saturday the 17th of October at 2 pm, individual.",
    "My name is Ada Obi and my WhatsApp number is 0803 000 0000.",
    "Just book it now, I do not want to give an email.",
  ];
  let noEmailRecorded = false;
  for (const line of noEmailScript) {
    noEmailTurns.push({ role: "user", content: line });
    const r = await chat(noEmailTurns);
    noEmailTurns.push({ role: "assistant", content: r.text });
    console.log("  client:", line);
    console.log("  desk  :", r.text.slice(0, 220));
    if (r.events.find((e) => e.type === "sessioned")) { noEmailRecorded = true; break; }
  }
  const lastNoEmail = noEmailTurns.filter((t) => t.role === "assistant").pop()?.content ?? "";
  check("refuses to record without an email", noEmailRecorded === false);
  check("asks for an email", /email/i.test(lastNoEmail), JSON.stringify(lastNoEmail.slice(0, 160)));

  console.log("\n-- session capture (with email) --");
  const turns: Msg[] = [];
  let captured: any = null;
  const script = [
    "I want to book a portrait session.",
    "In Uyo, indoors please.",
    "Saturday the 17th of October at 2 pm, individual.",
    "My name is Ada Obi and my WhatsApp number is 0803 000 0000.",
    "ada.obi@email.com, that is everything, please book it.",
  ];
  for (const line of script) {
    turns.push({ role: "user", content: line });
    const r = await chat(turns);
    turns.push({ role: "assistant", content: r.text });
    console.log("  client:", line);
    console.log("  desk  :", r.text.slice(0, 240));
    const sessioned = r.events.find((e) => e.type === "sessioned");
    if (sessioned) {
      captured = sessioned.session;
      break;
    }
  }
  check("session recorded with a reference", !!captured && /^DMI-\d{6}$/.test(captured?.reference ?? ""), captured?.reference);
  check("returns a wa.me hand-off", !!captured && String(captured?.whatsappUrl ?? "").startsWith("https://wa.me/"));
  check("emailed flag is truthful (redirect to test inbox)", captured?.emailed === true, "emailed=" + captured?.emailed);
  console.log("  captured:", JSON.stringify(captured));

  console.log("\n-- static + profile --");
  const pub = await (await fetch(`${BASE}/api/public/${SLUG}`)).json();
  check("profile is the studio vertical", pub.vertical === "studio" && !!pub.studio);
  const page = await fetch(`${BASE}/p/${SLUG}`);
  check("page shell serves 200", page.status === 200);
  const img = await fetch(`${BASE}/images/dmi/hero-slide-14-C0lfPbQD.jpg`);
  check("hero image serves", img.status === 200);
  check("profile exposes a booking url", typeof pub.booking === "string" && /booking/.test(pub.booking), pub.booking);

  console.log("\n-- embed path --");
  const loader = await fetch(`${BASE}/embed.js`);
  check("embed.js serves 200", loader.status === 200);
  check("embed.js exposes the DmiDesk API", (await loader.text()).includes("DmiDesk"));
  const embed = await fetch(`${BASE}/embed/${SLUG}`);
  check("embed page shell serves 200", embed.status === 200);
  check("embed page is the app shell", (await embed.text()).includes('id="root"'));

  console.log("\n-- hotel vertical removed --");
  for (const route of ["/api/book", "/api/reservations", "/api/availability", "/api/config", "/api/admin/auth"]) {
    const r = await fetch(`${BASE}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    check(`${route} is gone`, r.status === 404, `status ${r.status}`);
  }

  console.log(`\n== ${pass} passed, ${fail} failed ==`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});
