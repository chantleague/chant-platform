import Link from "next/link";
import { notFound } from "next/navigation";
import ChantCard from "@/components/ChantCard";
import { supabaseServer } from "@/app/lib/supabaseServer";
import { getChantPageData } from "../chantPageData";
import { generateChantVideoPayload } from "@/lib/chantVideo";
import { recordScoreEvent } from "@/lib/scoring/recordScoreEvent";

type PageParams = { chantId: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SITE_URL = "https://chantleague.com";

export const dynamic = "force-dynamic";

export default async function ChantVideoPage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const { chantId } = await Promise.resolve(params);
  const normalizedChantId = String(chantId || "").trim();

  if (!UUID_PATTERN.test(normalizedChantId)) {
    notFound();
  }

  const chantData = await getChantPageData(normalizedChantId);
  if (!chantData.chantId || !chantData.battleId) {
    notFound();
  }

  const payload = generateChantVideoPayload({
    lyrics: chantData.chantText,
    homeClub: chantData.homeClub,
    awayClub: chantData.awayClub,
    battleSlug: chantData.battleSlug,
  });

  const [videoPlayEvent, videoInsert] = await Promise.all([
    recordScoreEvent({
      chantId: chantData.chantId,
      battleId: chantData.battleId,
      eventType: "play",
      source: "internal_video",
      metadata: {
        battle_slug: chantData.battleSlug,
        landing_path: `/chants/${encodeURIComponent(chantData.chantId)}/video`,
      },
    }),
    supabaseServer.from("chant_videos").insert([
      {
        chant_id: chantData.chantId,
        battle_id: chantData.battleId,
        video_type: "lyrics",
        video_url: `${SITE_URL}/chants/${encodeURIComponent(chantData.chantId)}/video`,
        platform: "internal",
      },
    ]),
  ]);

  if (!videoPlayEvent.success) {
    console.error("chant video page: failed to record play event", {
      chantId: chantData.chantId,
      battleId: chantData.battleId,
      message: videoPlayEvent.message,
    });
  }

  if (videoInsert.error) {
    console.error("chant video page: failed to insert chant_videos row", {
      chantId: chantData.chantId,
      battleId: chantData.battleId,
      error: videoInsert.error,
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">TikTok Chant Engine</p>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">{chantData.battleLabel}</h1>
        <p className="text-sm text-zinc-300">Create, post, and rally votes with this chant video template.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-50">Chant Lyrics</h2>
        <pre className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm leading-6 text-zinc-200 whitespace-pre-wrap">
          {chantData.chantText}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-50">Share Buttons</h2>
        <ChantCard
          chantId={chantData.chantId}
          matchId={chantData.battleId}
          battleId={chantData.battleId}
          battleSlug={chantData.battleSlug}
          title="Video Share Card"
          categoryLabel={chantData.categoryLabel}
          chantText={chantData.chantText}
          voteCount={chantData.voteCount}
          homeClub={chantData.homeClub}
          awayClub={chantData.awayClub}
        />
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Caption Ready</p>
        <p className="mt-2 whitespace-pre-wrap text-zinc-100">{payload.shareText}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {payload.hashtags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/battles/${encodeURIComponent(chantData.battleSlug)}`}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-zinc-500"
        >
          Back To Battle
        </Link>
        <Link
          href={`/chants/${encodeURIComponent(chantData.chantId)}?ref=tiktok`}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-zinc-500"
        >
          Open Viral Link
        </Link>
      </div>
    </div>
  );
}
