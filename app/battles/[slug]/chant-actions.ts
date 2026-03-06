"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/app/lib/supabase";

const MAX_CHANTS_PER_USER = 2;

interface SubmitFanChantInput {
  battleId: string;
  battleSlug: string;
  userId: string;
  title?: string;
  lyrics?: string;
  chantText?: string;
  clubId?: string;
}

interface SubmitFanChantResult {
  success: boolean;
  message: string;
  chantId?: string;
}

interface LinkFanChantAudioInput {
  chantId: string;
  battleSlug: string;
  userId: string;
  audioUrl: string;
}

interface LinkFanChantAudioResult {
  success: boolean;
  message: string;
}

function isSubmissionWindowOpen(status?: string | null, startsAt?: string | null) {
  const normalizedStatus = (status || "").toLowerCase();
  if (normalizedStatus && normalizedStatus !== "upcoming") {
    return false;
  }

  if (!startsAt) {
    return true;
  }

  const kickoff = new Date(startsAt).getTime();
  if (Number.isNaN(kickoff)) {
    return true;
  }

  return Date.now() < kickoff;
}

export async function submitFanChant(
  input: SubmitFanChantInput,
): Promise<SubmitFanChantResult> {
  const battleId = input.battleId?.trim();
  const battleSlug = input.battleSlug?.trim();
  const userId = input.userId?.trim();
  const clubId = input.clubId?.trim() || null;
  const chantText = (input.chantText || input.lyrics || "").trim().slice(0, 500);

  const requestedTitle = (input.title || "").trim().slice(0, 80);
  const inferredTitle = chantText
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ")
    .trim();
  const title = (requestedTitle || inferredTitle || "Fan Chant").slice(0, 80);

  if (!battleId || !battleSlug || !userId || !title || !chantText) {
    return { success: false, message: "Missing chant submission information." };
  }

  if (title.length < 3 || chantText.length < 8) {
    return {
      success: false,
      message: "Please add a chant title and at least one full chant line.",
    };
  }

  try {
    const { data: battle, error: battleError } = await supabase
      .from("matches")
      .select("id, status, starts_at")
      .eq("id", battleId)
      .single();

    if (battleError || !battle) {
      console.error("submitFanChant: failed to fetch battle", battleError);
      return { success: false, message: "Could not find this battle." };
    }

    const status = (battle.status as string | null) || null;
    const startsAt = (battle.starts_at as string | null) || null;

    if (!isSubmissionWindowOpen(status, startsAt)) {
      return {
        success: false,
        message: "Submission window is closed for this battle.",
      };
    }

    const { count: existingCount, error: countError } = await supabase
      .from("chants")
      .select("id", { count: "exact", head: true })
      .eq("battle_id", battleId)
      .eq("submitted_by", userId);

    if (countError) {
      console.error("submitFanChant: failed counting user chants", countError);
      return { success: false, message: "Could not validate submission limits." };
    }

    if ((existingCount || 0) >= MAX_CHANTS_PER_USER) {
      return {
        success: false,
        message: `You can submit up to ${MAX_CHANTS_PER_USER} chants per battle.`,
      };
    }

    const { data: pack, error: packError } = await supabase
      .from("chant_packs")
      .insert([
        {
          match_id: battleId,
          title,
          description: chantText,
          official: false,
        },
      ])
      .select("id")
      .single();

    if (packError || !pack?.id) {
      console.error("submitFanChant: failed creating chant pack", packError);
      return { success: false, message: "Could not save your chant." };
    }

    const chantPackId = pack.id as string;

    const legacyInsertPayload: Record<string, unknown> = {
      battle_id: battleId,
      chant_pack_id: chantPackId,
      title,
      lyrics: chantText,
      submitted_by: userId,
    };

    const audioInsertPayload: Record<string, unknown> = {
      ...legacyInsertPayload,
      audio_url: null,
    };

    const extendedInsertPayload: Record<string, unknown> = {
      ...audioInsertPayload,
      club_id: clubId,
      chant_text: chantText,
    };

    const initialInsert = await supabase
      .from("chants")
      .insert([
        extendedInsertPayload,
      ])
      .select("id")
      .single();

    let chantRow = initialInsert.data;
    let chantError = initialInsert.error;

    if (chantError) {
      const fallbackInsert = await supabase
        .from("chants")
        .insert([audioInsertPayload])
        .select("id")
        .single();

      chantRow = fallbackInsert.data;
      chantError = fallbackInsert.error;

      if (chantError && /audio_url/i.test(chantError.message || "")) {
        const legacyFallbackInsert = await supabase
          .from("chants")
          .insert([legacyInsertPayload])
          .select("id")
          .single();

        chantRow = legacyFallbackInsert.data;
        chantError = legacyFallbackInsert.error;
      }
    }

    if (chantError) {
      console.error("submitFanChant: failed creating chant", chantError);

      // Best-effort cleanup of the pack row if chant insert fails.
      try {
        await supabase.from("chant_packs").delete().eq("id", chantPackId);
      } catch (cleanupError) {
        console.error("submitFanChant: cleanup failed", cleanupError);
      }

      if ((chantError.message || "").includes("submission_limit_reached")) {
        return {
          success: false,
          message: `You can submit up to ${MAX_CHANTS_PER_USER} chants per battle.`,
        };
      }

      return { success: false, message: "Could not save your chant." };
    }

    revalidatePath(`/battles/${battleSlug}`);
    revalidatePath(`/battle/${battleSlug}`);

    return {
      success: true,
      message: "Chant submitted. Rally your fans to vote.",
      chantId: chantRow?.id ? String(chantRow.id) : undefined,
    };
  } catch (error) {
    console.error("submitFanChant: unexpected error", error);
    return { success: false, message: "Could not submit chant right now." };
  }
}

export async function linkFanChantAudio(
  input: LinkFanChantAudioInput,
): Promise<LinkFanChantAudioResult> {
  const chantId = input.chantId?.trim();
  const battleSlug = input.battleSlug?.trim();
  const userId = input.userId?.trim();
  const audioUrl = input.audioUrl?.trim();

  if (!chantId || !battleSlug || !userId || !audioUrl) {
    return { success: false, message: "Missing chant audio details." };
  }

  try {
    const { data: chantRow, error: chantFetchError } = await supabase
      .from("chants")
      .select("id, submitted_by")
      .eq("id", chantId)
      .single();

    if (chantFetchError || !chantRow?.id) {
      console.error("linkFanChantAudio: chant lookup failed", chantFetchError);
      return { success: false, message: "Could not find the chant to attach audio." };
    }

    if (String(chantRow.submitted_by || "") !== userId) {
      return { success: false, message: "Only the chant submitter can attach audio." };
    }

    const { error: updateError } = await supabase
      .from("chants")
      .update({ audio_url: audioUrl })
      .eq("id", chantId);

    if (updateError) {
      console.error("linkFanChantAudio: update failed", updateError);
      if ((updateError.message || "").toLowerCase().includes("audio_url")) {
        return {
          success: false,
          message: "Audio column is unavailable. Run the latest DB migrations.",
        };
      }

      return { success: false, message: "Could not save the chant audio link." };
    }

    revalidatePath(`/battles/${battleSlug}`);
    revalidatePath(`/battle/${battleSlug}`);
    revalidatePath("/admin/chants");

    return { success: true, message: "Fan chant audio linked successfully." };
  } catch (error) {
    console.error("linkFanChantAudio: unexpected error", error);
    return { success: false, message: "Could not link chant audio right now." };
  }
}
