import ChantList from "@/components/ChantList";
import AdminChantGeneratorForm from "@/app/admin/chants/AdminChantGeneratorForm";
import { supabase } from "@/app/lib/supabase";

interface ChantListRow {
  id: string;
  chant_text: string;
  votes: number;
  audio_url: string | null;
  created_at: string | null;
}

export default async function AdminChantsPage() {
  let rows: ChantListRow[] = [];

  try {
    const withAudioQuery = await supabase
      .from("chants")
      .select("id, chant_pack_id, lyrics, audio_url, created_at")
      .order("created_at", { ascending: false })
      .limit(25);

    let chantsData = withAudioQuery.data as Array<Record<string, unknown>> | null;
    let chantsError = withAudioQuery.error;

    if (
      chantsError &&
      (chantsError.message || "").toLowerCase().includes("audio_url")
    ) {
      const fallbackQuery = await supabase
        .from("chants")
        .select("id, chant_pack_id, lyrics, created_at")
        .order("created_at", { ascending: false })
        .limit(25);

      chantsData = fallbackQuery.data as Array<Record<string, unknown>> | null;
      chantsError = fallbackQuery.error;
    }

    if (chantsError) {
      console.error("admin/chants: failed to fetch chants", chantsError);
    } else {
      const chants = chantsData || [];
      const chantPackIds = chants
        .map((chant) => String(chant.chant_pack_id || ""))
        .filter((id) => Boolean(id));

      const voteMap: Record<string, number> = {};
      const audioMap: Record<string, string | null> = {};
      if (chantPackIds.length > 0) {
        const [votesResponse, packsResponse] = await Promise.all([
          supabase.from("chant_votes").select("chant_pack_id").in("chant_pack_id", chantPackIds),
          supabase
            .from("chant_packs")
            .select("id, audio_url")
            .in("id", chantPackIds),
        ]);

        const voteData = votesResponse.data as Array<Record<string, unknown>> | null;
        const voteError = votesResponse.error;
        const packData = packsResponse.data as Array<Record<string, unknown>> | null;
        const packError = packsResponse.error;

        if (voteError) {
          console.error("admin/chants: failed to fetch chant votes", voteError);
        } else {
          ((voteData || [])).forEach((voteRow) => {
            const chantPackId = String(voteRow.chant_pack_id || "");
            if (chantPackId) {
              voteMap[chantPackId] = (voteMap[chantPackId] || 0) + 1;
            }
          });
        }

        if (packError) {
          console.error("admin/chants: failed to fetch chant pack audio", packError);
        } else {
          ((packData || [])).forEach((pack) => {
            const id = String(pack.id || "");
            if (id) {
              audioMap[id] = pack.audio_url ? String(pack.audio_url) : null;
            }
          });
        }
      }

      rows = chants.map((chant) => {
        const chantPackId = String(chant.chant_pack_id || "");
        return {
          id: String(chant.id || chantPackId),
          chant_text: String(chant.lyrics || ""),
          votes: voteMap[chantPackId] || 0,
          audio_url:
            (chant.audio_url ? String(chant.audio_url) : null) ||
            audioMap[chantPackId] ||
            null,
          created_at: chant.created_at ? String(chant.created_at) : null,
        };
      });
    }
  } catch (error) {
    console.error("admin/chants: unexpected error", error);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">AI Chants</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Generate stadium chants with AI, request Suno audio, and publish chants into the battle database.
        </p>
      </header>

      <AdminChantGeneratorForm />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-50">Latest Generated Chants</h2>
        <ChantList chants={rows} />
      </section>
    </div>
  );
}
