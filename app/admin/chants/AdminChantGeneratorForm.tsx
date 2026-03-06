"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { generateAdminAiChant } from "@/app/admin/chants/actions";

interface GenerationResult {
  success: boolean;
  message: string;
  chantText?: string;
  audioUrl?: string | null;
}

export default function AdminChantGeneratorForm() {
  const [club, setClub] = useState("");
  const [player, setPlayer] = useState("");
  const [rival, setRival] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const response = await generateAdminAiChant({
        club,
        player,
        rival,
      });

      setResult(response);

      if (response.success) {
        setPlayer("");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-50">Generate AI Chant</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Generate a stadium-style chant and optional Suno audio, then save it to the database.
        </p>
      </div>

      {result && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            result.success
              ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
              : "border-red-800 bg-red-950/40 text-red-300"
          }`}
        >
          <p>{result.message}</p>
          {result.chantText && (
            <pre className="mt-2 whitespace-pre-wrap rounded bg-black/20 p-2 text-xs text-zinc-200">
              {result.chantText}
            </pre>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="club" className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
            Club
          </label>
          <input
            id="club"
            value={club}
            onChange={(event) => setClub(event.target.value)}
            required
            placeholder="Arsenal"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="player" className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
            Player
          </label>
          <input
            id="player"
            value={player}
            onChange={(event) => setPlayer(event.target.value)}
            required
            placeholder="Declan Rice"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="rival" className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
            Rival Club
          </label>
          <input
            id="rival"
            value={rival}
            onChange={(event) => setRival(event.target.value)}
            required
            placeholder="Tottenham"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {isPending ? "Generating..." : "Generate AI Chant"}
      </button>
    </form>
  );
}
