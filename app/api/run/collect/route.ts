import { runCollect } from "@/lib/collect";
import { collectIsRunning } from "@/lib/runGuards";

// "Run collection now" button. Each call checks a batch of accounts that have not been
// checked since the button was clicked (startedAt) and returns progress; the button keeps
// calling until remaining is 0. Public (no passcode), so it refuses to overlap another run.
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { startedAt?: string };
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
  if (Number.isNaN(startedAt.getTime()) || startedAt.getTime() > Date.now() + 60_000) {
    return Response.json({ error: "Bad startedAt" }, { status: 400 });
  }
  if (await collectIsRunning()) {
    return Response.json({ error: "A collection is already running. Try again in a few minutes." }, { status: 429 });
  }

  const r = await runCollect({ checkedBefore: startedAt, deadlineMs: 45_000 });
  return Response.json({ processed: r.processed, remaining: r.remaining, signalsFound: r.signalsFound, errors: r.errors });
}
