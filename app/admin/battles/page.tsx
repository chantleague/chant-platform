import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

interface Match {
  id: string;
  title: string;
  home_team: string;
  away_team: string;
  status: string;
  starts_at: string | null;
  [key: string]: unknown;
}

export default async function Page() {
  const { data: battles, error } = await supabase
    .from("matches")
    .select("*")
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("Error fetching battles:", error);
    return (
      <div className="text-red-500 text-sm">Failed to load battles</div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Admin Dashboard
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Manage Battles
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Create and manage battles, upload official chant packs, and distribute to fans.
        </p>
      </header>

      <div className="flex justify-end">
        <Link
          href="/admin/battles/new"
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Create New Battle
        </Link>
      </div>

      {!battles || battles.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 text-center">
          <p className="text-zinc-400">No battles yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Teams
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {battles.map((battle: Match) => (
                <tr key={battle.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-zinc-50">{battle.title}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {battle.home_team} vs {battle.away_team}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        battle.status === "live"
                          ? "bg-red-950/50 text-red-400"
                          : battle.status === "completed"
                          ? "bg-zinc-800 text-zinc-400"
                          : "bg-emerald-950/50 text-emerald-400"
                      }`}
                    >
                      {battle.status.charAt(0).toUpperCase() + battle.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {battle.starts_at
                      ? new Date(battle.starts_at).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/battles/${battle.id}`}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
