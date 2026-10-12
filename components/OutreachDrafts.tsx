"use client";

import { useEffect, useState } from "react";

const LINKEDIN_LIMIT = 300;

// Drafts are editable here. Sending happens from the user's own email: the buttons open a
// ready-to-send message (recipient, subject, body filled in) in Gmail or the mail app.
// The site never sends to third parties itself: it is public, and Resend's test sender
// only delivers to the account owner. The recipient address is remembered per company
// on this device only.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toKey = (company: string) => `shiftsense:to:${company}`;
export function OutreachDrafts(props: {
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
  const mailto = `mailto:${validTo ? recipient : ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
          <a className="btn btn-sm btn-primary" href={gmail} target="_blank" rel="noopener noreferrer">
            {validTo ? "Send with Gmail" : "Open in Gmail"}
          </a>
          <a className="btn btn-sm" href={mailto}>{validTo ? "Send with mail app" : "Open in mail app"}</a>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => copy("email", `${validTo ? `To: ${recipient}\n` : ""}Subject: ${subject}\n\n${body}`)}>
            {copied === "email" ? "Copied" : "Copy email"}
          </button>
        </div>
        <p className="small muted">
          {validTo
            ? "Opens a ready-to-send email to this address; press Send to deliver it from your account."
            : "Add their email to send directly; without it, the draft opens with an empty recipient."}
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
