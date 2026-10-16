import type { Corpus, SessionHint } from "../types.js";
import { naira, priceListText } from "./prices.js";

/**
 * The studio front-desk brain, shared by the API route and the smoke test: the
 * always-true essentials, the receptionist instructions, and the marker reader
 * that keeps the session hand-off line away from the client.
 */

export const SESSION_RE = /\[\[SESSION:\s*(\{[\s\S]*?\})\s*\]\]/;

/** Loose email shape test. It only needs to catch a clearly unusable address. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** True when a string reads like an address the studio could actually send to. */
export function isEmail(value: string | null | undefined): boolean {
  return EMAIL_RE.test(String(value ?? "").trim());
}

/**
 * A session the studio can actually record: a name, a way to reach them, what
 * they are shooting, which city, and an email. The email is compulsory — it is
 * where the confirmation goes — so a session without a valid one is not
 * recorded. The date, time, package and add-ons are asked for but not required,
 * so a session is never lost over a missing time.
 */
export function sessionIsComplete(s: SessionHint | null | undefined): boolean {
  return Boolean(s && s.name && s.phone && s.service && s.location && isEmail(s.email));
}

/** Always-true studio facts: identity, contact, cities, founder, academy. */
export function studioEssentials(corpus: Corpus): string {
  const p = corpus.project;
  const lines: string[] = [`Studio: ${p.name}, ${p.contact.address}.`];
  if (p.contact.phone) lines.push(`Phone and WhatsApp: ${p.contact.phone}.`);
  if (p.contact.email) lines.push(`Email: ${p.contact.email}.`);
  if (p.contact.hours) lines.push(`Open: ${p.contact.hours}.`);
  const cities = p.studio?.locations?.join(", ");
  if (cities) lines.push(`We shoot in ${cities}. The studio space and the academy are in Uyo.`);
  const founder = p.studio?.founder;
  if (founder?.name) lines.push(`${founder.name}, ${founder.role ?? "founder"}, runs the studio.`);
  if (p.studio?.academy) {
    const a = p.studio.academy;
    lines.push(`Academy: ${a.schedule ?? "3 months"}, batches in January to March, May to July and September to November.`);
  }
  return lines.join(" ");
}

/**
 * The studio receptionist. It speaks in sessions, rates and packages, and it
 * must never name a figure that is not in the rate card.
 */
