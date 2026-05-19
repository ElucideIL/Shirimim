"use server";

import { MAX_ATTEMPTS } from "@/lib/constants";
import { getDayNumber, getTrackForDay } from "@/lib/daily";
import type { TurnInput, TurnResult } from "@/lib/types";

/**
 * Validates a guess or skip server-side. The answer is resolved against the
 * server's own "today" (the client never gets the answer's track id), and the
 * artist/title are revealed only once the game is over.
 */
export async function resolveTurn(input: TurnInput): Promise<TurnResult> {
  const { action, guessTrackId, attemptIndex } = input;

  const dayNumber = getDayNumber();
  const track = await getTrackForDay(dayNumber);
  if (!track) {
    throw new Error("No track is available for today.");
  }

  const correct = action === "guess" && guessTrackId === track.id;
  const gameOver = correct || attemptIndex >= MAX_ATTEMPTS - 1;

  return {
    correct,
    gameOver,
    answer: gameOver
      ? {
          artist: track.artist,
          title: track.title,
          artworkUrl: track.artworkUrl,
        }
      : null,
  };
}
