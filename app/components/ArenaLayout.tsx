import { ReactNode } from "react";

export function ArenaLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 shadow-[0_32px_80px_rgba(0,0,0,0.9)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.18),transparent_55%),radial-gradient(circle_at_bottom,rgba(56,189,248,0.18),transparent_55%)] mix-blend-screen" />
      <div className="relative flex flex-col gap-6 px-5 py-6 md:flex-row md:px-8 md:py-8">
        <div className="flex-1 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Live Arena
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50 md:text-2xl">
            {title}
          </h1>
          <p className="max-w-md text-xs text-zinc-400 md:text-sm">
            {subtitle}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Crowd synced · Chants flowing
          </div>
        </div>
        <div className="flex-[1.3] space-y-4">{children}</div>
      </div>
    </section>
  );
}

