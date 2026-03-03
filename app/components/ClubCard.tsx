import Link from "next/link";

export type ClubCardProps = {
  slug: string;
  name: string;
  fans: number;
};

export function ClubCard({ slug, name, fans }: ClubCardProps) {
  return (
    <Link
      href={`/club/${slug}`}
      className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.8)] ring-1 ring-zinc-900/60 transition hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-900/60"
    >
      <h3 className="text-sm font-semibold text-zinc-50">{name}</h3>
      <p className="mt-2 text-xs text-zinc-400">Total fans</p>
      <p className="mt-1 text-2xl font-semibold text-emerald-400">
        {fans.toLocaleString()}
      </p>
    </Link>
  );
}
