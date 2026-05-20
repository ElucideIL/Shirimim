"use server";

import { MAX_ATTEMPTS } from "@/lib/constants";
import { sameArtist } from "@/lib/match";
import { openTrackId, sealTrackId } from "@/lib/round";
import { getServiceClient } from "@/lib/supabase";
import type {
  ClientTrack,
  EndlessFilter,
  EndlessModes,
  TurnInput,
  TurnResult,
} from "@/lib/types";

export interface EndlessRound {
  track: ClientTrack;
  /** Opaque encrypted token binding this round to its answer. */
  token: string;
}

/**
 * Start an Endless-mode round: pick a random track (never the previous one),
 * optionally restricted to a sub-mode (Hebrew, or one genre), and return only
 * the playable media plus a sealed round token.
 */
export async function startEndlessRound(
  prevToken?: string,
  filter?: EndlessFilter,
): Promise<EndlessRound | null> {
  const supabase = getServiceClient();
  const excludeId = prevToken ? openTrackId(prevToken) : null;

  const { data: trackId, error } = await supabase.rpc("random_track", {
    exclude_id: excludeId,
    p_genre: filter?.kind === "genre" ? filter.genre : null,
    p_script: filter?.kind === "hebrew" ? "hebrew" : null,
  });
  if (error) throw new Error(`random_track failed: ${error.message}`);
  if (!trackId) return null; // empty library / empty sub-mode

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

  const correct = input.action === "guess" && input.guessTrackId === answerId;
  const gameOver = correct || input.attemptIndex >= MAX_ATTEMPTS - 1;
  const isWrongGuess = input.action === "guess" && !correct;

  const supabase = getServiceClient();
  let answerArtist = "";
  let answer: TurnResult["answer"] = null;

  if (gameOver || isWrongGuess) {
    const { data } = await supabase
      .from("tracks")
      .select("artist, title, artwork_url")
      .eq("id", answerId)
      .single();
    if (data) {
      answerArtist = data.artist;
      if (gameOver) {
        answer = {
          artist: data.artist,
          title: data.title,
          artworkUrl: data.artwork_url,
        };
      }
    }
  }

  let artistMatch = false;
  if (isWrongGuess && input.guessTrackId && answerArtist) {
    const { data } = await supabase
      .from("tracks")
      .select("artist")
      .eq("id", input.guessTrackId)
      .single();
    if (data) artistMatch = sameArtist(data.artist, answerArtist);
  }

  return { correct, artistMatch, gameOver, answer };
}

/** List the Endless sub-modes available given the current library. */
export async function getEndlessModes(): Promise<EndlessModes> {
  const supabase = getServiceClient();

  const { count } = await supabase
    .from("tracks")
    .select("id", { count: "exact", head: true })
    .eq("script", "hebrew");

  const { data } = await supabase.rpc("endless_genres");
  const genres = ((data ?? []) as { genre: string; n: number }[]).map((g) => ({
    genre: g.genre,
    n: Number(g.n),
  }));

  return { hebrew: count ?? 0, genres };
}
