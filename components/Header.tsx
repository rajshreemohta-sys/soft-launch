import Link from "next/link";
import { SITE } from "@/lib/site";
import { LogoMark } from "./Logo";
import { Nav } from "./Nav";
import { RunControls } from "./RunControls";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        <LogoMark />
        {SITE.name}
      </Link>
      <Nav />
      <RunControls />
    </header>
  );
}
