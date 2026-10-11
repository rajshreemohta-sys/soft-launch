import { hasRunPasscode, unauthorized } from "@/lib/auth";
import { runHotList } from "@/lib/hotlist";

// "Send Hot List now" button. Respects DRY_RUN.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!hasRunPasscode(request)) return unauthorized();
  const r = await runHotList({ collectDeadlineMs: 150_000 });
  return Response.json({ subject: r.subject, entries: r.entries.length, warm: r.warm.length, dryRun: r.dryRun, sent: !!r.emailId, error: r.sendError });
}
