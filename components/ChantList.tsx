type ChantListItem = {
  id: string;
  chant_text: string;
  votes: number;
  audio_url: string | null;
  created_at: string | null;
};

export default function ChantList({ chants }: { chants: ChantListItem[] }) {
  if (!chants.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
        No chants available yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {chants.map((chant) => (
        <article key={chant.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="space-y-2">
            <p className="text-sm whitespace-pre-wrap text-zinc-200">{chant.chant_text}</p>
            <p className="text-xs text-zinc-500">
              Votes: {chant.votes.toLocaleString()}
              {chant.created_at ? ` · ${new Date(chant.created_at).toLocaleString()}` : ""}
            </p>

            {chant.audio_url && (
              <audio controls preload="metadata" className="w-full" src={chant.audio_url}>
                Your browser does not support the audio element.
              </audio>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
