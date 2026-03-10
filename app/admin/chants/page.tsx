import { supabaseServer as supabase } from "@/app/lib/supabaseServer";
import { approveChant, deleteChant, rejectChant } from "@/app/admin/chants/actions";

type ModerationStatus = "pending" | "approved" | "rejected";

interface ChantModerationRow {
  id: string;
  chantText: string;
  battleLabel: string;
  battleSlug: string;
  createdAt: string | null;
  voteCount: number;
  audioUrl: string | null;
  status: ModerationStatus;
}

function isMissingColumnError(errorMessage: string, columnName: string) {
  if (!errorMessage) {
    return false;
  }

  const escapedColumn = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(column .*${escapedColumn}.* does not exist|Could not find the '${escapedColumn}' column)`,
    "i",
  ).test(errorMessage);
}

function normalizeStatus(value: unknown): ModerationStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approved" || normalized === "rejected") {
    return normalized;
  }

  return "pending";
}

function toVoteCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "Unknown";
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

export default async function AdminChantsPage() {
  const rows: ChantModerationRow[] = [];
  let statusColumnAvailable = true;

  try {
    let chantsData: Array<Record<string, unknown>> | null = null;
    let chantsError: { message?: string } | null = null;

    const chantsQuery = await supabase
      .from("chants")
      .select("id, chant_text, lyrics, match_id, battle_id, created_at, vote_count, audio_url, status")
      .order("created_at", { ascending: false })
      .limit(100);

    chantsData = (chantsQuery.data as Array<Record<string, unknown>> | null) || [];
    chantsError = chantsQuery.error;

    if (chantsError && isMissingColumnError(chantsError.message || "", "status")) {
      statusColumnAvailable = false;
      const fallbackQuery = await supabase
        .from("chants")
        .select("id, chant_text, lyrics, match_id, battle_id, created_at, vote_count, audio_url")
        .order("created_at", { ascending: false })
        .limit(100);

      chantsData = (fallbackQuery.data as Array<Record<string, unknown>> | null) || [];
      chantsError = fallbackQuery.error;
    }

    if (chantsError) {
      console.error("admin/chants: failed to fetch chants", chantsError);
    } else {
      const chants = chantsData || [];

      const matchIds = Array.from(
        new Set(
          chants
            .map((chant) => String(chant.match_id || chant.battle_id || "").trim())
            .filter((id) => Boolean(id)),
        ),
      );

      const matchMap = new Map<string, { slug: string; title: string }>();
      if (matchIds.length > 0) {
        const matchesQuery = await supabase
          .from("matches")
          .select("id, slug, title")
          .in("id", matchIds);

        if (matchesQuery.error) {
          console.error("admin/chants: failed to fetch battle metadata", matchesQuery.error);
        } else {
          (((matchesQuery.data as Array<Record<string, unknown>> | null) || [])).forEach((matchRow) => {
            const id = String(matchRow.id || "").trim();
            if (!id) {
              return;
            }

            matchMap.set(id, {
              slug: String(matchRow.slug || "").trim(),
              title: String(matchRow.title || "").trim(),
            });
          });
        }
      }

      chants.forEach((chant) => {
        const id = String(chant.id || "").trim();
        if (!id) {
          return;
        }

        const matchId = String(chant.match_id || chant.battle_id || "").trim();
        const battle = matchId ? matchMap.get(matchId) : null;

        const chantText = String(chant.chant_text || chant.lyrics || "").trim() || "(empty chant)";
        const battleLabel = battle?.title || battle?.slug || "Unknown battle";
        const battleSlug = battle?.slug || "";

        rows.push({
          id,
          chantText,
          battleLabel,
          battleSlug,
          createdAt: chant.created_at ? String(chant.created_at) : null,
          voteCount: toVoteCount(chant.vote_count),
          audioUrl: chant.audio_url ? String(chant.audio_url) : null,
          status: statusColumnAvailable ? normalizeStatus(chant.status) : "pending",
        });
      });
    }
  } catch (error) {
    console.error("admin/chants: unexpected error", error);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Fan Chant Moderation</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Review recent fan chant submissions and moderate what appears on public battle pages.
        </p>
      </header>

      {!statusColumnAvailable && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-200">
          The chants.status column is missing. Run the latest Supabase migrations to enable moderation states.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-sm text-zinc-400">
          No chant submissions found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80">
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-zinc-400">Chant</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-zinc-400">Battle</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-zinc-400">Created</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-zinc-400">Votes</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-zinc-400">Audio</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.12em] text-zinc-400">Status</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-black/40">
              {rows.map((chant) => {
                const approveAction = approveChant.bind(null, chant.id);
                const rejectAction = rejectChant.bind(null, chant.id);
                const deleteAction = deleteChant.bind(null, chant.id);

                return (
                  <tr key={chant.id} className="align-top hover:bg-zinc-900/40">
                    <td className="px-4 py-4 text-sm text-zinc-200">
                      <p className="max-w-md whitespace-pre-wrap">{chant.chantText}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300">
                      {chant.battleSlug ? `${chant.battleLabel} (${chant.battleSlug})` : chant.battleLabel}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">{formatDate(chant.createdAt)}</td>
                    <td className="px-4 py-4 text-sm text-zinc-300">{chant.voteCount.toLocaleString()}</td>
                    <td className="px-4 py-4 text-sm text-zinc-300">
                      {chant.audioUrl ? (
                        <a
                          href={chant.audioUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          Audio
                        </a>
                      ) : (
                        <span className="text-zinc-500">None</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                          chant.status === "approved"
                            ? "bg-emerald-950/70 text-emerald-300"
                            : chant.status === "rejected"
                              ? "bg-red-950/70 text-red-300"
                              : "bg-amber-950/60 text-amber-300"
                        }`}
                      >
                        {chant.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <form action={approveAction}>
                          <button
                            type="submit"
                            disabled={chant.status === "approved" || !statusColumnAvailable}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
                          >
                            Approve
                          </button>
                        </form>

                        <form action={rejectAction}>
                          <button
                            type="submit"
                            disabled={chant.status === "rejected" || !statusColumnAvailable}
                            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
                          >
                            Reject
                          </button>
                        </form>

                        <form action={deleteAction}>
                          <button
                            type="submit"
                            className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
