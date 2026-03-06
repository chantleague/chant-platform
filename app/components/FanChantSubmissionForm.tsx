"use client";

import { useState, useTransition } from "react";
import { submitFanChant } from "@/app/battles/[slug]/chant-actions";
import ChantAudioUpload from "@/components/ChantAudioUpload";

interface FanChantSubmissionFormProps {
  battleId: string;
  battleSlug: string;
  submissionOpen: boolean;
  startsAt?: string | null;
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

function getOrCreateFanId() {
  let id = localStorage.getItem("chant-user-id");
  if (!id) {
    id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("chant-user-id", id);
  }
  return id;
}

export default function FanChantSubmissionForm({
  battleId,
  battleSlug,
  submissionOpen,
  startsAt,
}: FanChantSubmissionFormProps) {
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fanId, setFanId] = useState(() =>
    typeof window === "undefined" ? "" : getOrCreateFanId(),
  );
  const [latestChantId, setLatestChantId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!battleId) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
        Fan chant submissions are available when this battle is connected to Supabase.
      </div>
    );
  }

  if (!submissionOpen) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
        Submission window is closed for this battle.
        {startsAt && (
          <div className="mt-1 text-xs text-zinc-500">
            Kickoff: {new Date(startsAt).toLocaleString()}
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

    if (!activeFanId || isPending) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = (await submitFanChant({
        battleId,
        battleSlug,
        userId: activeFanId,
        title,
        lyrics,
      })) as SubmitFanChantResponse;

      setFeedback({
        type: result.success ? "success" : "error",
        text: result.message,
      });

      if (result.success) {
        setTitle("");
        setLyrics("");
        setLatestChantId(result.chantId || null);
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

      <div className="space-y-2">
        <label htmlFor="fan-chant-title" className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
          Chant Title
        </label>
        <input
          id="fan-chant-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={80}
          placeholder="e.g., North Bank Roar"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="fan-chant-lyrics" className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
          Chant Lines
        </label>
        <textarea
          id="fan-chant-lyrics"
          value={lyrics}
          onChange={(event) => setLyrics(event.target.value)}
          required
          maxLength={500}
          rows={4}
          placeholder="Write your chant lines here..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {isPending ? "Submitting..." : "Submit Chant"}
      </button>

      {latestChantId && fanId && (
        <ChantAudioUpload chantId={latestChantId} battleSlug={battleSlug} userId={fanId} />
      )}
    </form>
  );
}
