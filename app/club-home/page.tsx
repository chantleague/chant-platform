/**
 * Club Home Page
 * 
 * Shows battles relevant to the user's selected club.
 * This is the post-login/onboarding default view.
 */

"use client";

import Link from "next/link";
import { useSelectedClub } from "@/app/hooks/useSelectedClub";
import { BattleCard } from "@/app/components/BattleCard";
import { ClubSelector } from "@/app/components/ClubSelector";
import { mockBattles } from "@/app/lib/mockBattles";
import { getDisplayName } from "@/app/lib/canonicalClubRegistry";

export default function ClubHome() {
  const [selectedClub, setSelectedClub] = useSelectedClub();

  if (selectedClub === null) {
    // Still loading
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!selectedClub) {
    // No club selected - show selector
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-6">
          <h1 className="text-3xl font-bold">Welcome to Chant Platform</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Select your club to see battles and exclusive content tailored to your team.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/30 p-6">
          <label className="block text-sm font-semibold text-zinc-200 mb-3">
            Which is your club?
          </label>
          <div className="max-w-xs">
            <ClubSelector
              selectedClub={selectedClub}
              onSelectClub={setSelectedClub}
              showAllClubs={true}
            />
          </div>
        </div>
      </div>
    );
  }

  // Get club display name
  const clubName = getDisplayName(selectedClub);

  if (!clubName) {
    return (
      <div className="rounded-2xl border border-red-800 bg-red-900/20 p-6">
        <p className="text-sm text-red-300">Unknown club selected</p>
      </div>
    );
  }

  // Filter battles involving this club
  // In a real app, these would be fetched from a database
  const relatedBattles = mockBattles.filter(
    (battle) =>
      battle.slug.includes(selectedClub) ||
      battle.title.toLowerCase().includes(clubName.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
          {clubName} • Home Feed
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          {clubName}&apos;s Chant Battles
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Join your fellow {clubName} supporters in exclusive chant battles. Get louder. Get
          noticed.
        </p>

        <div className="mt-4">
          <button
            onClick={() => setSelectedClub("")}
            className="text-xs uppercase tracking-widest text-blue-400 hover:text-blue-300"
          >
            ← Change Club
          </button>
        </div>
      </div>

      {relatedBattles.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {relatedBattles.map((battle) => (
            <BattleCard
              key={battle.slug}
              slug={battle.slug}
              title={battle.title}
              subtitle={battle.description}
              status="upcoming"
              tag="League"
              metricLabel="Voters"
              metricValue={battle.stats.voters.toLocaleString()}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-black/30 p-6 text-center">
          <p className="text-sm text-zinc-400">
            No upcoming battles for {clubName} yet. Check back soon!
          </p>
          <Link href="/battles" className="mt-4 inline-block text-xs uppercase tracking-widest text-blue-400 hover:text-blue-300">
            View All Battles →
          </Link>
        </div>
      )}
    </div>
  );
}
