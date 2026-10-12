"use client";

import { useEffect, useState } from "react";

const LINKEDIN_LIMIT = 300;

// Drafts are editable here. "Send" sends from the site through Resend, protected by a
// passcode and limited to approved test recipients (the product is fictional; the
// executives are real). "Open in Gmail" hands the draft to the user's own email for
// anyone else. The recipient address is remembered per company on this device only.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toKey = (company: string) => `shiftsense:to:${company}`;
const PASS_KEY = "shiftsense:send-passcode";

function readPass(): string {
  try {
    return sessionStorage.getItem(PASS_KEY) ?? "";
  } catch {
    return "";
  }
}

function savePass(value: string | null) {
  try {
    if (value) sessionStorage.setItem(PASS_KEY, value);
    else sessionStorage.removeItem(PASS_KEY);
  } catch {
    /* storage unavailable: asked again next time */
  }
}

type SendState = { kind: "idle" } | { kind: "need-pass" } | { kind: "sending" } | { kind: "sent"; to: string } | { kind: "error"; message: string };
export function OutreachDrafts(props: {
  accountId: string;
  company: string;
  contactName: string | null;
  contactTitle: string;
  subject: string;
  body: string;
  linkedinNote: string;
}) {
  const [subject, setSubject] = useState(props.subject);
  const [body, setBody] = useState(props.body);
  const [note, setNote] = useState(props.linkedinNote);
  const [copied, setCopied] = useState<string | null>(null);
  const [to, setTo] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(toKey(props.company));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setTo(saved);
    } catch {
      /* storage unavailable */
    }
  }, [props.company]);

  const updateTo = (value: string) => {
    setTo(value);
    try {
      if (EMAIL_RE.test(value.trim())) localStorage.setItem(toKey(props.company), value.trim());
      else if (!value.trim()) localStorage.removeItem(toKey(props.company));
    } catch {
      /* storage unavailable */
    }
  };

  const recipient = to.trim();
  const validTo = EMAIL_RE.test(recipient);

  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const [pass, setPass] = useState("");

  const doSend = async (passcode: string) => {
    if (!validTo) {
      setSend({ kind: "error", message: "Add the recipient\u2019s email address first." });
      return;
    }
    setSend({ kind: "sending" });
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-send-passcode": passcode },
        body: JSON.stringify({ accountId: props.accountId, to: recipient, subject, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        savePass(null);
        setPass("");
        setSend({ kind: "need-pass" });
        return;
      }
      if (!res.ok) {
        setSend({ kind: "error", message: data.error ?? "Couldn\u2019t send the email." });
        return;
      }
      savePass(passcode);
      setSend({ kind: "sent", to: recipient });
    } catch {
      setSend({ kind: "error", message: "Couldn\u2019t reach the server. Check your connection." });
    }
  };

  const onSendClick = () => {
    const saved = readPass();
    if (saved) void doSend(saved);
    else setSend({ kind: "need-pass" });
  };

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("failed");
    }
  };

  const toParam = validTo ? `&to=${encodeURIComponent(recipient)}` : "";
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1${toParam}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const person = props.contactName ?? props.contactTitle;
  const linkedin = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${props.contactName ?? props.contactTitle} ${props.company}`)}`;

  return (
    <div className="drafts">
      <p className="small muted drafts-to">
        For: <strong className="ink">{props.contactName ? `${props.contactName}, ` : ""}{props.contactTitle}</strong>. Edit freely; it goes out from your own email when you press send.
      </p>

      <div className="drafts-grid">
      <div className="draft">
        <h4>Email</h4>
        <label className="field">
          To
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={`${(props.contactName ?? "name").split(" ")[0].toLowerCase()}@company.com`}
            value={to}
            onChange={(e) => updateTo(e.target.value)}
            aria-invalid={recipient !== "" && !validTo}
          />
          {recipient !== "" && !validTo && <span className="field-error">That doesn&rsquo;t look like an email address.</span>}
        </label>
        <label className="field">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="field">
          Message
          <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="draft-actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={onSendClick} disabled={send.kind === "sending"}>
            {send.kind === "sending" ? "Sending\u2026" : "Send"}
          </button>
          <a className="btn btn-sm btn-ghost" href={gmail} target="_blank" rel="noopener noreferrer">Open in Gmail</a>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => copy("email", `${validTo ? `To: ${recipient}\n` : ""}Subject: ${subject}\n\n${body}`)}>
            {copied === "email" ? "Copied" : "Copy email"}
          </button>
        </div>
        {send.kind === "need-pass" && (
          <form
            className="send-pass"
            onSubmit={(e) => {
              e.preventDefault();
              if (pass) void doSend(pass);
            }}
          >
            <label className="field">
              Send passcode
              <input type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
            </label>
            <button type="submit" className="btn btn-sm btn-primary" disabled={!pass}>Confirm and send</button>
          </form>
        )}
        <p className="send-status" aria-live="polite">
          {send.kind === "sent" && <>Sent to {send.to}.</>}
          {send.kind === "error" && <span className="field-error">{send.message}</span>}
          {send.kind === "need-pass" && readPass() === "" && pass === "" && <span className="muted">Enter the passcode to send.</span>}
        </p>
      </div>

      <div className="draft">
        <h4>LinkedIn note</h4>
        <label className="field">
          Connection note <span className={note.length > LINKEDIN_LIMIT ? "over" : ""}>{note.length}/{LINKEDIN_LIMIT}</span>
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="draft-actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={() => copy("note", note)}>
            {copied === "note" ? "Copied" : "Copy note"}
          </button>
          <a className="btn btn-sm" href={linkedin} target="_blank" rel="noopener noreferrer">Find {person} on LinkedIn</a>
        </div>
      </div>
      </div>
      {copied === "failed" && <p className="small muted">Your browser blocked copying; select the text and copy it manually.</p>}
    </div>
  );
}
