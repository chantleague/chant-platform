"use server";

import { supabase } from "@/app/lib/supabase";
import { revalidatePath } from "next/cache";

interface VoteResult {
  success: boolean;
  message: string;
}

// server action invoked from client components to cast an MVP vote
export async function voteMVP(
  battleId: string,
  clubSlug: string,
  voterHash: string,
  battleSlug: string
): Promise<VoteResult> {
  "use server";

  // quick sanity checks
  if (!battleId || !clubSlug || !voterHash) {
    return { success: false, message: "Missing vote information." };
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
      .eq("voter_hash", voterHash)
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
        voter_hash: voterHash,
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
