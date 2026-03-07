"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/app/lib/supabase";

const MAX_CHANTS_PER_USER = 2;

interface SubmitFanChantInput {
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

interface ResolvedMatch {
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

async function resolveMatchBySlug(
  battleSlug: string,
): Promise<{ match: ResolvedMatch | null; errorMessage?: string }> {
  try {
    const { data, error } = await supabase
      .from("matches")
      .select("id, status, starts_at")
      .eq("slug", battleSlug)
      .maybeSingle();

    if (error) {
      console.error("submitFanChant: match slug lookup failed", {
        battleSlug,
        error,
      });
      return {
        match: null,
        errorMessage: "Could not look up this battle right now.",
      };
    }

    if (!data?.id) {
      return {
        match: null,
        errorMessage: `Could not find battle "${battleSlug}".`,
      };
    }

    return {
      match: {
        id: String(data.id),
        status: data.status ? String(data.status) : null,
        startsAt: data.starts_at ? String(data.starts_at) : null,
      },
    };
  } catch (error) {
    console.error("submitFanChant: unexpected match slug lookup error", {
      battleSlug,
      error,
    });
    return {
      match: null,
      errorMessage: "Could not look up this battle right now.",
    };
  }
}

export async function submitFanChant(
  input: SubmitFanChantInput,
): Promise<SubmitFanChantResult> {
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
    const { match, errorMessage: matchLookupMessage } = await resolveMatchBySlug(battleSlug);

    if (!match) {
      return {
        success: false,
        message: matchLookupMessage || "Could not find this battle.",
      };
    }

    const resolvedMatchId = match.id;

    const status = match.status;
    const startsAt = match.startsAt;

    if (!isSubmissionWindowOpen(status, startsAt)) {
      return {
        success: false,
        message: "Submission window is closed for this battle.",
      };
    }

    let existingCount: number | null = null;

    const countByMatch = await supabase
      .from("chants")
      .select("id", { count: "exact", head: true })
      .eq("match_id", resolvedMatchId)
      .eq("submitted_by", userId);

    if (countByMatch.error) {
      // MVP fallback: do not block submission if count validation is unavailable.
      console.warn("submitFanChant: submission limit check unavailable, allowing insert", {
        matchId: resolvedMatchId,
        battleSlug,
        userId,
        error: countByMatch.error.message,
      });

      const canFallbackToLegacyBattleId = /column .*match_id.* does not exist/i.test(
        countByMatch.error.message || "",
      );

      if (canFallbackToLegacyBattleId) {
        const legacyCount = await supabase
          .from("chants")
          .select("id", { count: "exact", head: true })
          .eq("battle_id", resolvedMatchId)
          .eq("submitted_by", userId);

        if (legacyCount.error) {
          console.warn("submitFanChant: legacy battle_id count fallback failed", {
            matchId: resolvedMatchId,
            battleSlug,
            userId,
            error: legacyCount.error.message,
          });
        } else if (typeof legacyCount.count === "number") {
          existingCount = legacyCount.count;
        }
      }
    } else if (typeof countByMatch.count === "number") {
      existingCount = countByMatch.count;
    } else {
      console.warn("submitFanChant: submission limit count returned null, allowing insert", {
        matchId: resolvedMatchId,
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
          match_id: resolvedMatchId,
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

    // Preferred payload for current schema: chants are tied to matches via match_id.
    const schemaAlignedPayload: Record<string, unknown> = {
      match_id: resolvedMatchId,
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

    const requiredFieldsPayload: Record<string, unknown> = {
      match_id: resolvedMatchId,
      chant_text: chantText,
      vote_count: 0,
      created_at: createdAt,
    };

    const requiredFieldsWithoutVoteCountPayload: Record<string, unknown> = {
      match_id: resolvedMatchId,
      chant_text: chantText,
      created_at: createdAt,
    };

    const legacyBattlePayload: Record<string, unknown> = {
      battle_id: resolvedMatchId,
      chant_pack_id: chantPackId,
      title,
      chant_text: chantText,
      lyrics: chantText,
      submitted_by: userId,
      vote_count: 0,
      created_at: createdAt,
      club_id: clubId,
      audio_url: null,
    };

    const legacyBattlePayloadWithoutVoteCount: Record<string, unknown> = {
      battle_id: resolvedMatchId,
      chant_pack_id: chantPackId,
      title,
      chant_text: chantText,
      lyrics: chantText,
      submitted_by: userId,
      created_at: createdAt,
    };

    const insertAttempts: Array<{ label: string; payload: Record<string, unknown> }> = [
      { label: "schema-aligned", payload: schemaAlignedPayload },
      { label: "required-fields", payload: requiredFieldsPayload },
      { label: "required-fields-without-vote-count", payload: requiredFieldsWithoutVoteCountPayload },
      { label: "legacy-battle-id", payload: legacyBattlePayload },
      { label: "legacy-battle-id-without-vote-count", payload: legacyBattlePayloadWithoutVoteCount },
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
        matchId: resolvedMatchId,
        chantPackId,
        payloadKeys: Object.keys(attempt.payload),
        error: insertResponse.error,
      });

      const isSchemaDriftError = /(column .* does not exist|audio_url|club_id|chant_text|vote_count|match_id|battle_id)/i.test(
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
