import Link from "next/link";
import { SITE } from "@/lib/site";
import { LogoMark } from "./Logo";
import { Nav } from "./Nav";
import { RunControls } from "./RunControls";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        <LogoMark />
        {SITE.name}
      </Link>
      <Nav />
      <div className="header-actions">
        <RunControls />
        <ThemeToggle />
      </div>
    </header>
  );
}
