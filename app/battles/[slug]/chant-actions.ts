"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer as supabase } from "@/app/lib/supabaseServer";
import { resolveBattleStatus } from "@/lib/battleStatus";

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
  kickoff: string | null;
}

interface LinkFanChantAudioInput {
  chantId: string;
  battleSlug: string;
  userId: string;
  audioUrl: string;
  audioPath?: string;
  bucketName?: string;
}

interface LinkFanChantAudioDbWriteResult {
  chantRowUpdated: boolean;
  chantRowId: string | null;
  chantAudioUrl: string | null;
  chantPackUpdated: boolean;
  chantPackId: string | null;
  chantPackAudioUrl: string | null;
}

interface LinkFanChantAudioResult {
  success: boolean;
  message: string;
  bucketName?: string;
  storedAudioPath?: string | null;
  storedAudioUrl?: string;
  storedColumns?: string[];
  dbWriteResult?: LinkFanChantAudioDbWriteResult;
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

function isSubmissionWindowOpen(status?: string | null, kickoffTime?: string | null) {
  return resolveBattleStatus(kickoffTime, status) === "open";
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
    let matchLookup = await supabase
      .from("matches")
      .select("id, status, starts_at, kickoff")
      .eq("slug", battleSlug)
      .maybeSingle();

    if (matchLookup.error && /column .*kickoff.* does not exist/i.test(matchLookup.error.message || "")) {
      matchLookup = await supabase
        .from("matches")
        .select("id, status, starts_at")
        .eq("slug", battleSlug)
        .maybeSingle();
    }

    if (matchLookup.error) {
      console.error("submitFanChant: match slug lookup failed", {
        battleSlug,
        error: matchLookup.error,
      });
      return {
        match: null,
        errorMessage: "Could not look up this battle right now.",
      };
    }

    if (!matchLookup.data?.id) {
      return {
        match: null,
        errorMessage: `Could not find battle "${battleSlug}".`,
      };
    }

    const rawKickoff =
      "kickoff" in matchLookup.data && typeof matchLookup.data.kickoff === "string"
        ? matchLookup.data.kickoff
        : null;

    return {
      match: {
        id: String(matchLookup.data.id),
        status: matchLookup.data.status ? String(matchLookup.data.status) : null,
        startsAt: matchLookup.data.starts_at ? String(matchLookup.data.starts_at) : null,
        kickoff: rawKickoff,
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
    const kickoffTime = match.kickoff || match.startsAt;
    const battleStatus = resolveBattleStatus(kickoffTime, status);

    if (!isSubmissionWindowOpen(status, kickoffTime)) {
      return {
        success: false,
        message:
          battleStatus === "upcoming"
            ? "Battle is not open for submissions yet."
            : "Submission window is closed for this battle.",
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
      status: "pending",
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
  const audioPath = input.audioPath?.trim() || "";
  const requestedBucketName = input.bucketName?.trim();
  const bucketName = requestedBucketName || "chant-audio";

  if (!chantId || !battleSlug || !userId || !audioUrl) {
    return { success: false, message: "Missing chant audio details." };
  }

  console.info("linkFanChantAudio: request", {
    chantId,
    battleSlug,
    userId,
    bucketName,
    audioPath,
    audioUrl,
  });

  if (requestedBucketName && requestedBucketName !== "chant-audio") {
    console.warn("linkFanChantAudio: non-standard bucket requested", {
      requestedBucketName,
      expectedBucketName: "chant-audio",
    });
  }

  try {
    const { data: chantRow, error: chantFetchError } = await supabase
      .from("chants")
      .select("id, submitted_by, chant_pack_id")
      .eq("id", chantId)
      .maybeSingle();

    if (chantFetchError) {
      console.error("linkFanChantAudio: chant lookup failed", chantFetchError);
      console.error("UPLOAD ERROR", {
        stage: "chant-lookup",
        chantId,
        battleSlug,
        audioPath,
        audioUrl,
        error: chantFetchError.message || "chant lookup failed",
      });
      return { success: false, message: "Could not find the chant to attach audio." };
    }

    let resolvedChantId = chantRow?.id ? String(chantRow.id) : "";
    let resolvedPackId = chantRow?.chant_pack_id ? String(chantRow.chant_pack_id) : "";
    let submitter = chantRow?.submitted_by ? String(chantRow.submitted_by) : "";

    if (!resolvedChantId) {
      const byPackLookup = await supabase
        .from("chants")
        .select("id, submitted_by, chant_pack_id")
        .eq("chant_pack_id", chantId)
        .maybeSingle();

      if (byPackLookup.error) {
        console.error("linkFanChantAudio: chant pack lookup failed", byPackLookup.error);
        return { success: false, message: "Could not find the chant to attach audio." };
      }

      if (byPackLookup.data?.id) {
        resolvedChantId = String(byPackLookup.data.id);
        resolvedPackId = byPackLookup.data.chant_pack_id
          ? String(byPackLookup.data.chant_pack_id)
          : chantId;
        submitter = byPackLookup.data.submitted_by
          ? String(byPackLookup.data.submitted_by)
          : submitter;
      } else {
        resolvedPackId = chantId;
      }
    }

    if (submitter && submitter !== userId) {
      console.error("UPLOAD ERROR", {
        stage: "submitter-validation",
        chantId,
        battleSlug,
        audioPath,
        audioUrl,
        error: "only the chant submitter can attach audio",
      });
      return { success: false, message: "Only the chant submitter can attach audio." };
    }

    let linked = false;
    let audioColumnMissing = false;
    const storedColumns: string[] = [];
    let updatedChantId: string | null = null;
    let updatedChantAudioUrl: string | null = null;
    let updatedPackId: string | null = null;
    let updatedPackAudioUrl: string | null = null;

    if (resolvedChantId) {
      const { data: chantUpdateRow, error: updateError } = await supabase
        .from("chants")
        .update({ audio_url: audioUrl })
        .eq("id", resolvedChantId)
        .select("id, audio_url")
        .maybeSingle();

      if (updateError) {
        console.error("linkFanChantAudio: chant update failed", updateError);
        if ((updateError.message || "").toLowerCase().includes("audio_url")) {
          audioColumnMissing = true;
        } else {
          console.error("UPLOAD ERROR", {
            stage: "chants-update",
            chantId: resolvedChantId,
            battleSlug,
            audioPath,
            audioUrl,
            error: updateError.message || "chants update failed",
          });
          return { success: false, message: "Could not save the chant audio link." };
        }
      } else if (chantUpdateRow?.id) {
        linked = true;
        storedColumns.push("chants.audio_url");
        updatedChantId = String(chantUpdateRow.id);
        updatedChantAudioUrl = chantUpdateRow.audio_url ? String(chantUpdateRow.audio_url) : null;
      } else {
        console.warn("linkFanChantAudio: chant update returned no row", {
          resolvedChantId,
          audioUrl,
        });
      }
    }

    if (resolvedPackId) {
      const packLookup = await supabase
        .from("chant_packs")
        .select("id")
        .eq("id", resolvedPackId)
        .maybeSingle();

      if (packLookup.error) {
        console.error("linkFanChantAudio: chant pack existence lookup failed", packLookup.error);
      } else if (packLookup.data?.id) {
        const { data: packUpdateRow, error: packUpdateError } = await supabase
          .from("chant_packs")
          .update({ audio_url: audioUrl })
          .eq("id", resolvedPackId)
          .select("id, audio_url")
          .maybeSingle();

        if (packUpdateError) {
          console.error("linkFanChantAudio: chant pack update failed", packUpdateError);
          if ((packUpdateError.message || "").toLowerCase().includes("audio_url")) {
            audioColumnMissing = true;
          }
        } else if (packUpdateRow?.id) {
          linked = true;
          storedColumns.push("chant_packs.audio_url");
          updatedPackId = String(packUpdateRow.id);
          updatedPackAudioUrl = packUpdateRow.audio_url ? String(packUpdateRow.audio_url) : null;
        } else {
          console.warn("linkFanChantAudio: chant pack update returned no row", {
            resolvedPackId,
            audioUrl,
          });
        }
      }
    }

    if (!linked) {
      if (audioColumnMissing) {
        console.error("UPLOAD ERROR", {
          stage: "audio-column-missing",
          chantId,
          battleSlug,
          audioPath,
          audioUrl,
          error: "audio column missing",
        });
        return {
          success: false,
          message: "Audio column is unavailable. Run the latest DB migrations.",
        };
      }

      console.error("UPLOAD ERROR", {
        stage: "no-linked-row",
        chantId,
        battleSlug,
        audioPath,
        audioUrl,
        error: "no chant row or chant pack row linked",
      });
      return { success: false, message: "Could not find the chant to attach audio." };
    }

    const dbWriteResult: LinkFanChantAudioDbWriteResult = {
      chantRowUpdated: Boolean(updatedChantId),
      chantRowId: updatedChantId,
      chantAudioUrl: updatedChantAudioUrl,
      chantPackUpdated: Boolean(updatedPackId),
      chantPackId: updatedPackId,
      chantPackAudioUrl: updatedPackAudioUrl,
    };

    console.info("linkFanChantAudio: db write result", {
      bucketName,
      storedAudioPath: audioPath,
      storedAudioUrl: audioUrl,
      storedColumns,
      dbWriteResult,
    });

    console.info("UPLOAD SUCCESS");
    console.info("FILE PATH", `${bucketName}/${audioPath || "unknown-path"}`);
    console.info("PUBLIC URL", audioUrl);

    revalidatePath(`/battles/${battleSlug}`);
    revalidatePath(`/battle/${battleSlug}`);
    revalidatePath("/admin/chants");

    return {
      success: true,
      message: "Fan chant audio linked successfully.",
      bucketName,
      storedAudioPath: audioPath || null,
      storedAudioUrl: audioUrl,
      storedColumns,
      dbWriteResult,
    };
  } catch (error) {
    console.error("linkFanChantAudio: unexpected error", {
      chantId,
      battleSlug,
      bucketName,
      audioPath,
      error,
    });
    console.error("UPLOAD ERROR", {
      stage: "unexpected",
      chantId,
      battleSlug,
      audioPath,
      audioUrl,
      error,
    });
    return { success: false, message: "Could not link chant audio right now." };
  }
}
