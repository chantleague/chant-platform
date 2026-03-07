"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer as supabase } from "@/app/lib/supabaseServer";

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

interface AdaptiveChantsInsertResult {
  row: Record<string, unknown> | null;
  errorMessage: string;
  attemptMessages: string[];
}

interface AdaptiveChantPackInsertResult {
  row: Record<string, unknown> | null;
  errorMessage: string;
  attemptMessages: string[];
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

function extractMissingTableColumn(errorMessage: string, tableName: string): string | null {
  const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `Could not find the '([^']+)' column of '${escapedTableName}' in the schema cache`,
    "i",
  );
  const match = errorMessage.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  return match[1];
}

async function adaptiveCreateChantPack(
  seedPayload: Record<string, unknown>,
): Promise<AdaptiveChantPackInsertResult> {
  const disabledColumns = new Set<string>();
  const attemptMessages: string[] = [];
  let lastErrorMessage = "";

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const payloadEntries = Object.entries(seedPayload).filter(([column, value]) => {
      if (disabledColumns.has(column)) {
        return false;
      }

      return typeof value !== "undefined";
    });

    if (payloadEntries.length === 0) {
      break;
    }

    const payload = Object.fromEntries(payloadEntries);

    const insertResponse = await supabase
      .from("chant_packs")
      .insert([payload])
      .select("id")
      .single();

    if (!insertResponse.error && insertResponse.data) {
      return {
        row: insertResponse.data as Record<string, unknown>,
        errorMessage: "",
        attemptMessages,
      };
    }

    const message = insertResponse.error?.message || "unknown error";
    lastErrorMessage = message;
    attemptMessages.push(`attempt-${attempt}: ${message}`);

    const missingColumn = extractMissingTableColumn(message, "chant_packs");
    if (missingColumn) {
      disabledColumns.add(missingColumn);
      continue;
    }

    break;
  }

  return {
    row: null,
    errorMessage: lastErrorMessage,
    attemptMessages,
  };
}

async function adaptiveInsertChant(
  seedPayload: Record<string, unknown>,
): Promise<AdaptiveChantsInsertResult> {
  const disabledColumns = new Set<string>();
  const attemptMessages: string[] = [];
  let lastErrorMessage = "";

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const payloadEntries = Object.entries(seedPayload).filter(([column, value]) => {
      if (disabledColumns.has(column)) {
        return false;
      }

      return typeof value !== "undefined";
    });

    if (payloadEntries.length === 0) {
      break;
    }

    const payload = Object.fromEntries(payloadEntries);

    const insertResponse = await supabase
      .from("chants")
      .insert([payload])
      .select("*")
      .single();

    if (!insertResponse.error && insertResponse.data) {
      return {
        row: insertResponse.data as Record<string, unknown>,
        errorMessage: "",
        attemptMessages,
      };
    }

    const message = insertResponse.error?.message || "unknown error";
    lastErrorMessage = message;
    attemptMessages.push(`attempt-${attempt}: ${message}`);

    const missingColumn = extractMissingTableColumn(message, "chants");
    if (missingColumn) {
      disabledColumns.add(missingColumn);
      continue;
    }

    if (/foreign key/i.test(message) && /chant_pack_id/i.test(message)) {
      disabledColumns.add("chant_pack_id");
      continue;
    }

    break;
  }

  return {
    row: null,
    errorMessage: lastErrorMessage,
    attemptMessages,
  };
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

    const createdAt = new Date().toISOString();
    const packSeedPayload: Record<string, unknown> = {
      match_id: resolvedMatchId,
      battle_id: resolvedMatchId,
      match_slug: battleSlug,
      battle_slug: battleSlug,
      title,
      description: chantText,
      chant_text: chantText,
      lyrics: chantText,
      official: false,
      created_at: createdAt,
    };

    let createdPackId: string | null = null;
    const packInsert = await adaptiveCreateChantPack(packSeedPayload);
    if (packInsert.row?.id) {
      createdPackId = String(packInsert.row.id);
    } else if (packInsert.errorMessage) {
      console.warn("submitFanChant: unable to create chant pack before insert", {
        battleSlug,
        matchId: resolvedMatchId,
        error: packInsert.errorMessage,
        attempts: packInsert.attemptMessages,
      });
    }

    const seedPayload: Record<string, unknown> = {
      match_id: resolvedMatchId,
      battle_id: resolvedMatchId,
      match_slug: battleSlug,
      battle_slug: battleSlug,
      chant_pack_id: createdPackId || undefined,
      chant_text: chantText,
      lyrics: chantText,
      text: chantText,
      content: chantText,
      description: chantText,
      chant: chantText,
      title,
      submitted_by: userId,
      user_id: userId,
      fan_id: userId,
      created_by: userId,
      vote_count: 0,
      votes: 0,
      created_at: createdAt,
      submitted_at: createdAt,
      club_id: clubId || undefined,
      official: false,
    };

    const adaptiveInsert = await adaptiveInsertChant(seedPayload);
    const chantRow = adaptiveInsert.row;
    const chantErrorMessage = adaptiveInsert.errorMessage;

    if (!chantRow) {
      console.error("submitFanChant: failed creating chant", {
        battleSlug,
        matchId: resolvedMatchId,
        errorMessage: chantErrorMessage,
        attempts: adaptiveInsert.attemptMessages,
      });

      if ((chantErrorMessage || "").includes("submission_limit_reached")) {
        if (createdPackId) {
          try {
            await supabase.from("chant_packs").delete().eq("id", createdPackId);
          } catch (cleanupError) {
            console.error("submitFanChant: cleanup failed", cleanupError);
          }
        }

        return {
          success: false,
          message: `You can submit up to ${MAX_CHANTS_PER_USER} chants per battle.`,
        };
      }

      // If chants insert remains incompatible but pack was created, keep the pack and
      // treat submission as successful so fan chant feeds can render from chant_packs.
      if (createdPackId) {
        revalidatePath(`/battles/${battleSlug}`);
        revalidatePath(`/battle/${battleSlug}`);

        return {
          success: true,
          message: "Chant submitted. Rally your fans to vote.",
          chantId: createdPackId,
          chant: {
            id: createdPackId,
            chant_pack_id: createdPackId,
            match_id: resolvedMatchId,
            chant_text: chantText,
            created_at: createdAt,
          },
        };
      }

      // Best-effort cleanup if the fallback path created a pack but chant insert still failed.
      if (createdPackId) {
        try {
          await supabase.from("chant_packs").delete().eq("id", createdPackId);
        } catch (cleanupError) {
          console.error("submitFanChant: cleanup failed", cleanupError);
        }
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
