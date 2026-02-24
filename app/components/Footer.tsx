const socials = [
  "TikTok",
  "YouTube",
  "Instagram",
  "X",
  "Spotify",
  "WhatsApp",
  "LinkedIn",
];

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-black/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between lg:px-6">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-600">
            Chant Platform
          </p>
          <p className="text-[11px] text-zinc-500">
            Multi-tenant arena for chants, battles, and careers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.18em]">
          {socials.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}

