import { isCronRequest, unauthorized } from "@/lib/auth";
import { runHotList } from "@/lib/hotlist";

// Hot List (Vercel Cron, ~8:00 AM IST Monday and Thursday).
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) return unauthorized();
  const r = await runHotList({ collectDeadlineMs: 150_000 });
  return Response.json({ subject: r.subject, entries: r.entries.length, warm: r.warm.length, dryRun: r.dryRun, sent: !!r.emailId, error: r.sendError });
}
