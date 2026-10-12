import { hasSendPasscode } from "@/lib/auth";
import { sendOutreach } from "@/lib/outreach";

// Send button on the Outreach drafts tab. Passcode-protected; approved test recipients only.
export async function POST(request: Request) {
  if (!hasSendPasscode(request)) {
    return Response.json({ error: "Wrong passcode." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { accountId?: string; to?: string; subject?: string; body?: string } | null;
  if (!body || typeof body.to !== "string" || typeof body.subject !== "string" || typeof body.body !== "string") {
    return Response.json({ error: "Missing fields." }, { status: 400 });
  }
  const accountId = typeof body.accountId === "string" && /^[0-9a-f-]{36}$/i.test(body.accountId) ? body.accountId : null;
  const result = await sendOutreach({ accountId, to: body.to, subject: body.subject, body: body.body });
  return result.ok ? Response.json({ id: result.id }) : Response.json({ error: result.error }, { status: result.status });
}