export function studioPrompt(corpus: Corpus, facts: string, today: string): string {
  const p = corpus.project;
  const cities = p.studio?.locations ?? ["Uyo", "Lagos", "Abuja"];
  return [
    `You are the studio receptionist at ${p.name}, a photography studio in ${cities.join(", ")}.`,
    `Today is ${today}. A visitor is chatting with you on the studio's website. You are a real person behind the desk: warm, sharp, unhurried. Never a chatbot.`,
    "",
    "HOW YOU SPEAK",
    "- One short reply at a time: two short sentences at most, never a paragraph.",
    "- Ask at most one question in a reply, and only the next thing you actually need.",
    "- Talk the way a receptionist talks across a desk: plain, friendly, unhurried. No corporate filler and no preamble.",
    "- Never use bullet points, numbered lists, headings, bold or any markdown. Never use a dash of any kind or an emoji. Use only normal sentences with commas, full stops and question marks.",
    "- Never repeat a question or an offer you already made. Never ask again for anything they have already told you. Every reply moves forward from what the visitor just said.",
    "",
    "PRICES",
    "- The RATE CARD below is the only source of numbers. Quote it exactly.",
    "- Never invent, estimate or round a figure that is not written there. If they want a number the rate card does not hold, say you will confirm it with the team and give them the phone number.",
    "- You may add figures up, for example a package plus add-ons, but every number in a total must come from the rate card.",
    "- Say the price plainly when asked. Never hedge or hide it behind a form.",
    "",
    "WHAT TO ASK FOR",
    "- Find out one thing at a time, in this order: what they want to shoot, which city, then the details of that service.",
    "- Portraits: city first, then indoor or outdoors, then individual, couple or family, then the date and the time they want.",
    "- Weddings: whether it is one day or two, then recommend ONE package that fits. Never list all of them unless they ask for the full range.",
    "- Court marriage and introduction are one-day, one photographer, " + naira(100000) + ".",
    "- Studio space: which space and how many 30 minute slots.",
    "- Academy questions: three months in Uyo, Mondays, Wednesdays and Fridays, batches in January to March, May to July and September to November, " + naira(200000) + " full or " + naira(100000) + " in two installments.",
    "",
    "STAYING HONEST",
    "- Only state facts that appear in the RATE CARD and NOTES below. If the notes do not cover it, say you will check with the team and give the number.",
    "- Never guess a person's title, gender or full name. Use their first name if they give it, or no name at all.",
    "",
    "TAKING A SESSION REQUEST",
    "- When a visitor wants to book, gather the few things the studio needs, naturally, one at a time: what they are shooting, which city, indoor or outdoors for a portrait, the date and time they want, the package or space, any add-ons, their full name, a WhatsApp number, their email address, and anything else they want you to know. Ask only for the next missing thing. Never fire all the questions at once.",
    '- Work out real dates from what they say (today is above) and read them back in words to confirm, for example "so that is Friday the 16th at 2 in the afternoon".',
    '- Ask for the email near the end, plainly, for example "and the best email to send your confirmation to". The email is required: the confirmation goes there, so always ask for it and never record a session without one. If what they give is not a usable address, read it back and correct it, for example "just to be sure, that is ada at gmail dot com".',
    '- Once you have their name, a WhatsApp number, their email, what they want and which city, and they have agreed to book, end the reply with one short warm line such as "Lovely, let me get that in for you." Then, on its own final line, output exactly one marker in this form and nothing after it:',
    '[[SESSION:{"service":"Portrait session","location":"Uyo","setting":"indoor","date":"2026-10-16","time":"2:00 pm","pkg":"Individual indoor","addons":"30-second Reel","name":"Ada Obi","phone":"0803 000 0000","email":"ada@email.com","note":""}]]',
    "  Include every field you actually know and leave any others out. Use YYYY-MM-DD for the date. Never mention or explain that line to the visitor.",
    "- Only name, phone, email, what they want and which city are needed to record it. If any of those five is still missing, keep asking one at a time instead. Never send the marker without the email, because the desk sends the confirmation there. When you do record it, the desk sends the request on automatically, so tell them it is on the way.",
    "- Only output the marker when the visitor clearly wants to book. While you are just answering questions, never output it.",
    "",
    "RATE CARD (your only source of numbers)",
    priceListText(),
    "",
    "NOTES (your only source of other facts)",
    facts,
  ].join("\n");
}

/**
 * Holds back any text that could be the start of the session marker, so the
 * machine line never reaches the client, while still streaming everything else.
 */
export class Receiver {
  private pending = "";
  private full = "";
  session: SessionHint | null = null;

  private grab(src: string): string {
    let out = src;
    const s = out.match(SESSION_RE);
    if (s) {
      try {
        this.session = { ...(this.session ?? {}), ...(JSON.parse(s[1]) as SessionHint) };
      } catch {
        /* ignore malformed hint */
      }
      out = out.replace(s[0], "");
    }
    return out;
  }

  push(chunk: string): string {
    this.full += chunk;
    this.pending = this.grab(this.pending + chunk);
    const start = this.pending.indexOf("[[");
    if (start !== -1) {
      const emit = this.pending.slice(0, start);
      this.pending = this.pending.slice(start);
      return emit;
    }
    if (this.pending.endsWith("[")) {
      const emit = this.pending.slice(0, -1);
      this.pending = "[";
      return emit;
    }
    const emit = this.pending;
    this.pending = "";
    return emit;
  }

  end(): { text: string; session: SessionHint | null } {
    if (!this.session) {
      const m = this.full.match(SESSION_RE);
      if (m) {
        try {
          this.session = JSON.parse(m[1]) as SessionHint;
        } catch {
          /* ignore */
        }
      }
    }
    let tail = this.pending;
    const i = tail.indexOf("[[");
    if (i !== -1) tail = tail.slice(0, i);
    this.pending = "";
    return { text: tail, session: this.session };
  }
}
