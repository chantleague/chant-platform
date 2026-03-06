"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/app/lib/supabase";
import { createFixtureWithBattle } from "@/app/lib/fixtures";

interface CreateBattleFromFixtureInput {
  homeClubId: string;
  awayClubId: string;
  matchDate: string;
  league: string;
}

interface CreateBattleFromFixtureResult {
  success: boolean;
  fixtureId?: string;
  battleSlug?: string;
  message: string;
}

export async function createBattleFromFixture(
  input: CreateBattleFromFixtureInput,
): Promise<CreateBattleFromFixtureResult> {
  const result = await createFixtureWithBattle(supabase, input);

  if (!result.success) {
    return {
      success: false,
      message: result.message,
    };
  }

  revalidatePath("/battles");

  if (result.battleSlug) {
    revalidatePath(`/battles/${result.battleSlug}`);
  }

  if (result.homeClubSlug) {
    revalidatePath(`/clubs/${result.homeClubSlug}`);
  }

  if (result.awayClubSlug) {
    revalidatePath(`/clubs/${result.awayClubSlug}`);
  }

  return {
    success: true,
    fixtureId: result.fixtureId,
    battleSlug: result.battleSlug,
    message: result.message,
  };
}
