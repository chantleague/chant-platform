"use server";

import { supabaseServer as supabase } from "@/app/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import {
  getBattleLifecycleFromRow,
  isVotingOpen as isLifecycleVotingOpen,
} from "@/lib/battleLifecycle";

interface VoteResult {
  success: boolean;
  message: string;
}

function extractMissingTableColumn(errorMessage: string, tableName: string): string | null {
  const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const schemaCachePattern = new RegExp(
    `Could not find the '([^']+)' column of '${escapedTableName}' in the schema cache`,
    "i",
  );
  const schemaCacheMatch = errorMessage.match(schemaCachePattern);
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const directPattern = /column\s+(?:\w+\.)?"?([a-zA-Z0-9_]+)"?\s+does not exist/i;
  const directMatch = errorMessage.match(directPattern);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  return null;
}

async function lookupMatchLifecycleById(battleId: string) {
  const selectColumns = [
    "id",
    "status",
    "starts_at",
    "kickoff",
    "kickoff_time",
    "kickoff_at",
    "battle_opens_at",
    "submission_opens_at",
    "voting_opens_at",
    "submission_closes_at",
    "voting_closes_at",
    "winner_reveal_at",
  ];

  const disabledColumns = new Set<string>();

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const columns = selectColumns.filter((column) => !disabledColumns.has(column));
    if (columns.length === 0) {
      break;
    }

    const lookup = await supabase
      .from("matches")
      .select(columns.join(", "))
      .eq("id", battleId)
      .maybeSingle();

    if (!lookup.error) {
      return lookup;
    }

    const missingColumn = extractMissingTableColumn(lookup.error.message || "", "matches");
    if (missingColumn) {
      disabledColumns.add(missingColumn);
      continue;
    }

    return lookup;
  }

  return await supabase
    .from("matches")
    .select("id")
    .eq("id", battleId)
    .maybeSingle();
}

// server action invoked from client components to cast an MVP vote
export async function voteMVP(
  battleId: string,
  clubSlug: string,
  userId: string,
  battleSlug: string
): Promise<VoteResult> {
  "use server";

  // quick sanity checks
  if (!battleId || !clubSlug || !userId) {
    return { success: false, message: "Missing vote information." };
  }

  // hard-stop voting once kickoff has passed
  try {
    const matchQuery = await lookupMatchLifecycleById(battleId);

    if (matchQuery.error) {
      console.error("voteMVP: failed to validate battle window", matchQuery.error);
      return { success: false, message: "Could not validate vote window." };
    }

    const matchRow = (matchQuery.data as unknown as Record<string, unknown> | null) || null;

    if (!matchRow?.id) {
      return { success: false, message: "Battle not found." };
    }

    const lifecycle = getBattleLifecycleFromRow(matchRow);
    if (!isLifecycleVotingOpen(Date.now(), lifecycle)) {
      return { success: false, message: "Voting is closed for this battle." };
    }
  } catch (err) {
    console.error("voteMVP: unexpected battle window validation error", err);
    return { success: false, message: "Could not validate vote window." };
  }

  // restore stricter legacy rule: one vote per user per club per battle
  try {
    const { data: existing, error: existingErr } = await supabase
      .from("votes")
      .select("id")
      .eq("battle_id", battleId)
      .eq("club_slug", clubSlug)
      .eq("user_id", userId)
      .limit(1);

    if (existingErr) {
      console.error("voteMVP: error checking existing vote", existingErr);
    } else if (existing && existing.length > 0) {
      return { success: false, message: "You already voted for this club." };
    }
  } catch (err) {
    console.error("voteMVP: unexpected error checking existing vote", err);
  }

  // enforce 60-second throttling for same voter on this battle
  try {
    const {
      data: recent,
      error: fetchErr,
    } = await supabase
      .from("votes")
      .select("created_at")
      .eq("battle_id", battleId)
      .eq("voter_hash", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchErr) {
      console.error("voteMVP: error checking recent vote", fetchErr);
    } else if (recent && recent.length > 0) {
      const last = new Date(recent[0].created_at as string);
      const now = new Date();
      if (now.getTime() - last.getTime() < 60_000) {
        return { success: false, message: "You're voting too quickly. Try again in a minute." };
      }
    }
  } catch (err) {
    console.error("voteMVP: unexpected error checking throttle", err);
  }

  // insert the vote
  try {
    const { error: insertError } = await supabase.from("votes").insert([
      {
        battle_id: battleId,
        club_slug: clubSlug,
        user_id: userId,
        voter_hash: userId,
      },
    ]);

    if (insertError) {
      console.error("voteMVP: insert failed", insertError);
      return { success: false, message: "Could not record vote." };
    }
  } catch (err) {
    console.error("voteMVP: unexpected insert error", err);
    return { success: false, message: "Could not record vote." };
  }

  // refresh the battle page so counts update for other users
  try {
    revalidatePath(`/battles/${battleSlug}`);
  } catch (e) {
    console.error("voteMVP: revalidatePath failed", e);
  }

  return { success: true, message: "Thanks for voting!" };
}
