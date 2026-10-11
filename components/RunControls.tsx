"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Job = "collect" | "hotlist";

// "Run collection now" and "Send Hot List now". Public; the server rate-limits them.
export function RunControls() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [job, setJob] = useState<Job>("collect");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);

  const open = (j: Job) => {
    setJob(j);
    setStatus("");
    setDone(false);
    dialog.current?.showModal();
  };

  const call = async (path: string, body?: object) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `The server returned ${res.status}.`);
    return data;
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    try {
      if (job === "collect") {
        const startedAt = new Date().toISOString();
        let checked = 0;
        let found = 0;
        setStatus("Checking the news for every account…");
        for (let round = 0; round < 20; round++) {
          const r = await call("/api/run/collect", { startedAt });
          checked += r.processed;
          found += r.signalsFound;
          setStatus(`Checked ${checked} accounts, ${r.remaining} to go. ${found} new signals so far…`);
          if (r.remaining === 0 || r.processed === 0) break;
        }
        setStatus(`Done. Checked ${checked} accounts and found ${found} new signals. Scores are updated.`);
      } else {
        setStatus("Building the Hot List. This takes about a minute…");
        const r = await call("/api/run/hotlist");
        setStatus(
          r.dryRun
            ? `Built "${r.subject}" as a dry run. It was not emailed; see Email preview.`
            : r.sent
              ? `Sent "${r.subject}" to Arjun.`
              : `Built "${r.subject}" but the email failed: ${r.error}`
        );
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const title = job === "collect" ? "Run collection now" : "Send Hot List now";

  return (
    <>
      <div className="run-controls">
        <button type="button" className="btn btn-sm" onClick={() => open("collect")}>
          Run collection now
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => open("hotlist")}>
          Send Hot List now
        </button>
      </div>

      <dialog ref={dialog} className="run-dialog" aria-labelledby="run-title" onClose={() => !busy && setStatus("")}>
        <form onSubmit={run}>
          <h2 id="run-title" className="display" style={{ fontSize: 28 }}>{title}</h2>
          <p className="muted small" style={{ margin: "8px 0 20px" }}>
            {job === "collect"
              ? "Fetches today’s news for all 40 accounts, classifies it with Gemini Flash and rescores every account. About 4 minutes."
              : "Builds the top 10 with fresh outreach angles and emails it to Arjun, unless dry-run mode is on."}
          </p>
          <p className="run-status" aria-live="polite">{status}</p>
          <div className="run-actions">
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()} disabled={busy}>
              {done ? "Close" : "Cancel"}
            </button>
            {!done && (
              <button type="submit" className={`btn ${job === "hotlist" ? "btn-primary" : ""}`} disabled={busy} autoFocus>
                {busy ? "Running…" : job === "collect" ? "Run collection" : "Send Hot List"}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
