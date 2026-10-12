import { SIGNAL_LABELS, type SignalType } from "./taxonomy";
import { DEAL_STAGE_LABELS, sourceLabel } from "./format";
import { SITE } from "./site";

// Hot List email. Table-based with inline styles so it survives email clients.
// Fonts fall back to Helvetica/Arial; colours come from the dashboard palette.

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
  sage: "#6E8761",
  blue: "#4F78A8",
  mauve: "#A3829A",
  cream: "#EFEBE1",
  ink: "#000000",
  line: "#D6D3CC",
  paper: "#FFFFFF",
  muted: "#5C5A55",
};

const TAG: Record<string, { bg: string; fg: string; border: string }> = {
  headcount_expansion: { bg: C.green, fg: C.paper, border: C.green },
  new_leader: { bg: C.blue, fg: C.paper, border: C.blue },
  workforce_digitalisation: { bg: C.sage, fg: C.ink, border: C.sage },
  funding: { bg: C.mauve, fg: C.ink, border: C.mauve },
  operational_challenge: { bg: C.paper, fg: C.ink, border: C.ink },
  other_relevant: { bg: C.cream, fg: C.ink, border: C.line },
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

function tag(type: string | null) {
  if (!type) return "";
  const t = TAG[type] ?? TAG.other_relevant;
  return `<span style="display:inline-block;background:${t.bg};color:${t.fg};border:1px solid ${t.border};border-radius:999px;padding:4px 10px;font:13px/1 ${FONT};white-space:nowrap;">${esc(SIGNAL_LABELS[type as SignalType] ?? type)}</span>`;
}

function entryBlock(e: HotListEmailEntry, appUrl: string) {
  const bar = TAG[e.signal_type] ?? TAG.other_relevant;
  const barText = e.signal_type === "headcount_expansion" || e.signal_type === "new_leader" ? C.paper : C.ink;
  const stage = e.deal_stage ? DEAL_STAGE_LABELS[e.deal_stage] ?? e.deal_stage : "";
  return `
<tr><td style="padding:0 0 20px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="64" valign="top" style="font:500 40px/1 ${FONT};letter-spacing:-2px;color:${C.ink};padding-top:2px;">${String(e.rank).padStart(2, "0")}</td>
      <td valign="top">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.ink};border-radius:12px;border-collapse:separate;">
          <tr><td style="background:${bar.bg};border-bottom:1px solid ${C.ink};border-radius:11px 11px 0 0;padding:7px 12px;font:600 14px/1.2 ${FONT};color:${barText};">
            <span style="letter-spacing:2px;">&#9679;&#9679;&#9679;</span>&nbsp;&nbsp;${esc(e.company_name)}
          </td></tr>
          <tr><td style="padding:16px 16px 14px 16px;font:15px/1.5 ${FONT};color:${C.ink};">
            <div style="margin:0 0 10px 0;">${tag(e.signal_type)}${stage ? `&nbsp;<span style="display:inline-block;border:1px solid ${C.line};border-radius:999px;padding:4px 10px;font:13px/1 ${FONT};">${esc(stage)}</span>` : ""}</div>
            <div style="font:17px/1.4 ${FONT};margin:0 0 12px 0;">${esc(e.one_line_summary)}</div>
            <div style="border-left:2px solid ${C.ink};padding:0 0 0 12px;margin:0 0 14px 0;">
              <div style="font:12px/1.4 ${FONT};color:${C.muted};">Outreach angle</div>
              <div>${esc(e.outreach_angle)}</div>
            </div>
            <div style="border-top:1px solid ${C.line};padding-top:10px;font:13px/1.5 ${FONT};color:${C.muted};">
              <a href="${esc(e.source_url)}" style="color:${C.ink};">${esc(sourceLabel(e.source_name, e.source_url))}</a>
              &nbsp;&middot;&nbsp;${esc(istDate(e.published_at, { day: "numeric", month: "short" }))}
              &nbsp;&middot;&nbsp;<a href="${appUrl}/accounts/${e.account_id}" style="color:${C.ink};">Open in dashboard</a>
              &nbsp;&middot;&nbsp;Score ${e.score.toFixed(1)}
            </div>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>`;
}

function warmBlock(warm: WarmEntry[], appUrl: string) {
  if (!warm.length) return "";
  const rows = warm
    .map(
      (w) => `<tr><td style="padding:10px 0;border-top:1px solid ${C.line};font:14px/1.5 ${FONT};color:${C.ink};">
        <a href="${appUrl}/accounts/${w.account_id}" style="color:${C.ink};font-weight:600;">${esc(w.company_name)}</a>
        ${w.signal_type ? `&nbsp;${tag(w.signal_type)}` : ""}<br/>
        <span style="color:${C.muted};">${esc(w.summary ?? "")}${w.signal_date ? ` (${esc(istDate(w.signal_date, { day: "numeric", month: "short" }))})` : ""} &middot; Score ${w.score.toFixed(1)}</span>
      </td></tr>`
    )
    .join("");
  return `
<tr><td style="padding:8px 0 24px 0;">
  <div style="font:600 16px/1.3 ${FONT};color:${C.ink};margin:0 0 4px 0;">Still warm, no fresh news</div>
  <div style="font:13px/1.5 ${FONT};color:${C.muted};margin:0 0 8px 0;">Next highest scores. No new signal in the last few days, so these are not on the Hot List.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
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
    ? `${entries.length === 1 ? "One account has" : `${entries.length} accounts have`} a fresh trigger from the last ${input.windowDays} days. Ranked by signal score.`
    : `No account has a fresh trigger from the last ${input.windowDays} days.`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(hotListSubject(input.date, entries.length))}</title></head>
<body style="margin:0;padding:0;background:${C.cream};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:${C.paper};border:1px solid ${C.line};">
    <tr><td style="padding:22px 24px;border-bottom:1px solid ${C.line};font:600 18px/1 ${FONT};color:${C.ink};">
      <span style="color:${C.blue};letter-spacing:-1px;">((</span><span style="color:${C.green};">&#9679;</span><span style="color:${C.blue};letter-spacing:-1px;">))</span> ${esc(SITE.name)}
    </td></tr>
    <tr><td style="padding:28px 24px 8px 24px;">
      <div style="font:600 30px/1.1 ${FONT};letter-spacing:-1px;color:${C.ink};margin:0 0 12px 0;">Hot List &middot; ${esc(emailDate(input.date))}</div>
      <div style="font:15px/1.5 ${FONT};color:${C.muted};margin:0 0 24px 0;">${esc(intro)}</div>
    </td></tr>
    <tr><td style="padding:0 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${entries.map((e) => entryBlock(e, appUrl)).join("")}
        ${warmBlock(warm, appUrl)}
      </table>
    </td></tr>
    <tr><td style="padding:4px 24px 24px 24px;">
      <a href="${appUrl}" style="display:inline-block;background:${C.green};color:${C.paper};text-decoration:none;border-radius:999px;padding:11px 20px;font:600 14px/1 ${FONT};">Open the dashboard</a>
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid ${C.line};background:${C.cream};font:12px/1.5 ${FONT};color:${C.muted};">
      ${esc(SITE.disclaimer)}<br/>Signals are chosen by Gemini Flash from Google News and The Ken headlines; each links to its source.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}
