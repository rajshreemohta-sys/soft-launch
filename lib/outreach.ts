import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "./supabase";
import { SITE } from "./site";

// Sends one outreach email from the dashboard. Demo safeguards:
//  - only to approved test recipients (OUTREACH_TEST_RECIPIENTS, default: HOTLIST_TO_EMAIL),
//    so no real executive receives a pitch for the fictional product;
//  - at most DAILY_LIMIT sends per IST day; every attempt is logged in outreach_sends.

export const DAILY_LIMIT = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function approvedRecipients(): string[] {
  const list = process.env.OUTREACH_TEST_RECIPIENTS || process.env.HOTLIST_TO_EMAIL || "";
  return list
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => EMAIL_RE.test(x));
}

async function sentToday(): Promise<number> {
  const ist = new Date(Date.now() + 330 * 60_000);
  const midnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000;
  const { count, error } = await supabaseAdmin()
    .from("outreach_sends")
    .select("id", { count: "exact", head: true })
    .is("error", null)
    .gte("sent_at", new Date(midnightIst).toISOString());
  if (error) throw error;
  return count ?? 0;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function toHtml(body: string): string {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font:15px/1.55 Helvetica,Arial,sans-serif;color:#111;max-width:600px;">${paragraphs}<p style="margin:24px 0 0 0;font-size:12px;color:#777;">${esc(SITE.disclaimer)}</p></div>`;
}

export type SendResult = { ok: true; id: string } | { ok: false; status: number; error: string };

export async function sendOutreach(input: { accountId: string | null; to: string; subject: string; body: string }): Promise<SendResult> {
  const to = input.to.trim().toLowerCase();
  const subject = input.subject.trim().slice(0, 200);
  const body = input.body.trim().slice(0, 5000);
  if (!EMAIL_RE.test(to)) return { ok: false, status: 400, error: "That doesn't look like an email address." };
  if (!subject || !body) return { ok: false, status: 400, error: "Subject and message can't be empty." };
  if (!approvedRecipients().includes(to)) {
    return { ok: false, status: 403, error: "This demo only sends to approved test addresses. Use Open in Gmail for anyone else." };
  }
  if ((await sentToday()) >= DAILY_LIMIT) {
    return { ok: false, status: 429, error: `Today's limit of ${DAILY_LIMIT} emails is reached.` };
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, status: 500, error: "Email sending isn't configured." };

  const sender = process.env.OUTREACH_FROM_EMAIL || process.env.HOTLIST_FROM_EMAIL || "onboarding@resend.dev";
  const from = sender.includes("<") ? sender : `Arjun at ${SITE.name} <${sender}>`;
  const { data, error } = await new Resend(key).emails.send({
    from,
    to,
    subject,
    text: `${body}\n\n--\n${SITE.disclaimer}`,
    html: toHtml(body),
    ...(process.env.OUTREACH_REPLY_TO ? { replyTo: process.env.OUTREACH_REPLY_TO } : {}),
  });

  await supabaseAdmin().from("outreach_sends").insert({
    account_id: input.accountId,
    recipient: to,
    subject,
    email_id: data?.id ?? null,
    error: error ? `${error.name}: ${error.message}` : null,
  });

  if (error || !data?.id) return { ok: false, status: 502, error: `The email service refused it: ${error?.message ?? "unknown error"}` };
  return { ok: true, id: data.id };
}
