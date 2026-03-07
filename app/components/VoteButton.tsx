"use client";

import { useEffect, useMemo, useState } from "react";

interface VoteButtonProps {
  chantPackId?: string;
  chantRowId?: string;
  matchId?: string;
  battleSlug?: string;
  voteCount: number;
  hasVotedOverride?: boolean;
  onVoteChange?: (newCount: number, hasVoted: boolean) => void;
}

interface VoteApiResponse {
  success?: boolean;
  message?: string;
  vote_count?: number;
}

function getOrCreateFanId() {
  let id = localStorage.getItem("chant-user-id");
  if (!id) {
    id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("chant-user-id", id);
  }

  return id;
}

function buildVoteTargetKey(chantRowId?: string, chantPackId?: string) {
  const normalizedRowId = String(chantRowId || "").trim();
  if (normalizedRowId) {
    return `chant-row:${normalizedRowId}`;
  }

  const normalizedPackId = String(chantPackId || "").trim();
  if (normalizedPackId) {
    return `chant-pack:${normalizedPackId}`;
  }

  return "";
}

export default function VoteButton({
  chantPackId,
  chantRowId,
  matchId,
  battleSlug,
  voteCount,
  hasVotedOverride,
  onVoteChange,
}: VoteButtonProps) {
  const [votes, setVotes] = useState(voteCount);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const targetKey = useMemo(
    () => buildVoteTargetKey(chantRowId, chantPackId),
    [chantPackId, chantRowId],
  );

  const voteMarkerKey = useMemo(() => {
    if (!targetKey) {
      return "";
    }

    return `chant-vote:${targetKey}`;
  }, [targetKey]);

  useEffect(() => {
    setVotes(voteCount);
  }, [voteCount]);

  useEffect(() => {
    const id = getOrCreateFanId();
    setUserId(id);

    if (!voteMarkerKey) {
      setHasVoted(false);
      return;
    }

    setHasVoted(localStorage.getItem(voteMarkerKey) === "1");
  }, [voteMarkerKey]);

  useEffect(() => {
    if (hasVotedOverride) {
      setHasVoted(true);
    }
  }, [hasVotedOverride]);

  const markVotedLocally = () => {
    if (voteMarkerKey) {
      localStorage.setItem(voteMarkerKey, "1");
    }
    setHasVoted(true);
  };

  const handleVote = async () => {
    if (!userId || !targetKey || hasVoted || isLoading) {
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setMessageIsError(false);

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chant_row_id: chantRowId || undefined,
          chant_pack_id: chantPackId || undefined,
          match_id: matchId || undefined,
          battle_slug: battleSlug || undefined,
          user_identifier: userId,
        }),
      });

      const result = (await response
        .json()
        .catch(() => ({ success: false, message: "Invalid vote response." }))) as VoteApiResponse;

      if (!response.ok || !result.success) {
        const failureMessage = result.message || "Could not record vote.";
        setMessage(failureMessage);
        setMessageIsError(true);

        if (response.status === 409) {
          markVotedLocally();
          onVoteChange?.(votes, true);
        }

        return;
      }

      const nextVoteCount =
        typeof result.vote_count === "number" ? result.vote_count : votes + 1;

      markVotedLocally();
      setVotes(nextVoteCount);
      onVoteChange?.(nextVoteCount, true);
      setMessage(result.message || "Vote recorded.");
    } catch (err) {
      console.error("VoteButton: vote request failed", {
        targetKey,
        chantRowId,
        chantPackId,
        battleSlug,
        matchId,
        error: err,
      });
      setMessage("Could not record vote.");
      setMessageIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        onClick={handleVote}
        disabled={hasVoted || isLoading || !targetKey}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          hasVoted
            ? "cursor-not-allowed bg-emerald-500/20 text-emerald-400"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        <span className="text-lg">{hasVoted ? "✓" : "👍"}</span>
        <span>{votes.toLocaleString()}</span>
      </button>

      {message && (
        <p className={`text-xs ${messageIsError ? "text-red-300" : "text-emerald-300"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
