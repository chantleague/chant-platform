"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/app/lib/supabase";

const MAX_CHANTS_PER_USER = 2;

interface SubmitFanChantInput {
  battleId: string;
  battleSlug: string;
  userId: string;
  title: string;
  lyrics: string;
}

interface SubmitFanChantResult {
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
  const title = input.title?.trim().slice(0, 80);
  const lyrics = input.lyrics?.trim().slice(0, 500);

  if (!battleId || !battleSlug || !userId || !title || !lyrics) {
    return { success: false, message: "Missing chant submission information." };
  }

  if (title.length < 3 || lyrics.length < 8) {
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
          description: lyrics,
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

    const { error: chantError } = await supabase.from("chants").insert([
      {
        battle_id: battleId,
        chant_pack_id: chantPackId,
        title,
        lyrics,
        submitted_by: userId,
      },
    ]);

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

    return { success: true, message: "Chant submitted. Rally your fans to vote." };
  } catch (error) {
    console.error("submitFanChant: unexpected error", error);
    return { success: false, message: "Could not submit chant right now." };
  }
}
