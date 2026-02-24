export type LeaderboardRow = {
  position: number;
  name: string;
  metric: string;
  value: number;
};

export function LeaderboardTable({ rows, label }: { rows: LeaderboardRow[]; label: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          {label}
        </p>
        <p className="text-[11px] text-zinc-500">Top performers</p>
      </div>
      <table className="min-w-full border-separate border-spacing-y-1 px-2 py-3 text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.position} className="text-xs text-zinc-300">
              <td className="w-10 px-3 py-1.5 text-[11px] font-semibold text-zinc-500">
                #{row.position}
              </td>
              <td className="px-3 py-1.5 text-[13px] text-zinc-50">{row.name}</td>
              <td className="px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {row.metric}
              </td>
              <td className="px-3 py-1.5 text-right text-[13px] font-semibold text-emerald-400">
                {row.value.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

