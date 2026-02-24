"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Brand, BrandKey } from "../brand-config";
import { brands } from "../brand-config";

type NavbarProps = {
  brand: Brand;
};

export function Navbar({ brand }: NavbarProps) {
  const searchParams = useSearchParams();
  const overrideParam = searchParams.get("brand");
  const overrideKey = (overrideParam?.toLowerCase() ?? "") as BrandKey;
  const overrideBrand =
    overrideKey && overrideKey in brands ? brands[overrideKey] : null;

  const activeBrand = overrideBrand ?? brand;
  const initials = activeBrand.name
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-xs font-bold tracking-tight"
            style={{
              borderColor: activeBrand.primaryColor,
              color: activeBrand.primaryColor,
            }}
          >
            {initials}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
              Multi-League
            </span>
            <span className="text-sm font-semibold text-zinc-50">
              {activeBrand.name}
            </span>
          </div>
        </Link>
        <nav className="hidden items-center gap-4 text-xs font-medium text-zinc-300 md:flex lg:gap-6">
          <Link
            href="/battles"
            className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
          >
            Battles
          </Link>
          <Link
            href="/leaderboards"
            className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
          >
            Leaderboards
          </Link>
          <Link
            href="/events"
            className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
          >
            Events
          </Link>
          {activeBrand.theme === "football" ? (
            <>
              <Link
                href="/clubs"
                className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
              >
                Clubs
              </Link>
              <Link
                href="/fixtures"
                className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
              >
                Fixtures
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/careers"
                className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
              >
                Careers
              </Link>
              <Link
                href="/students"
                className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
              >
                Students
              </Link>
              <Link
                href="/professionals"
                className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
              >
                Professionals
              </Link>
            </>
          )}
          <Link
            href="/shop"
            className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
          >
            Shop
          </Link>
          <Link
            href="/resources"
            className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
          >
            Resources
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-zinc-500 sm:inline">
            Live Arena
          </span>
          <div
            className="flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]"
            style={{
              backgroundColor: `${activeBrand.primaryColor}20`,
              color: activeBrand.primaryColor,
              boxShadow: `0 0 25px ${activeBrand.primaryColor}66`,
            }}
          >
            <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live Now
          </div>
        </div>
      </div>
    </header>
  );
}

