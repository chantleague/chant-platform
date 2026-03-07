"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/app/lib/supabase";

const MAX_CHANTS_PER_USER = 2;

interface SubmitFanChantInput {
  battleId?: string;
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
  chant?: Record<string, unknown>;
}

interface ResolvedBattle {
  id: string;
  status: string | null;
  startsAt: string | null;
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

async function resolveBattleBySlug(
  battleSlug: string,
  requestedBattleId?: string,
): Promise<{ battle: ResolvedBattle | null; errorMessage?: string }> {
  try {
    const { data, error } = await supabase
      .from("matches")
      .select("id, status, starts_at")
      .eq("slug", battleSlug)
      .maybeSingle();

    if (error) {
      console.error("submitFanChant: battle slug lookup failed", {
        battleSlug,
        requestedBattleId,
        error,
      });
      return {
        battle: null,
        errorMessage: "Could not look up this battle right now.",
      };
    }

    if (!data?.id) {
      return {
        battle: null,
        errorMessage: `Could not find battle "${battleSlug}".`,
      };
    }

    const resolvedBattleId = String(data.id);
    const trimmedRequestedId = requestedBattleId?.trim();

    if (trimmedRequestedId && trimmedRequestedId !== resolvedBattleId) {
      console.warn("submitFanChant: supplied battleId did not match slug lookup", {
        battleSlug,
        suppliedBattleId: trimmedRequestedId,
        resolvedBattleId,
      });
    }

    return {
      battle: {
        id: resolvedBattleId,
        status: data.status ? String(data.status) : null,
        startsAt: data.starts_at ? String(data.starts_at) : null,
      },
    };
  } catch (error) {
    console.error("submitFanChant: unexpected battle slug lookup error", {
      battleSlug,
      requestedBattleId,
      error,
    });
    return {
      battle: null,
      errorMessage: "Could not look up this battle right now.",
    };
  }
}

export async function submitFanChant(
  input: SubmitFanChantInput,
): Promise<SubmitFanChantResult> {
  const battleId = input.battleId?.trim();
  const battleSlug = input.battleSlug?.trim().toLowerCase();
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

  if (!battleSlug || !userId || !title || !chantText) {
    return { success: false, message: "Missing chant submission information." };
  }

  if (title.length < 3 || chantText.length < 8) {
    return {
      success: false,
      message: "Please add a chant title and at least one full chant line.",
    };
  }

  try {
    const { battle, errorMessage: battleLookupMessage } = await resolveBattleBySlug(
      battleSlug,
      battleId,
    );

    if (!battle) {
      return {
        success: false,
        message: battleLookupMessage || "Could not find this battle.",
      };
    }

    const resolvedBattleId = battle.id;

    const status = battle.status;
    const startsAt = battle.startsAt;

    if (!isSubmissionWindowOpen(status, startsAt)) {
      return {
        success: false,
        message: "Submission window is closed for this battle.",
      };
    }

    let existingCount: number | null = null;

    const { count, error: countError } = await supabase
      .from("chants")
      .select("id", { count: "exact", head: true })
      .eq("battle_id", resolvedBattleId)
      .eq("submitted_by", userId);

    if (countError) {
      // MVP fallback: do not block submission if count validation is unavailable.
      console.warn("submitFanChant: submission limit check unavailable, allowing insert", {
        battleId,
        resolvedBattleId,
        battleSlug,
        userId,
        error: countError.message,
      });
    } else if (typeof count === "number") {
      existingCount = count;
    } else {
      console.warn("submitFanChant: submission limit count returned null, allowing insert", {
        battleId,
        resolvedBattleId,
        battleSlug,
        userId,
      });
    }

    if (existingCount !== null && existingCount >= MAX_CHANTS_PER_USER) {
      return {
        success: false,
        message: `You can submit up to ${MAX_CHANTS_PER_USER} chants per battle.`,
      };
    }

    const { data: pack, error: packError } = await supabase
      .from("chant_packs")
      .insert([
        {
          match_id: resolvedBattleId,
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
    const createdAt = new Date().toISOString();

    const schemaAlignedPayload: Record<string, unknown> = {
      battle_id: resolvedBattleId,
      chant_pack_id: chantPackId,
      title,
      chant_text: chantText,
      lyrics: chantText,
      submitted_by: userId,
      created_at: createdAt,
      vote_count: 0,
      club_id: clubId,
      audio_url: null,
    };

    const noVoteCountPayload: Record<string, unknown> = {
      battle_id: resolvedBattleId,
      chant_pack_id: chantPackId,
      title,
      chant_text: chantText,
      lyrics: chantText,
      submitted_by: userId,
      created_at: createdAt,
      club_id: clubId,
      audio_url: null,
    };

    const leanPayload: Record<string, unknown> = {
      battle_id: resolvedBattleId,
      chant_pack_id: chantPackId,
      title,
      chant_text: chantText,
      lyrics: chantText,
      submitted_by: userId,
      created_at: createdAt,
    };

    const legacyPayloadWithCreatedAt: Record<string, unknown> = {
      battle_id: resolvedBattleId,
      chant_pack_id: chantPackId,
      title,
      lyrics: chantText,
      submitted_by: userId,
      created_at: createdAt,
    };

    const legacyPayload: Record<string, unknown> = {
      battle_id: resolvedBattleId,
      chant_pack_id: chantPackId,
      title,
      lyrics: chantText,
      submitted_by: userId,
    };

    const insertAttempts: Array<{ label: string; payload: Record<string, unknown> }> = [
      { label: "schema-aligned", payload: schemaAlignedPayload },
      { label: "without-vote-count", payload: noVoteCountPayload },
      { label: "lean", payload: leanPayload },
      { label: "legacy-with-created-at", payload: legacyPayloadWithCreatedAt },
      { label: "legacy", payload: legacyPayload },
    ];

    let chantRow: Record<string, unknown> | null = null;
    let chantError: { message?: string } | null = null;

    for (const attempt of insertAttempts) {
      const insertResponse = await supabase
        .from("chants")
        .insert([attempt.payload])
        .select("*")
        .single();

      if (!insertResponse.error && insertResponse.data) {
        chantRow = insertResponse.data as Record<string, unknown>;
        chantError = null;
        break;
      }

      chantError = insertResponse.error;

      console.error("submitFanChant: chants insert attempt failed", {
        attempt: attempt.label,
        battleSlug,
        battleId: resolvedBattleId,
        chantPackId,
        payloadKeys: Object.keys(attempt.payload),
        error: insertResponse.error,
      });

      const isSchemaDriftError = /(column .* does not exist|audio_url|club_id|chant_text|vote_count)/i.test(
        insertResponse.error?.message || "",
      );

      if (!isSchemaDriftError) {
        break;
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
      chant: chantRow || undefined,
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
