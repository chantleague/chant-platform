"use client";

import Link from "next/link";
import { useState } from "react";

const navItems = [
  { href: "/battles", label: "Battles" },
  { href: "/clubs", label: "Clubs" },
  { href: "/events", label: "Events" },
  { href: "/leaderboards", label: "Leaderboard" },
];

const linkClassName = "transition-colors hover:text-green-400";

export default function MainHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-black text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 lg:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight hover:text-green-400">
          Chant League
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={linkClassName}>
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
          className="inline-flex items-center justify-center rounded border border-zinc-700 p-2 text-zinc-200 transition-colors hover:border-zinc-500 hover:text-green-400 md:hidden"
          onClick={() => setIsOpen((previous) => !previous)}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-zinc-800 bg-black md:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 text-sm lg:px-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClassName}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}