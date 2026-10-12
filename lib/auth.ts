import "server-only";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  return !!secret && safeEqual(header, `Bearer ${secret}`);
}

// The outreach Send button (the only passcode-protected action on the public site).
export function hasSendPasscode(request: Request): boolean {
  const passcode = process.env.SEND_PASSCODE;
  const given = request.headers.get("x-send-passcode") ?? "";
  return !!passcode && safeEqual(given, passcode);
}

export const unauthorized = () => Response.json({ error: "Not authorised" }, { status: 401 });
