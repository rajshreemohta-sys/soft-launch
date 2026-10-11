import { hasRunPasscode, unauthorized } from "@/lib/auth";
import { runCollect } from "@/lib/collect";

// "Run collection now" button. Each call checks a batch of accounts that have not been
// checked since the button was clicked (startedAt) and returns progress; the button keeps
// calling until remaining is 0.
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!hasRunPasscode(request)) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { startedAt?: string };
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
  if (Number.isNaN(startedAt.getTime())) return Response.json({ error: "Bad startedAt" }, { status: 400 });

  const r = await runCollect({ checkedBefore: startedAt, deadlineMs: 45_000 });
  return Response.json({ processed: r.processed, remaining: r.remaining, signalsFound: r.signalsFound, errors: r.errors });
}
