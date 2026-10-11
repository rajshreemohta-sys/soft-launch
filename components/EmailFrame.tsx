"use client";

import { useRef } from "react";

// Shows the stored email HTML in a sandboxed frame (no scripts) that grows to fit its content.
export function EmailFrame({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const fit = () => {
    const doc = ref.current?.contentDocument;
    if (doc && ref.current) ref.current.style.height = `${doc.documentElement.scrollHeight + 4}px`;
  };
  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={fit}
      style={{ width: "100%", height: 1200, border: "1px solid var(--line)", borderRadius: 14, display: "block" }}
    />
  );
}
