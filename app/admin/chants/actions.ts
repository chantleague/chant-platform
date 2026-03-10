"use server";

import { revalidatePath } from "next/cache";
import { slugify } from "@/app/lib/canonicalClubRegistry";
import { supabaseServer as supabase } from "@/app/lib/supabaseServer";
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

type ChantModerationStatus = "pending" | "approved" | "rejected";

function isMissingColumnError(errorMessage: string, columnName: string) {
  if (!errorMessage) {
    return false;
  }

  const escapedColumn = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(column .*${escapedColumn}.* does not exist|Could not find the '${escapedColumn}' column)`,
    "i",
  ).test(errorMessage);
}

async function revalidateModerationPaths(matchId?: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/chants");

  const normalizedMatchId = String(matchId || "").trim();
  if (!normalizedMatchId) {
    return;
  }

  const matchLookup = await supabase
    .from("matches")
    .select("slug")
    .eq("id", normalizedMatchId)
    .maybeSingle();

  if (matchLookup.error) {
    console.error("admin/chants: failed to resolve match slug for revalidation", matchLookup.error);
    return;
  }

  const battleSlug = String(matchLookup.data?.slug || "").trim();
  if (!battleSlug) {
    return;
  }

  revalidatePath(`/battles/${battleSlug}`);
  revalidatePath(`/battle/${battleSlug}`);
}

async function updateChantStatus(chantId: string, status: ChantModerationStatus) {
  const normalizedChantId = String(chantId || "").trim();
  if (!normalizedChantId) {
    return;
  }

  const updateResult = await supabase
    .from("chants")
    .update({ status })
    .eq("id", normalizedChantId)
    .select("id, match_id, battle_id")
    .maybeSingle();

  if (updateResult.error) {
    if (isMissingColumnError(updateResult.error.message || "", "status")) {
      console.error(
        "admin/chants: status column is missing. Run latest migrations before moderation actions.",
      );
      return;
    }

    console.error("admin/chants: failed to update chant status", updateResult.error);
    return;
  }

  const matchId = updateResult.data?.match_id
    ? String(updateResult.data.match_id)
    : updateResult.data?.battle_id
      ? String(updateResult.data.battle_id)
      : "";

  await revalidateModerationPaths(matchId);
}

export async function approveChant(chantId: string) {
  await updateChantStatus(chantId, "approved");
}

export async function rejectChant(chantId: string) {
  await updateChantStatus(chantId, "rejected");
}

export async function deleteChant(chantId: string) {
  const normalizedChantId = String(chantId || "").trim();
  if (!normalizedChantId) {
    return;
  }

  const chantLookup = await supabase
    .from("chants")
    .select("id, chant_pack_id, match_id, battle_id")
    .eq("id", normalizedChantId)
    .maybeSingle();

  if (chantLookup.error) {
    console.error("admin/chants: failed to resolve chant for deletion", chantLookup.error);
    return;
  }

  if (!chantLookup.data?.id) {
    return;
  }

  const chantPackId = String(chantLookup.data.chant_pack_id || "").trim();
  const matchId = chantLookup.data.match_id
    ? String(chantLookup.data.match_id)
    : chantLookup.data.battle_id
      ? String(chantLookup.data.battle_id)
      : "";

  const deleteVotesByChant = await supabase
    .from("chant_votes")
    .delete()
    .eq("chant_id", normalizedChantId);

  if (
    deleteVotesByChant.error &&
    !isMissingColumnError(deleteVotesByChant.error.message || "", "chant_id")
  ) {
    console.error("admin/chants: failed deleting chant votes by chant_id", deleteVotesByChant.error);
  }

  if (chantPackId) {
    const deleteVotesByPack = await supabase
      .from("chant_votes")
      .delete()
      .eq("chant_pack_id", chantPackId);

    if (
      deleteVotesByPack.error &&
      !isMissingColumnError(deleteVotesByPack.error.message || "", "chant_pack_id")
    ) {
      console.error(
        "admin/chants: failed deleting chant votes by chant_pack_id",
        deleteVotesByPack.error,
      );
    }
  }

  const deleteChantResult = await supabase
    .from("chants")
    .delete()
    .eq("id", normalizedChantId);

  if (deleteChantResult.error) {
    console.error("admin/chants: failed deleting chant", deleteChantResult.error);
    return;
  }

  await revalidateModerationPaths(matchId);
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
  const matchId = String(battle.id);
  const chantPackId = String(packData.id);

  const primaryInsert = await supabase.from("chants").insert([
    {
      match_id: matchId,
      chant_pack_id: chantPackId,
      title: chantTitle,
      chant_text: chantText,
      lyrics: chantText,
      submitted_by: submittedBy,
      vote_count: 0,
      audio_url: audioUrl,
    },
  ]);

  let chantError = primaryInsert.error;

  if (chantError && /vote_count/i.test(chantError.message || "")) {
    const retryWithoutVoteCount = await supabase.from("chants").insert([
      {
        match_id: matchId,
        chant_pack_id: chantPackId,
        title: chantTitle,
        chant_text: chantText,
        lyrics: chantText,
        submitted_by: submittedBy,
        audio_url: audioUrl,
      },
    ]);

    chantError = retryWithoutVoteCount.error;
  }

  if (chantError && (chantError.message || "").toLowerCase().includes("audio_url")) {
    const fallbackWithoutAudio = await supabase.from("chants").insert([
      {
        match_id: matchId,
        chant_pack_id: chantPackId,
        title: chantTitle,
        chant_text: chantText,
        lyrics: chantText,
        submitted_by: submittedBy,
        vote_count: 0,
      },
    ]);

    chantError = fallbackWithoutAudio.error;

    if (chantError && /vote_count/i.test(chantError.message || "")) {
      const fallbackWithoutAudioOrVoteCount = await supabase.from("chants").insert([
        {
          match_id: matchId,
          chant_pack_id: chantPackId,
          title: chantTitle,
          chant_text: chantText,
          lyrics: chantText,
          submitted_by: submittedBy,
        },
      ]);

      chantError = fallbackWithoutAudioOrVoteCount.error;
    }
  }

  if (chantError && /match_id/i.test(chantError.message || "")) {
    const legacyInsert = await supabase.from("chants").insert([
      {
        battle_id: matchId,
        chant_pack_id: chantPackId,
        title: chantTitle,
        chant_text: chantText,
        lyrics: chantText,
        submitted_by: submittedBy,
        vote_count: 0,
        audio_url: audioUrl,
      },
    ]);

    chantError = legacyInsert.error;

    if (chantError && /vote_count/i.test(chantError.message || "")) {
      const legacyWithoutVoteCount = await supabase.from("chants").insert([
        {
          battle_id: matchId,
          chant_pack_id: chantPackId,
          title: chantTitle,
          chant_text: chantText,
          lyrics: chantText,
          submitted_by: submittedBy,
          audio_url: audioUrl,
        },
      ]);

      chantError = legacyWithoutVoteCount.error;
    }

    if (chantError && (chantError.message || "").toLowerCase().includes("audio_url")) {
      const legacyFallbackWithoutAudio = await supabase.from("chants").insert([
        {
          battle_id: matchId,
          chant_pack_id: chantPackId,
          title: chantTitle,
          chant_text: chantText,
          lyrics: chantText,
          submitted_by: submittedBy,
          vote_count: 0,
        },
      ]);

      chantError = legacyFallbackWithoutAudio.error;

      if (chantError && /vote_count/i.test(chantError.message || "")) {
        const legacyFallbackWithoutAudioOrVoteCount = await supabase.from("chants").insert([
          {
            battle_id: matchId,
            chant_pack_id: chantPackId,
            title: chantTitle,
            chant_text: chantText,
            lyrics: chantText,
            submitted_by: submittedBy,
          },
        ]);

        chantError = legacyFallbackWithoutAudioOrVoteCount.error;
      }
    }
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
