"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

interface BattleVoteButtonProps {
  battleId: string;
  clubSlug: string;
  voteCount: number;
  onVoteChange?: (newCount: number, hasVoted: boolean) => void;
}

export default function BattleVoteButton({
  battleId,
  clubSlug,
  voteCount,
  onVoteChange,
}: BattleVoteButtonProps) {
  const [votes, setVotes] = useState(voteCount);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("chant-user-id");
    if (!id) {
      id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("chant-user-id", id);
    }
    setUserId(id);

    const checkVoteStatus = async () => {
      if (!id) return;
      const { data } = await supabase
        .from("votes")
        .select("id")
        .eq("battle_id", battleId)
        .eq("club_slug", clubSlug)
        .eq("user_id", id)
        .limit(1);

      setHasVoted((data?.length ?? 0) > 0);
    };

    checkVoteStatus();
  }, [battleId, clubSlug]);

  const handleVote = async () => {
    if (!userId || hasVoted || isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from("votes").insert([
        {
          battle_id: battleId,
          club_slug: clubSlug,
          user_id: userId,
        },
      ]);

      if (!error) {
        setHasVoted(true);
        const newCount = votes + 1;
        setVotes(newCount);
        onVoteChange?.(newCount, true);
      }
    } catch (err) {
      console.error("Error voting:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleVote}
      disabled={hasVoted || isLoading}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        hasVoted
          ? "bg-emerald-500/20 text-emerald-400 cursor-not-allowed"
          : "bg-emerald-600 hover:bg-emerald-700 text-white"
      }`}
    >
      <span className="text-lg">{hasVoted ? "✓" : "👍"}</span>
      <span>{votes.toLocaleString()}</span>
    </button>
  );
}
