"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Horizontal row of boxes: scroll, swipe, or use the arrow buttons (one box per step).
export function Carousel({ label, children }: { label: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const step = (dir: 1 | -1) => {
    const el = track.current;
    const box = el?.querySelector<HTMLElement>(":scope > *");
    if (!el || !box) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (box.offsetWidth + 16), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className={`carousel${atEnd ? " at-end" : ""}`}>
      <div ref={track} className="carousel-track" role="region" aria-label={label} tabIndex={0} onScroll={update}>
        {children}
      </div>
      <div className="carousel-nav">
        <button type="button" className="round-btn" aria-label="Previous leads" onClick={() => step(-1)} disabled={atStart}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="round-btn" aria-label="Next leads" onClick={() => step(1)} disabled={atEnd}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}
