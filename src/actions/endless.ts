"use server";

import { MAX_ATTEMPTS } from "@/lib/constants";
import { openTrackId, sealTrackId } from "@/lib/round";
import { getServiceClient } from "@/lib/supabase";
import type { ClientTrack, TurnInput, TurnResult } from "@/lib/types";

export interface EndlessRound {
  track: ClientTrack;
  /** Opaque encrypted token binding this round to its answer. */
  token: string;
}

/**
 * Start an Endless-mode round: pick a random track (never the previous one)
 * and return only the playable media plus a sealed round token.
 */
export async function startEndlessRound(
  prevToken?: string,
): Promise<EndlessRound | null> {
  const supabase = getServiceClient();
  const excludeId = prevToken ? openTrackId(prevToken) : null;

  const { data: trackId, error } = await supabase.rpc("random_track", {
    exclude_id: excludeId,
  });
  if (error) throw new Error(`random_track failed: ${error.message}`);
  if (!trackId) return null; // empty library

  const { data, error: fetchError } = await supabase
    .from("tracks")
    .select("source, preview_url, youtube_id")
    .eq("id", trackId)
    .single();
  if (fetchError) throw new Error(`track fetch failed: ${fetchError.message}`);

  return {
    track: {
      source: data.source,
      previewUrl: data.preview_url,
      youtubeId: data.youtube_id,
    },
    token: sealTrackId(trackId),
  };
}

/** Validate a guess or skip for an Endless round, against the token's answer. */
export async function resolveEndlessTurn(
  input: TurnInput & { token: string },
): Promise<TurnResult> {
  const answerId = openTrackId(input.token);
  if (!answerId) throw new Error("Invalid or expired round token.");

  const correct =
    input.action === "guess" && input.guessTrackId === answerId;
  const gameOver = correct || input.attemptIndex >= MAX_ATTEMPTS - 1;

  let answer: TurnResult["answer"] = null;
  if (gameOver) {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("tracks")
      .select("artist, title, artwork_url")
      .eq("id", answerId)
      .single();
    if (data) {
      answer = {
        artist: data.artist,
        title: data.title,
        artworkUrl: data.artwork_url,
      };
    }
  }

  return { correct, gameOver, answer };
}
