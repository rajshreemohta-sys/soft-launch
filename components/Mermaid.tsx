"use client";

import { useEffect, useId, useRef, useState } from "react";

// Renders a Mermaid diagram in the browser. Mermaid is loaded only on the page that needs it.
export function Mermaid({ chart, label }: { chart: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  const [failed, setFailed] = useState(false);
  const [themeKey, setThemeKey] = useState(0);

  // Redraw when the theme changes (toggle or system setting).
  useEffect(() => {
    const bump = () => setThemeKey((k) => k + 1);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("themechange", bump);
    mq.addEventListener("change", bump);
    return () => {
      window.removeEventListener("themechange", bump);
      mq.removeEventListener("change", bump);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const css = getComputedStyle(document.documentElement);
      const v = (name: string) => css.getPropertyValue(name).trim();
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          themeVariables: {
            background: v("--paper"),
            primaryColor: v("--cream"),
            primaryBorderColor: v("--ink"),
            primaryTextColor: v("--ink"),
            lineColor: v("--ink"),
            textColor: v("--ink"),
            secondaryColor: v("--paper"),
            tertiaryColor: v("--paper"),
            clusterBkg: v("--paper"),
            clusterBorder: v("--line"),
            edgeLabelBackground: v("--paper"),
            fontSize: "15px",
          },
          flowchart: { curve: "basis", htmlLabels: true, wrappingWidth: 170, nodeSpacing: 28, rankSpacing: 44, padding: 10 },
        });
        const { svg } = await mermaid.render(`m${id}${themeKey}`, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id, themeKey]);

  return (
    <div className="diagram" role="img" aria-label={label}>
      {failed ? <pre className="small">{chart}</pre> : <div ref={ref}><p className="muted small">Drawing diagram…</p></div>}
    </div>
  );
}
