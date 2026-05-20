"use server";

import { getServiceClient } from "@/lib/supabase";
import type { ResultRow } from "@/lib/types";

/** Record (or update) a player's result for one day. Upsert keyed by player. */
export async function submitDailyResult(input: {
  dayNumber: number;
  playerId: string;
  name: string;
  won: boolean;
  guesses: number;
}): Promise<void> {
  const name = input.name.trim().slice(0, 24);
  if (!name || !input.playerId) return;

  const { error } = await getServiceClient()
    .from("daily_results")
    .upsert(
      {
        day_number: input.dayNumber,
        player_id: input.playerId,
        name,
        won: input.won,
        guesses: input.guesses,
      },
      { onConflict: "day_number,player_id" },
    );
  if (error) throw new Error(`submitDailyResult failed: ${error.message}`);
}

/** Everyone's results for a day — winners first (fewest guesses), then losers. */
export async function getDailyLeaderboard(
  dayNumber: number,
): Promise<ResultRow[]> {
  const { data, error } = await getServiceClient()
    .from("daily_results")
    .select("player_id, name, won, guesses, created_at")
    .eq("day_number", dayNumber)
    .order("won", { ascending: false })
    .order("guesses", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getDailyLeaderboard failed: ${error.message}`);

  return (data ?? []).map((r) => ({
    playerId: r.player_id as string,
    name: r.name as string,
    won: r.won as boolean,
    guesses: r.guesses as number,
  }));
}
