"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitFanChant } from "@/app/battles/[slug]/chant-actions";
import { trackAnalyticsEvent } from "@/app/lib/analyticsClient";
import ChantAudioUpload from "@/components/ChantAudioUpload";

interface FanChantSubmissionFormProps {
  battleSlug: string;
  submissionOpen: boolean;
  kickoffTime?: string | null;
  simpleMode?: boolean;
}

interface Feedback {
  type: "success" | "error";
  text: string;
}

interface SubmitFanChantResponse {
  success: boolean;
  message: string;
  chantId?: string;
}

const CHANT_CATEGORY_OPTIONS = [
  { value: "praise", label: "Praise" },
  { value: "roast", label: "Roast" },
  { value: "meme", label: "Meme" },
  { value: "player", label: "Player" },
] as const;

function getOrCreateFanId() {
  let id = localStorage.getItem("chant-user-id");
  if (!id) {
    id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("chant-user-id", id);
  }
  return id;
}

function getRemainingSeconds(kickoffTime?: string | null) {
  const rawKickoff = String(kickoffTime || "").trim();
  if (!rawKickoff) {
    return null;
  }

  const kickoffTimestamp = new Date(rawKickoff).getTime();
  if (Number.isNaN(kickoffTimestamp)) {
    return null;
  }

  const diffInMilliseconds = kickoffTimestamp - Date.now();
  if (diffInMilliseconds <= 0) {
    return 0;
  }

  return Math.floor(diffInMilliseconds / 1000);
}

function formatCountdown(totalSeconds: number) {
  const safeTotalSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeTotalSeconds / 3600);
  const minutes = Math.floor((safeTotalSeconds % 3600) / 60);
  const seconds = safeTotalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(" : ");
}

export default function FanChantSubmissionForm({
  battleSlug,
  submissionOpen,
  kickoffTime,
  simpleMode = false,
}: FanChantSubmissionFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [category, setCategory] = useState("praise");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fanId, setFanId] = useState(() =>
    typeof window === "undefined" ? "" : getOrCreateFanId(),
  );
  const [latestChantId, setLatestChantId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(() =>
    typeof window === "undefined" ? null : getRemainingSeconds(kickoffTime),
  );
  const [isPending, startTransition] = useTransition();

  const kickoffReached = typeof timeLeft === "number" && timeLeft <= 0;

  useEffect(() => {
    if (!submissionOpen || !kickoffTime) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextTimeLeft = getRemainingSeconds(kickoffTime);
      setTimeLeft(nextTimeLeft);
      if (nextTimeLeft === 0) {
        window.clearInterval(intervalId);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [kickoffTime, submissionOpen]);

  if (!submissionOpen) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
        Submission window is closed for this battle.
        {kickoffTime && (
          <div className="mt-1 text-xs text-zinc-500">
            Kickoff: {new Date(kickoffTime).toLocaleString()}
          </div>
        )}
      </div>
    );
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const activeFanId = fanId || getOrCreateFanId();
    if (!fanId) {
      setFanId(activeFanId);
    }

    if (!activeFanId || isPending || kickoffReached) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = (await submitFanChant({
        battleSlug,
        userId: activeFanId,
        title: simpleMode ? undefined : title,
        lyrics,
        chantText: lyrics,
        category,
      })) as SubmitFanChantResponse;

      setFeedback({
        type: result.success ? "success" : "error",
        text: result.message,
      });

      if (result.success) {
        trackAnalyticsEvent("chant_submit", {
          battle_slug: battleSlug,
        });
        setTitle("");
        setLyrics("");
        setCategory("praise");
        setLatestChantId(result.chantId || null);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-50">Submit A Fan Chant</p>
        <p className="mt-1 text-xs text-zinc-400">
          Max 2 chants per fan for this battle. Submissions close at kickoff.
        </p>
      </div>

      {typeof timeLeft === "number" && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-300">Battle closes in:</p>
          <p className="mt-1 font-mono text-lg font-semibold text-amber-200">
            {formatCountdown(timeLeft)}
          </p>
        </div>
      )}

      {kickoffReached && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200">
          Submissions closed — voting has ended.
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
              : "border-red-800 bg-red-950/40 text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {!simpleMode && (
        <div className="space-y-2">
          <label htmlFor="fan-chant-title" className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
            Chant Title
          </label>
          <input
            id="fan-chant-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={kickoffReached}
            required
            maxLength={80}
            placeholder="e.g., North Bank Roar"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="fan-chant-category" className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
          Chant Category
        </label>
        <select
          id="fan-chant-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={kickoffReached}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:border-emerald-500 focus:outline-none"
        >
          {CHANT_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="fan-chant-lyrics" className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
          {simpleMode ? "Chant Text" : "Chant Lines"}
        </label>
        <textarea
          id="fan-chant-lyrics"
          value={lyrics}
          onChange={(event) => setLyrics(event.target.value)}
          disabled={kickoffReached}
          required
          maxLength={500}
          rows={4}
          placeholder={simpleMode ? "Write your chant text here..." : "Write your chant lines here..."}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || kickoffReached}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {kickoffReached ? "Submissions Closed" : isPending ? "Submitting..." : "Submit Chant"}
      </button>

      {latestChantId && fanId && (
        <ChantAudioUpload
          chantId={latestChantId}
          battleSlug={battleSlug}
          userId={fanId}
          onUploadComplete={(audioUrl) => {
            setFeedback({
              type: "success",
              text: `Uploaded to Supabase: ${audioUrl}`,
            });
            router.refresh();
          }}
        />
      )}
    </form>
  );
}
