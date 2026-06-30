"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Ghost from "./Ghost";

const NAV = [
  { href: "/stories", label: "Stories", tour: "nav-stories", match: (p: string) => p === "/stories" || p.startsWith("/story/") },
  { href: "/voices", label: "Voices", tour: "nav-voices", match: (p: string) => p.startsWith("/voices") },
];

function navClass(active: boolean): string {
  return `rounded-lg px-3 py-1.5 font-medium transition ${
    active ? "bg-control text-ink" : "text-ink-soft hover:bg-control/60 hover:text-ink"
  }`;
}

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="group flex items-center gap-1.5 font-serif text-xl font-semibold tracking-tight transition-opacity hover:opacity-80"
        >
          <Ghost size={26} className="text-ai transition-transform group-hover:-translate-y-0.5" />
          <span>Pen<span className="text-ai">ghost</span></span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} data-tour={item.tour} className={navClass(item.match(pathname))}>
              {item.label}
            </Link>
          ))}
          <Link
            href="/"
            data-tour="nav-new"
            className="ml-1 rounded-lg bg-go px-3.5 py-1.5 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover"
          >
            + New story
          </Link>
        </nav>
      </div>
    </header>
  );
}
