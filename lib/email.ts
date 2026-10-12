import { SITE } from "./site";

// Hot List email. Table-based with inline styles so it survives email clients.
// Plain two-line list per account (Rajshree picked option A over the old cards).

export type HotListEmailEntry = {
  rank: number;
  account_id: string;
  company_name: string;
  deal_stage: string | null;
  signal_type: string;
  one_line_summary: string;
  outreach_angle: string;
  source_url: string;
  source_name: string | null;
  published_at: string;
  score: number;
};

export type WarmEntry = {
  account_id: string;
  company_name: string;
  signal_type: string | null;
  summary: string | null;
  signal_date: string | null;
  score: number;
};

const C = {
  green: "#3D6549",
  ink: "#000000",
  grid: "#ECE9E2",
  paper: "#FFFFFF",
  muted: "#5C5A55",
  quiet: "#8D8A83",
};

const FONT = "Helvetica, Arial, sans-serif";

const esc = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const istDate = (d: Date | string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", ...opts }).format(new Date(d));

// "Thu 15 Oct"
export function emailDate(d: Date): string {
  return istDate(d, { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
}

export function hotListSubject(date: Date, count: number): string {
  const label = count === 1 ? "1 account worth a call" : `${count} accounts worth a call`;
  return count ? `Hot List for ${emailDate(date)}: ${label}` : `Hot List for ${emailDate(date)}: no fresh signals`;
}

// Gemini writes the summary as a fragment after the company name; drop a trailing full stop so we can add our own.
const fragment = (s: string) => s.trim().replace(/\.$/, "");

// One entry = two short lines: "1  Company — what happened." then "Angle: …" in green (Rajshree's option A).
function entryRow(e: HotListEmailEntry, appUrl: string) {
  return `
<tr>
  <td width="24" valign="top" style="padding:10px 0;border-top:1px solid ${C.grid};font:14px/1.45 ${FONT};color:${C.quiet};">${e.rank}</td>
  <td valign="top" style="padding:10px 0;border-top:1px solid ${C.grid};font:15px/1.45 ${FONT};color:${C.ink};">
    <a href="${appUrl}/accounts/${e.account_id}" style="color:${C.ink};font-weight:700;text-decoration:none;">${esc(e.company_name)}</a> &mdash; ${esc(fragment(e.one_line_summary))}.<br/>
    <span style="color:${C.green};">Angle: ${esc(fragment(e.outreach_angle))}.</span>
  </td>
</tr>`;
}

// Next-highest accounts without a fresh trigger: names and last-trigger dates on one line.
function warmRows(warm: WarmEntry[], appUrl: string) {
  if (!warm.length) return "";
  const names = warm
    .map(
      (w) =>
        `<a href="${appUrl}/accounts/${w.account_id}" style="color:${C.ink};font-weight:700;text-decoration:none;">${esc(w.company_name)}</a>${w.signal_date ? ` (${esc(istDate(w.signal_date, { day: "numeric", month: "short" }))})` : ""}`
    )
    .join(" &middot; ");
  return `
<tr><td colspan="2" style="padding:14px 0 0 0;border-top:1px solid ${C.grid};font:14px/1.5 ${FONT};color:${C.muted};">
  Still warm, no fresh news: ${names}
</td></tr>`;
}

export function hotListEmailHtml(input: {
  date: Date;
  entries: HotListEmailEntry[];
  warm: WarmEntry[];
  windowDays: number;
  appUrl: string;
}): string {
  const { entries, warm, appUrl } = input;
  const intro = entries.length
    ? `${entries.length === 1 ? "One account has" : `${entries.length} accounts have`} a fresh trigger in the last ${input.windowDays} days, hottest first.`
    : `No account has a fresh trigger from the last ${input.windowDays} days.`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(hotListSubject(input.date, entries.length))}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:24px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td style="font:700 22px/1.2 ${FONT};letter-spacing:-0.5px;color:${C.ink};padding:0 0 6px 0;">Hot List &middot; ${esc(emailDate(input.date))}</td></tr>
    <tr><td style="font:14px/1.5 ${FONT};color:${C.muted};padding:0 0 14px 0;">${esc(intro)}</td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${entries.map((e) => entryRow(e, appUrl)).join("")}
        ${warmRows(warm, appUrl)}
      </table>
    </td></tr>
    <tr><td style="padding:16px 0 0 0;border-bottom:1px solid ${C.grid};"></td></tr>
    <tr><td style="padding:10px 0 0 0;font:12px/1.5 ${FONT};color:${C.muted};">
      Each company links to its analysis on the <a href="${appUrl}" style="color:${C.muted};">dashboard</a>.<br/>${esc(SITE.disclaimer)}
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}
