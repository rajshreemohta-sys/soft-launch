import Link from "next/link";
import { SITE } from "@/lib/site";
import { Nav } from "./Nav";
import { RunControls } from "./RunControls";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        <svg className="wordmark-mark" viewBox="0 0 22 22" aria-hidden="true">
          <path d="M1 21 A20 20 0 0 1 21 1 L21 21 Z" fill="var(--terracotta)" />
          <path d="M8 21 A13 13 0 0 1 21 8 L21 21 Z" fill="var(--green)" />
        </svg>
        {SITE.name}
      </Link>
      <Nav />
      <RunControls />
    </header>
  );
}
