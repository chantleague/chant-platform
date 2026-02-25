"use client";

import Link from "next/link";
import type { Brand } from "../brand-config";

export default function Navbar({ brand }: { brand: Brand }) {
  const initials = brand.name
    .split(" ")
    .map((w) => w[0])
    .join("");

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-xs font-bold"
            style={{ borderColor: brand.primary, color: brand.primary }}
          >
            {initials}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{brand.name}</div>
            <div className="text-[11px] text-zinc-400">
              Multi-League Platform
            </div>
          </div>
        </Link>

        <nav className="hidden gap-5 text-sm text-zinc-300 md:flex">
          <Link href="/battles">Battles</Link>
          <Link href="/leaderboards">Leaderboards</Link>
          <Link href="/events">Events</Link>
          <Link href="/clubs">Clubs</Link>
          <Link href="/fixtures">Fixtures</Link>
          <Link href="/shop">Shop</Link>
          <Link href="/resources">Resources</Link>
        </nav>

        <div
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: brand.primary + "22", color: brand.primary }}
        >
          LIVE NOW
        </div>
      </div>
    </header>
  );
}