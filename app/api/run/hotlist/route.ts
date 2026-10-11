import { runHotList } from "@/lib/hotlist";
import { HOTLIST_COOLDOWN_MIN, HOTLIST_DAILY_CAP, hotListCooldownMinutesLeft, hotListsToday } from "@/lib/runGuards";

// "Send Hot List now" button. Respects DRY_RUN. Public (no passcode), so it can run at
// most once every HOTLIST_COOLDOWN_MIN minutes and HOTLIST_DAILY_CAP times a day.
export const maxDuration = 300;

export async function POST() {
  const wait = await hotListCooldownMinutesLeft();
  if (wait > 0) {
    return Response.json(
      { error: `A Hot List was built in the last ${HOTLIST_COOLDOWN_MIN} minutes. Try again in ${wait} min.` },
      { status: 429 }
    );
  }
  if ((await hotListsToday()) >= HOTLIST_DAILY_CAP) {
    return Response.json({ error: "Today's Hot List limit is reached. Try again tomorrow." }, { status: 429 });
  }
  const r = await runHotList({ collectDeadlineMs: 150_000 });
  return Response.json({ subject: r.subject, entries: r.entries.length, warm: r.warm.length, dryRun: r.dryRun, sent: !!r.emailId, error: r.sendError });
}
