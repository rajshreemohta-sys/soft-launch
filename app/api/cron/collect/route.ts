import { isCronRequest, unauthorized } from "@/lib/auth";
import { runCollect } from "@/lib/collect";

// Daily collect (Vercel Cron, ~6:00 AM IST, plus ~7:00 AM IST to finish the rest).
// Each run stops cleanly at ~250 s (about 25 accounts on Vercel); the next run, or the
// Hot List's pre-collect, continues with the least recently checked accounts.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) return unauthorized();
  const result = await runCollect({ deadlineMs: 250_000 });
  return Response.json(result);
}
