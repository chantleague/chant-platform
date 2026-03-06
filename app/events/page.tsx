import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { mockBattles } from "@/app/lib/mockBattles";

type EventRow = {
  slug: string;
  title: string;
  description: string;
  startsAt: string | null;
  status: string;
};

function formatKickoff(startsAt: string | null) {
  if (!startsAt) {
    return "Kickoff TBD";
  }

  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    return "Kickoff TBD";
  }

  return date.toLocaleString();
}

export default async function EventsPage() {
  const fallbackEvents: EventRow[] = mockBattles.map((battle) => ({
    slug: battle.slug,
    title: battle.title,
    description: battle.description || "Upcoming battle",
    startsAt: null,
    status: "upcoming",
  }));

  let events: EventRow[] = fallbackEvents;

  try {
    const { data, error } = await supabase
      .from("matches")
      .select("slug, title, description, starts_at, status")
      .order("starts_at", { ascending: true })
      .limit(30);

    if (error) {
      console.error("events: failed to fetch matches", error);
    } else {
      const normalized = (((data as Array<Record<string, unknown>> | null) || [])
        .map((row) => {
          const slug = String(row.slug || "").trim();
          if (!slug) {
            return null;
          }

          return {
            slug,
            title: String(row.title || slug.replace(/-/g, " ")),
            description: String(row.description || "Upcoming battle"),
            startsAt: row.starts_at ? String(row.starts_at) : null,
            status: String(row.status || "upcoming"),
          } as EventRow;
        })
        .filter((event): event is EventRow => Boolean(event)));

      if (normalized.length > 0) {
        events = normalized;
      }
    }
  } catch (queryError) {
    console.error("events: unexpected error", queryError);
  }

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Events</p>
        <h1 className="text-2xl font-bold text-zinc-50">Upcoming Battles</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Browse upcoming fixtures and jump straight into chant battles.
        </p>
      </header>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-sm text-zinc-400">
          No upcoming events yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <Link
              key={event.slug}
              href={`/battle/${event.slug}`}
              className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 transition hover:border-zinc-600 hover:bg-zinc-900/70"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-50">{event.title}</p>
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                  {event.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400">{event.description}</p>
              <p className="text-xs text-emerald-400">{formatKickoff(event.startsAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
