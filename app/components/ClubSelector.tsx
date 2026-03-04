/**
 * Club Selector Component
 * 
 * Dropdown to select a user's club.
 * Used in navbar and onboarding flows.
 */

"use client";

import { useState } from "react";
import { CanonicalClub, CANONICAL_CLUB_REGISTRY, League } from "@/app/lib/canonicalClubRegistry";

interface ClubSelectorProps {
  selectedClub: string | null;
  onSelectClub: (slug: string) => void;
  showAllClubs?: boolean; // if false, only show PL/Championship
}

export function ClubSelector({
  selectedClub,
  onSelectClub,
  showAllClubs = false,
}: ClubSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter clubs based on showAllClubs
  let clubs = CANONICAL_CLUB_REGISTRY;
  if (!showAllClubs) {
    clubs = clubs.filter(
      (club) =>
        club.league === League.PREMIER_LEAGUE ||
        club.league === League.CHAMPIONSHIP,
    );
  }

  const getSelectedClubName = (): string => {
    const club = clubs.find((c) => c.slug === selectedClub);
    return club?.displayName || "Select a club";
  };

  return (
    <div className="relative inline-block w-full max-w-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <span className="block truncate">{getSelectedClubName()}</span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-auto">
          {clubs.map((club) => (
            <button
              key={club.slug}
              onClick={() => {
                onSelectClub(club.slug);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${
                selectedClub === club.slug ? "bg-blue-100 font-semibold" : ""
              }`}
            >
              {club.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
