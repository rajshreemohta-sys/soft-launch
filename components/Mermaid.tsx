"use client";

import { useEffect, useId, useRef, useState } from "react";

// Renders a Mermaid diagram in the browser. Mermaid is loaded only on the page that needs it.
export function Mermaid({ chart, label }: { chart: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          themeVariables: {
            primaryColor: "#EFEBE1",
            primaryBorderColor: "#000000",
            primaryTextColor: "#000000",
            lineColor: "#000000",
            secondaryColor: "#FFFFFF",
            tertiaryColor: "#FFFFFF",
            clusterBkg: "#FFFFFF",
            clusterBorder: "#D6D3CC",
            fontSize: "15px",
          },
          flowchart: { curve: "basis", htmlLabels: true, wrappingWidth: 170, nodeSpacing: 28, rankSpacing: 44, padding: 10 },
        });
        const { svg } = await mermaid.render(`m${id}`, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  return (
    <div className="diagram" role="img" aria-label={label}>
      {failed ? <pre className="small">{chart}</pre> : <div ref={ref}><p className="muted small">Drawing diagram…</p></div>}
    </div>
  );
}
