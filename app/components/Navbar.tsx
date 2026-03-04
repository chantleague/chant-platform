"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { mockBattles } from "../lib/mockBattles";
import type { Brand, BrandKey } from "../brand-config";
import { brands } from "../brand-config";
import { useSelectedClub } from "../hooks/useSelectedClub";
import { ClubSelector } from "./ClubSelector";

type NavbarProps = {
  brand: Brand;
};

export default function Navbar({ brand }: NavbarProps) {
  const searchParams = useSearchParams();
  const overrideParam = searchParams.get("brand");
  const [selectedClub, setSelectedClub] = useSelectedClub();

  const overrideKey = (overrideParam?.toLowerCase() ?? "") as BrandKey;
  const overrideBrand = overrideKey in brands ? brands[overrideKey] : null;

  const activeBrand = overrideBrand ?? brand;

  const initials = activeBrand.name
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 lg:px-6">
        {/* Top row: Logo and nav */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold"
              style={{
                borderColor: activeBrand.primary,
                color: activeBrand.primary,
              }}
            >
              {initials}
            </div>

            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-zinc-100">{activeBrand.name}</span>
              <span className="text-xs text-zinc-400">Multi-tenant platform</span>
            </div>
          </Link>

          <nav className="flex items-center gap-4 text-xs uppercase tracking-widest text-zinc-300">
            {/* featured battle link */}
            <Link
              href={
                mockBattles.length > 0
                  ? `/battle/${mockBattles[0].slug}`
                  : "/battle"
              }
              className="hover:text-white"
            >
              Battle
            </Link>
            <Link href="/battles" className="hover:text-white">
              Battles
            </Link>
            <Link href="/leaderboards" className="hover:text-white">
              Leaderboards
            </Link>
            <Link href="/events" className="hover:text-white">
              Events
            </Link>
            <Link href="/clubs" className="hover:text-white">
              Clubs
            </Link>
          </nav>
        </div>

        {/* Club selector row */}
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-widest text-zinc-400">
            Your Club:
          </label>
          <div className="w-48">
            <ClubSelector
              selectedClub={selectedClub}
              onSelectClub={setSelectedClub}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
