"use client";

import { useEffect, useId, useRef, useState } from "react";

export type Tab = { id: string; label: string; count?: number; content: React.ReactNode };

// Accessible tabs (arrow keys move between tabs). The open tab is kept in the URL hash
// (#analysis, #drafts...) so a link can open a specific tab.
export function Tabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const select = (id: string, focus = false) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    if (focus) refs.current[tabs.findIndex((t) => t.id === id)]?.focus();
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = tabs.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    select(tabs[next].id, true);
  };

  return (
    <div className="tabs">
      <div className="tablist" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${uid}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            aria-controls={`${uid}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            className="tab"
            onClick={() => select(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
            {t.count !== undefined && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`${uid}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${t.id}`}
          hidden={active !== t.id}
          className="tabpanel"
          tabIndex={0}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
