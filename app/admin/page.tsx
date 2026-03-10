import Link from "next/link";

const adminLinks = [
  {
    href: "/admin/chants",
    title: "Moderate Fan Chants",
    description: "Approve, reject, or delete fan submissions before they appear publicly.",
  },
  {
    href: "/admin/battles",
    title: "Manage Battles",
    description: "Create fixtures, update battle settings, and maintain rivalry matchups.",
  },
];

export default function AdminIndexPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Dashboard</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Use admin tools to moderate chant content and manage battles.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-600 hover:bg-zinc-900/60"
          >
            <h2 className="text-base font-semibold text-zinc-50">{link.title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
