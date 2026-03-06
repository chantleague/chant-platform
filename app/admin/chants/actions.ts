"use server";

import { revalidatePath } from "next/cache";
import { slugify } from "@/app/lib/canonicalClubRegistry";
import { supabase } from "@/app/lib/supabase";
import { generateChant } from "@/lib/ai/generateChant";
import { generateChantAudio } from "@/lib/ai/generateChantAudio";

interface GenerateAiChantInput {
  club: string;
  player: string;
  rival: string;
}

interface GenerateAiChantResult {
  success: boolean;
  message: string;
  chantText?: string;
  audioUrl?: string | null;
}

interface ClubLookup {
  id: string;
  slug: string;
  name: string;
}

async function resolveClub(input: string): Promise<ClubLookup | null> {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const candidateSlug = slugify(trimmed);

  const { data: exactData } = await supabase
    .from("clubs")
    .select("id, slug, name")
    .eq("slug", candidateSlug)
    .maybeSingle();

  if (exactData) {
    return exactData as ClubLookup;
  }

  const { data: fuzzyData, error: fuzzyError } = await supabase
    .from("clubs")
    .select("id, slug, name")
    .ilike("name", `%${trimmed}%`)
    .limit(1);

  if (fuzzyError) {
    console.error("admin/chants: club lookup error", fuzzyError);
    return null;
  }

  if (!fuzzyData || fuzzyData.length === 0) {
    return null;
  }

  return fuzzyData[0] as ClubLookup;
}

export async function generateAdminAiChant(
  input: GenerateAiChantInput,
): Promise<GenerateAiChantResult> {
  const club = input.club.trim();
  const player = input.player.trim();
  const rival = input.rival.trim();

  if (!club || !player || !rival) {
    return {
      success: false,
      message: "Club, player, and rival club are required.",
    };
  }

  const [homeClub, awayClub] = await Promise.all([resolveClub(club), resolveClub(rival)]);

  if (!homeClub || !awayClub) {
    return {
      success: false,
      message: "Could not resolve one or both clubs.",
    };
  }

  const { data: candidateBattles, error: battleError } = await supabase
    .from("matches")
    .select("id, slug, home_team, away_team, starts_at")
    .in("home_team", [homeClub.slug, awayClub.slug])
    .in("away_team", [homeClub.slug, awayClub.slug])
    .order("starts_at", { ascending: true });

  if (battleError) {
    console.error("admin/chants: battle lookup error", battleError);
    return {
      success: false,
      message: "Could not find a battle for these clubs.",
    };
  }

  const battle = ((candidateBattles as Array<Record<string, unknown>> | null) || []).find(
    (row) => {
      const homeTeam = String(row.home_team || "");
      const awayTeam = String(row.away_team || "");
      return (
        (homeTeam === homeClub.slug && awayTeam === awayClub.slug) ||
        (homeTeam === awayClub.slug && awayTeam === homeClub.slug)
      );
    },
  );

  if (!battle?.id || !battle?.slug) {
    return {
      success: false,
      message: "No battle exists yet for this club pairing.",
    };
  }

  const chantText = generateChant(homeClub.name, player, awayClub.name);
  const audioResult = await generateChantAudio(chantText);
  const audioUrl = audioResult.audioUrl;

  if (!audioResult.success && audioResult.error) {
    console.error("admin/chants: suno generation unavailable", audioResult.error);
  }

  const chantTitle = `${player} Chant`;

  const { data: packData, error: packError } = await supabase
    .from("chant_packs")
    .insert([
      {
        match_id: String(battle.id),
        title: chantTitle,
        description: chantText,
        audio_url: audioUrl,
        official: false,
      },
    ])
    .select("id")
    .single();

  if (packError || !packData?.id) {
    console.error("admin/chants: chant pack insert failed", packError);
    return {
      success: false,
      message: "Could not save generated chant.",
    };
  }

  const submittedBy = `admin-ai-${Date.now()}`;
  const chantInsertWithAudio = await supabase.from("chants").insert([
    {
      battle_id: String(battle.id),
      chant_pack_id: String(packData.id),
      title: chantTitle,
      lyrics: chantText,
      submitted_by: submittedBy,
      audio_url: audioUrl,
    },
  ]);

  let chantError = chantInsertWithAudio.error;

  if (chantError && (chantError.message || "").toLowerCase().includes("audio_url")) {
    const fallbackInsert = await supabase.from("chants").insert([
      {
        battle_id: String(battle.id),
        chant_pack_id: String(packData.id),
        title: chantTitle,
        lyrics: chantText,
        submitted_by: submittedBy,
      },
    ]);

    chantError = fallbackInsert.error;
  }

  if (chantError) {
    console.error("admin/chants: chant insert failed", chantError);
    try {
      await supabase.from("chant_packs").delete().eq("id", String(packData.id));
    } catch (cleanupError) {
      console.error("admin/chants: cleanup failed", cleanupError);
    }

    return {
      success: false,
      message: "Could not save generated chant.",
    };
  }

  revalidatePath("/admin/chants");
  revalidatePath(`/battles/${String(battle.slug)}`);

  return {
    success: true,
    message: audioUrl
      ? "AI chant and audio generated successfully."
      : "AI chant generated, but Suno audio is unavailable.",
    chantText,
    audioUrl,
  };
}
