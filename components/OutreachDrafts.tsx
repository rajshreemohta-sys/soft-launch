"use client";

import { useState } from "react";

const LINKEDIN_LIMIT = 300;

// Drafts are editable here; nothing is sent from the dashboard. Buttons hand the draft to
// the user's own email (Gmail or mail app) or copy the note and open LinkedIn.
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

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("failed");
    }
  };

  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const person = props.contactName ?? props.contactTitle;
  const linkedin = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${props.contactName ?? props.contactTitle} ${props.company}`)}`;

  return (
    <div className="drafts">
      <p className="small muted">
        To: <strong className="ink">{props.contactName ? `${props.contactName}, ` : ""}{props.contactTitle}</strong>. Edit freely; nothing is sent until you send it yourself.
      </p>

      <div className="draft">
        <h4>Email</h4>
        <label className="field">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="field">
          Message
          <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="draft-actions">
          <a className="btn btn-sm btn-primary" href={gmail} target="_blank" rel="noopener noreferrer">Open in Gmail</a>
          <a className="btn btn-sm" href={mailto}>Open in mail app</a>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => copy("email", `Subject: ${subject}\n\n${body}`)}>
            {copied === "email" ? "Copied" : "Copy email"}
          </button>
        </div>
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
      {copied === "failed" && <p className="small muted">Your browser blocked copying; select the text and copy it manually.</p>}
    </div>
  );
}
