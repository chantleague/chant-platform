"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase";

export default function Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    slug: "",
    title: "",
    description: "",
    homeTeam: "",
    awayTeam: "",
    matchday: "",
    status: "upcoming",
    startsAt: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: dbError } = await supabase.from("matches").insert([
        {
          slug: formData.slug.toLowerCase().replace(/\s+/g, "-"),
          title: formData.title,
          description: formData.description,
          home_team: formData.homeTeam,
          away_team: formData.awayTeam,
          matchday: formData.matchday ? parseInt(formData.matchday) : null,
          status: formData.status,
          starts_at: formData.startsAt ? new Date(formData.startsAt).toISOString() : null,
        },
      ]);

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      router.push("/admin/battles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Admin Dashboard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Create New Battle
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Set up a new battle for an upcoming match.
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-zinc-300 mb-2">
            Slug (URL-friendly name)
          </label>
          <input
            type="text"
            id="slug"
            name="slug"
            value={formData.slug}
            onChange={handleInputChange}
            placeholder="e.g., arsenal-vs-spurs"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-300 mb-2">
            Battle Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g., Arsenal vs Spurs Chant Battle"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Describe the battle..."
            rows={4}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="homeTeam" className="block text-sm font-medium text-zinc-300 mb-2">
              Home Team
            </label>
            <input
              type="text"
              id="homeTeam"
              name="homeTeam"
              value={formData.homeTeam}
              onChange={handleInputChange}
              placeholder="e.g., Arsenal"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="awayTeam" className="block text-sm font-medium text-zinc-300 mb-2">
              Away Team
            </label>
            <input
              type="text"
              id="awayTeam"
              name="awayTeam"
              value={formData.awayTeam}
              onChange={handleInputChange}
              placeholder="e.g., Spurs"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="matchday" className="block text-sm font-medium text-zinc-300 mb-2">
              Matchday
            </label>
            <input
              type="number"
              id="matchday"
              name="matchday"
              value={formData.matchday}
              onChange={handleInputChange}
              placeholder="e.g., 15"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-zinc-300 mb-2">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 focus:border-emerald-500 focus:outline-none"
            >
              <option value="upcoming">Upcoming</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="startsAt" className="block text-sm font-medium text-zinc-300 mb-2">
            Match Start Time
          </label>
          <input
            type="datetime-local"
            id="startsAt"
            name="startsAt"
            value={formData.startsAt}
            onChange={handleInputChange}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-50 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:cursor-not-allowed px-4 py-3 font-medium text-white transition-colors"
          >
            {isLoading ? "Creating..." : "Create Battle"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-3 font-medium text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
