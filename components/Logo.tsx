// Signal mark: a source dot with waves on both sides. Original artwork.
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <circle cx="16" cy="16" r="3.6" fill="var(--green)" />
      <g fill="none" strokeLinecap="round" strokeWidth="2.6">
        <path d="M11 11.2a7 7 0 0 0 0 9.6M21 11.2a7 7 0 0 1 0 9.6" stroke="var(--green)" />
        <path d="M7.2 7.6a12.5 12.5 0 0 0 0 16.8M24.8 7.6a12.5 12.5 0 0 1 0 16.8" stroke="var(--terracotta)" />
        <path d="M3.4 4a18 18 0 0 0 0 24M28.6 4a18 18 0 0 1 0 24" stroke="var(--mauve)" />
      </g>
    </svg>
  );
}
