import Link from "next/link";

export type BattleCardProps = {
  slug: string;
  title: string;
  subtitle: string;
  status: "live" | "upcoming" | "finished";
  tag: string;
  metricLabel: string;
  metricValue: string;
};

export function BattleCard(props: BattleCardProps) {
  const { slug, title, subtitle, status, tag, metricLabel, metricValue } = props;

  const statusColor =
    status === "live"
      ? "text-emerald-400"
      : status === "upcoming"
      ? "text-sky-400"
      : "text-zinc-500";

  return (
    <Link
      href={`/battle/${slug}`}
      className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.8)] ring-1 ring-zinc-900/60 transition hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-900/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
              {tag}
            </span>
            <span className={`flex items-center gap-1 font-semibold ${statusColor}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {status}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-zinc-50">{title}</h3>
          <p className="text-xs text-zinc-400">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          VS
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-zinc-500">
        <span>{metricLabel}</span>
        <span className="text-xs font-semibold text-zinc-50">
          {metricValue}
        </span>
      </div>
    </Link>
  );
}

