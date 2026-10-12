"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/", label: "Hot List" },
  { href: "/accounts", label: "Accounts" },
];

// The active link depends on the URL, which is only known at request time on dynamic
// pages, so it streams in; the fallback is the same nav without the active state.
export function Nav() {
  return (
    <Suspense fallback={<Links path={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <Links path={usePathname()} />;
}

function Links({ path }: { path: string | null }) {
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => {
        const active = path !== null && (l.href === "/" ? path === "/" : path.startsWith(l.href));
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
