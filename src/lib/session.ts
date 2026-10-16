import { emailConfigured, sendEmail, escapeHtml, shell, brandFromProject, type MailBrand } from "./email.js";
import { loadCorpus } from "./corpus.js";
import type { SessionHint, SessionResultInfo } from "../types.js";

/**
 * The studio session path. A photography studio's request is a message to the
 * team, not a reservation, so this hands off two ways: email to the studio
 * inbox and one-tap WhatsApp to the studio number, and always returns a
 * reference the client can quote. Every side effect is best-effort, so the
 * client never sees an error.
 */

export interface RecordSessionInput extends SessionHint {
  slug?: string;
  host?: string;
}

export type RecordSessionResult = SessionResultInfo;

/** DMI-XXXXXX, the reference the studio and the client both quote. */
export function makeSessionReference(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `DMI-${n}`;
}

function studioBrand(slug: string): { brand: MailBrand; name: string; wa: string; inbox: string | null } {
  let brand: MailBrand = brandFromProject(null);
  let name = "the studio";
  let wa = process.env.WHATSAPP_NUMBER ?? "2349013962323";
  let inbox = process.env.STUDIO_EMAIL ?? process.env.NOTIFY_EMAIL ?? null;
  try {
    const project = loadCorpus(slug).project;
    brand = brandFromProject(project);
    if (project.name) name = project.name;
    if (project.contact?.whatsapp) wa = project.contact.whatsapp;
    if (project.contact?.email) inbox = project.contact.email;
  } catch {
    /* corpus missing: still hand off with the environment defaults */
  }
  return { brand, name, wa, inbox };
}

/** Pretty lines for the email body and the WhatsApp hand-off. */
function sessionLines(s: SessionHint): Array<[string, string]> {
  const rows: Array<[string, string | undefined]> = [
    ["Service", s.service],
    ["City", s.location],
    ["Setting", s.setting],
    ["Date", s.date],
    ["Time", s.time],
    ["Package", s.pkg],
    ["Add-ons", s.addons],
    ["Name", s.name],
    ["WhatsApp", s.phone],
    ["Email", s.email],
    ["Note", s.note],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1] && String(r[1]).trim()));
}

function sessionTable(s: SessionHint): string {
  const rows = sessionLines(s);
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 0;color:#6b7280">${escapeHtml(k)}</td><td style="padding:4px 0;text-align:right;font-weight:600">${escapeHtml(v)}</td></tr>`)
    .join("")}</table>`;
}

export function sessionNotifyMail(s: SessionHint, reference: string, brand: MailBrand): { subject: string; html: string; text: string } {
  const inner = `
    <div style="padding:24px">
      <h2 style="margin:0 0 6px;font-size:18px">New session request</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">${escapeHtml(s.name ?? "A visitor")} just asked to book. Reference ${escapeHtml(reference)}.</p>
      ${sessionTable(s)}
      <p style="margin:16px 0 0;color:#6b7280;font-size:12px">Reply to this email or WhatsApp ${escapeHtml(s.phone ?? "")} to confirm the date and the total.</p>
    </div>`;
  const text = `New session request ${reference}\n\n${sessionLines(s)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}\n\nReply to this email or WhatsApp the client to confirm.`;
  return { subject: `New session ${reference} - ${s.service ?? "enquiry"}`, html: shell(inner, brand), text };
}

export function sessionGuestMail(s: SessionHint, reference: string, brand: MailBrand): { subject: string; html: string; text: string } {
  const first = (s.name ?? "").split(" ")[0] || "there";
  const inner = `
    <div style="padding:24px">
      <h2 style="margin:0 0 6px;font-size:18px">We have your session request</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Thank you, ${escapeHtml(first)}. ${escapeHtml(brand.name)} has your request. The team will confirm the date and the total shortly.</p>
      ${sessionTable(s)}
      <p style="margin:16px 0 0;color:#6b7280;font-size:12px">Quote ${escapeHtml(reference)} when you contact us. Call or WhatsApp ${escapeHtml(brand.phone)}.</p>
    </div>`;
  const text = `${brand.name} - session request received\n\nReference: ${reference}\n${sessionLines(s)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}\n\nWe will confirm the date and the total shortly. Call or WhatsApp ${brand.phone}.`;
  return { subject: `${brand.name} session request ${reference}`, html: shell(inner, brand), text };
}

export async function recordSession(input: RecordSessionInput): Promise<RecordSessionResult> {
  const service = (input.service ?? "").trim();
  const location = (input.location ?? "").trim();
  const date = (input.date ?? "").trim();
  const pkg = (input.pkg ?? "").trim();
  const email = (input.email ?? "").trim();
  const slug = (input.slug ?? process.env.PROPERTY_SLUG ?? "dmi").trim().toLowerCase();

  const { brand, name, wa, inbox } = studioBrand(slug);
  const reference = makeSessionReference();
  let emailed = false;

  const session: SessionHint = {
    service,
    location,
    setting: input.setting?.trim() || undefined,
    date: date || undefined,
    time: input.time?.trim() || undefined,
    pkg: pkg || undefined,
    addons: input.addons?.trim() || undefined,
    name: input.name?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    email: email || undefined,
    note: input.note?.trim() || undefined,
  };

  if (emailConfigured()) {
    const notify = inbox ?? wa;
    try {
      const alert = sessionNotifyMail(session, reference, brand);
      const sent = await sendEmail({ to: notify, subject: alert.subject, html: alert.html, text: alert.text, replyTo: email || undefined });
      emailed = sent.ok;
      if (!sent.ok) console.error(`[session ${reference}] notify mail failed: ${sent.status ?? ""} ${sent.error ?? ""}`.trim());
    } catch (err) {
      console.error(`[session ${reference}] notify mail threw: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (email) {
      try {
        const mail = sessionGuestMail(session, reference, brand);
        const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text, replyTo: inbox ?? undefined });
        if (!sent.ok) console.error(`[session ${reference}] guest mail failed: ${sent.status ?? ""} ${sent.error ?? ""}`.trim());
      } catch (err) {
        console.error(`[session ${reference}] guest mail threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const lines = [
    `Hello ${name}.`,
    `I would like to book a session.`,
    `Reference: ${reference}`,
    ...sessionLines(session).map(([k, v]) => `${k}: ${v}`),
  ];
  const whatsappUrl = `https://wa.me/${wa}?text=${encodeURIComponent(lines.join("\n"))}`;

  return {
    reference,
    whatsappUrl,
    emailed,
    service: session.service ?? null,
    location: session.location ?? null,
    date: session.date ?? null,
    pkg: session.pkg ?? null,
  };
}
