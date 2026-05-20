"use server";

import { MAX_ATTEMPTS } from "@/lib/constants";
import { getDayNumber, getTrackForDay } from "@/lib/daily";
import { sameArtist } from "@/lib/match";
import { getServiceClient } from "@/lib/supabase";
import type { TurnInput, TurnResult } from "@/lib/types";

/**
 * Validates a guess or skip server-side. The answer is resolved against a
 * specific day (today by default, or a past day when replaying the archive);
 * the client never gets the answer's track id, and the artist/title are
 * revealed only once the game is over.
 */
export async function resolveTurn(
  input: TurnInput,
  dayNumber?: number,
): Promise<TurnResult> {
  const { action, guessTrackId, attemptIndex } = input;

  const today = getDayNumber();
  const day = dayNumber ?? today;
  if (day > today) {
    throw new Error("That puzzle is not available yet.");
  }
  const track = await getTrackForDay(day);
  if (!track) {
    throw new Error("No track is available for that day.");
  }

  const correct = action === "guess" && guessTrackId === track.id;

  // Wrong song, but did the player at least name the right artist?
  let artistMatch = false;
  if (action === "guess" && !correct && guessTrackId) {
    const { data } = await getServiceClient()
      .from("tracks")
      .select("artist")
      .eq("id", guessTrackId)
      .single();
    if (data) artistMatch = sameArtist(data.artist, track.artist);
  }

  const gameOver = correct || attemptIndex >= MAX_ATTEMPTS - 1;

  return {
    correct,
    artistMatch,
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
