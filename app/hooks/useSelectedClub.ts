/**
 * Club Selection Hook
 * 
 * Manages the user's selected club.
 * Stored in localStorage for persistence across sessions.
 */

"use client";

import { useEffect, useState } from "react";

const SELECTED_CLUB_KEY = "chant-selected-club";

export function useSelectedClub(): [string | null, (slug: string) => void] {
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SELECTED_CLUB_KEY);
      setSelectedClub(stored);
      setInitialized(true);
    }
  }, []);

  const updateClub = (slug: string) => {
    setSelectedClub(slug);
    if (typeof window !== "undefined") {
      localStorage.setItem(SELECTED_CLUB_KEY, slug);
    }
  };

  // Return null until client-side initialization is complete
  return initialized ? [selectedClub, updateClub] : [null, updateClub];
}
