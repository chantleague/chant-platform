import EmailSignup from "@/components/EmailSignup";

const socials = ["TikTok", "YouTube", "Instagram", "X", "Spotify", "WhatsApp", "LinkedIn"];

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-black/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 text-xs text-zinc-500 lg:px-6">
        <div className="space-y-1">
          <p className="uppercase tracking-[0.2em] text-zinc-400">Chant Platform</p>
          <p>Multi-tenant arena for chants, battles, and careers.</p>
        </div>

        <EmailSignup variant="footer" />

        <div className="flex flex-wrap items-center gap-2 uppercase tracking-[0.18em] md:justify-end">
          {socials.map((social) => (
            <button
              key={social}
              type="button"
              className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              {social}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
