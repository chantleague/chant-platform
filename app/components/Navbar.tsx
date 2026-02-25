"use client";

import Link from "next/link";
import type { Brand } from "../brand-config";

type NavbarProps = {
  brand: Brand;
};

export function Navbar({ brand }: NavbarProps) {
  const items =
    brand.key === "chantleague"
      ? [
          { label: "Battles", href: "/battles" },
          { label: "Leaderboards", href: "/leaderboards" },
          { label: "Events", href: "/events" },
          { label: "Clubs", href: "/clubs" },
          { label: "Fixtures", href: "/fixtures" },
          { label: "Shop", href: "/shop" },
        ]
      : [
          { label: "Overview", href: "/" },
          { label: "Careers", href: "/careers" },
          { label: "Partners", href: "/partners" },
          { label: "Contact", href: "/contact" },
        ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold"
            style={{ borderColor: brand.primary, color: brand.primary }}
          >
            {brand.initials}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{brand.name}</div>
            <div className="text-[11px] text-zinc-400">{brand.tagline}</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-zinc-300 md:flex">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="hover:text-white">
              {i.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span
            className="rounded-full border px-3 py-1 text-xs"
            style={{ borderColor: brand.primary, color: brand.primary }}
          >
            {brand.key === "chantleague" ? "LIVE NOW" : "PRO"}
          </span>
        </div>
      </div>
    </header>
  );
}