// Header composition: overlapping quarter and half circles on a 3x2 grid of squares.
export function Arcs() {
  return (
    <svg className="arcs" viewBox="0 0 300 200" role="img" aria-label="Abstract arcs">
      <rect x="0" y="0" width="100" height="100" fill="var(--cream)" />
      <path d="M0 100 A100 100 0 0 1 100 0 L100 100 Z" fill="var(--terracotta)" />
      <path d="M100 0 A100 100 0 0 1 200 100 L100 100 Z" fill="var(--green)" />
      <circle cx="150" cy="100" r="50" fill="var(--mauve)" />
      <path d="M200 0 L300 0 L300 100 A100 100 0 0 1 200 0 Z" fill="var(--sage)" />
      <rect x="0" y="100" width="100" height="100" fill="var(--sage)" />
      <path d="M0 100 A100 100 0 0 1 100 200 L0 200 Z" fill="var(--cream)" />
      <path d="M100 200 A100 100 0 0 1 200 100 L200 200 Z" fill="var(--terracotta)" />
      <path d="M200 200 A100 100 0 0 1 300 100 L300 200 Z" fill="var(--green)" />
      <circle cx="250" cy="150" r="22" fill="var(--cream)" />
      <g stroke="var(--line)" strokeWidth="1" fill="none">
        <path d="M100 0 V200 M200 0 V200 M0 100 H300" />
      </g>
      <g fill="var(--ink)">
        <circle cx="100" cy="100" r="2.5" />
        <circle cx="200" cy="100" r="2.5" />
      </g>
    </svg>
  );
}
