import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
import type { RentbotProject } from "../types.js";

/**
 * Outbound email layer, sent through Resend's HTTP API - no SDK, no SMTP
 * socket. The studio desk builds every mail from one shape: a session request
 * notice to the inbox and a confirmation to the client.
 *
 * Every mail is rendered for the studio it belongs to: the brand colour, name,
 * phone, address and currency all come from a MailBrand context.
 * `DEFAULT_BRAND` is DarlMac Impression's look for any caller that does not
 * pass one.
 *
 * Note: with the shared `onboarding@resend.dev` sender, Resend only delivers to
 * the account owner's address until a sending domain is verified. Real guest
 * addresses need a verified domain, so `MAIL_OVERRIDE_TO` can redirect every
 * send to one inbox (the true recipient is named in the body) while testing.
 */

loadDotenv({ path: join(process.cwd(), ".env.local") });

export interface MailBrand {
  name: string;
  color: string;
  phone: string;
  address: string;
  currency: string;
  locale: string;
}

export const DEFAULT_BRAND: MailBrand = {
  name: "DarlMac Impression",
  color: "#e40014",
  phone: "+234 901 396 2323",
  address: "#12 Nwaniba Road, Uyo, Akwa Ibom",
  currency: "NGN",
  locale: "en-NG",
};

/** Build a mail brand from a studio profile, falling back to DMI's look. */
export function brandFromProject(project?: RentbotProject | null): MailBrand {
  if (!project) return DEFAULT_BRAND;
  return {
    name: project.name || DEFAULT_BRAND.name,
    color: project.brand?.primary || DEFAULT_BRAND.color,
    phone: project.contact?.phone || DEFAULT_BRAND.phone,
    address: project.contact?.address || DEFAULT_BRAND.address,
    currency: project.geo?.currency || DEFAULT_BRAND.currency,
    locale: project.geo?.locale || DEFAULT_BRAND.locale,
  };
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "onboarding@resend.dev";
}

/** The studio inbox address, if configured. */
export function notifyAddress(): string | null {
  return process.env.NOTIFY_EMAIL || null;
}

/**
 * While testing with the shared `onboarding@resend.dev` sender, Resend only
 * delivers to the account owner. When `MAIL_OVERRIDE_TO` is set, every mail is
 * redirected there: the true recipient is named in the body and the reply-to
 * still points at them, so the demo inbox sees real, honest mail. Leave it
 * unset in production once a sending domain is verified.
 */
export function overrideAddress(): string | null {
  return process.env.MAIL_OVERRIDE_TO || null;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

const redirectedNote = (to: string) =>
  `<p style="margin:0 0 12px;padding:8px 10px;background:#f4f4f5;border-radius:8px;color:#6b7280;font-size:12px">Demo delivery: this mail was addressed to <strong>${escapeHtml(to)}</strong> and redirected to the studio's test inbox.</p>`;

export async function sendEmail(mail: MailInput): Promise<{ ok: boolean; status?: number; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  const override = overrideAddress();
  const deliverTo = override ?? mail.to;
  const html = override ? redirectedNote(mail.to) + mail.html : mail.html;
  const text = override ? `[Demo delivery: addressed to ${mail.to}, redirected to the test inbox]\n\n${mail.text ?? ""}` : mail.text;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: fromAddress(),
        to: [deliverTo],
        subject: mail.subject,
        html,
        ...(text ? { text } : {}),
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
    });
    const data = (await res.json().catch(() => null)) as { id?: string; message?: string; error?: string } | null;
    if (!res.ok) return { ok: false, status: res.status, error: data?.message ?? data?.error ?? `HTTP ${res.status}` };
    return { ok: true, status: res.status, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function shell(inner: string, brand: MailBrand): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f2ed;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:${brand.color};color:#ffffff;padding:20px 24px">
      <h1 style="margin:0;font-size:16px">${escapeHtml(brand.name)}</h1>
    </div>
    ${inner}
    <div style="padding:16px 24px;color:#6b7280;font-size:12px">
      ${escapeHtml(brand.name)} · ${escapeHtml(brand.phone)} · ${escapeHtml(brand.address)}
    </div>
  </div>
</body></html>`;
}


