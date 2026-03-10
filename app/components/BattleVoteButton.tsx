"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
// server action for inserting votes and revalidating
import { voteMVP } from "@/app/battles/[slug]/actions";

interface BattleVoteButtonProps {
  battleId: string;
  // slug is needed by the server action so it can revalidate the correct path
  battleSlug: string;
  clubSlug: string;
  voteCount: number;
  votingClosed?: boolean;
  onVoteChange?: (newCount: number, hasVoted: boolean) => void;
}

export default function BattleVoteButton({
  battleId,
  battleSlug,
  clubSlug,
  voteCount,
  votingClosed = false,
  onVoteChange,
}: BattleVoteButtonProps) {
  const [votes, setVotes] = useState(voteCount);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem("chant-user-id");
    if (!id) {
      id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("chant-user-id", id);
    }
    setUserId(id);

    // existing check remains to disable button if vote already recorded (legacy user_id column)
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
    if (!userId || hasVoted || isLoading || votingClosed) return;

    setIsLoading(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      // call the server action, which will insert and revalidate the page
      const result = await voteMVP(battleId, clubSlug, userId, battleSlug);
      if (result?.success) {
        setHasVoted(true);
        const newCount = votes + 1;
        setVotes(newCount);
        onVoteChange?.(newCount, true);
        setMessageIsError(false);
      } else {
        setMessageIsError(true);
      }
      if (result?.message) {
        setMessage(result.message);
      }
    } catch (err) {
      console.error("Error voting:", err);
      setMessage("Could not record vote.");
      setMessageIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const resolvedMessage = message || (votingClosed && !hasVoted ? "Voting is closed for this battle." : null);
  const resolvedMessageIsError = message ? messageIsError : Boolean(votingClosed && !hasVoted);

  return (
    <>
      <button
        onClick={handleVote}
        disabled={hasVoted || isLoading || votingClosed}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          hasVoted
            ? "bg-emerald-500/20 text-emerald-400 cursor-not-allowed"
            : votingClosed
              ? "cursor-not-allowed bg-zinc-800 text-zinc-400"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
        }`}
      >
        <span className="text-lg">{hasVoted ? "✓" : votingClosed ? "🔒" : "👍"}</span>
        <span>{votes.toLocaleString()}</span>
      </button>
      {resolvedMessage && (
        <p className={`mt-1 text-xs ${resolvedMessageIsError ? "text-red-300" : "text-emerald-300"}`}>
          {resolvedMessage}
        </p>
      )}
    </>
  );
}
