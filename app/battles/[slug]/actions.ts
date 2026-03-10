"use server";

import { supabaseServer as supabase } from "@/app/lib/supabaseServer";
import { revalidatePath } from "next/cache";

interface VoteResult {
  success: boolean;
  message: string;
}

function isVotingOpen(status?: string | null, kickoffTime?: string | null) {
  const normalizedStatus = (status || "").toLowerCase();
  if (normalizedStatus === "completed" || normalizedStatus === "finished") {
    return false;
  }

  const kickoff = String(kickoffTime || "").trim();
  if (!kickoff) {
    return true;
  }

  const kickoffTimestamp = new Date(kickoff).getTime();
  if (Number.isNaN(kickoffTimestamp)) {
    return true;
  }

  return Date.now() < kickoffTimestamp;
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
    let matchQuery = await supabase
      .from("matches")
      .select("id, status, starts_at, kickoff_time")
      .eq("id", battleId)
      .maybeSingle();

    if (
      matchQuery.error &&
      /column .*kickoff_time.* does not exist/i.test(matchQuery.error.message || "")
    ) {
      matchQuery = await supabase
        .from("matches")
        .select("id, status, starts_at")
        .eq("id", battleId)
        .maybeSingle();
    }

    if (matchQuery.error) {
      console.error("voteMVP: failed to validate battle window", matchQuery.error);
      return { success: false, message: "Could not validate vote window." };
    }

    if (!matchQuery.data?.id) {
      return { success: false, message: "Battle not found." };
    }

    const rawKickoff =
      "kickoff_time" in matchQuery.data && typeof matchQuery.data.kickoff_time === "string"
        ? matchQuery.data.kickoff_time
        : null;
    const kickoffTime = rawKickoff || (matchQuery.data.starts_at ? String(matchQuery.data.starts_at) : null);

    if (!isVotingOpen(matchQuery.data.status ? String(matchQuery.data.status) : null, kickoffTime)) {
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
