"use server";

import { MAX_ATTEMPTS } from "@/lib/constants";
import { sameArtist } from "@/lib/match";
import { getServiceClient } from "@/lib/supabase";
import type { ClientTrack, ResultRow, TurnInput, TurnResult } from "@/lib/types";

/** Create a duel on a random song. Returns the id for the shareable link. */
export async function createDuel(): Promise<{ id: string }> {
  const supabase = getServiceClient();

  const { data: trackId } = await supabase.rpc("random_track", {
    exclude_id: null,
  });
  if (!trackId) throw new Error("The song library is empty.");

  const { data, error } = await supabase
    .from("duels")
    .insert({ track_id: trackId })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not start a duel.");
  return { id: data.id as string };
}

/** The playable media for a duel's song (no answer fields). */
export async function getDuelTrack(duelId: string): Promise<ClientTrack | null> {
  const supabase = getServiceClient();

  const { data: duel } = await supabase
    .from("duels")
    .select("track_id")
    .eq("id", duelId)
    .single();
  if (!duel) return null;

  const { data } = await supabase
    .from("tracks")
    .select("source, preview_url, youtube_id")
    .eq("id", duel.track_id)
    .single();
  if (!data) return null;

  return {
    source: data.source,
    previewUrl: data.preview_url,
    youtubeId: data.youtube_id,
  };
}

/** Validate a guess or skip for a duel, against the duel's locked-in song. */
export async function resolveDuelTurn(
  input: TurnInput,
  duelId: string,
): Promise<TurnResult> {
  const supabase = getServiceClient();

  const { data: duel } = await supabase
    .from("duels")
    .select("track_id")
    .eq("id", duelId)
    .single();
  if (!duel) throw new Error("Duel not found.");
  const trackId = duel.track_id as string;

  const correct = input.action === "guess" && input.guessTrackId === trackId;
  const gameOver = correct || input.attemptIndex >= MAX_ATTEMPTS - 1;
  const isWrongGuess = input.action === "guess" && !correct;

  let answerArtist = "";
  let answer: TurnResult["answer"] = null;
  if (gameOver || isWrongGuess) {
    const { data } = await supabase
      .from("tracks")
      .select("artist, title, artwork_url")
      .eq("id", trackId)
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

/** Record (or update) a player's result for a duel. Upsert keyed by player. */
export async function submitDuelResult(input: {
  duelId: string;
  playerId: string;
  name: string;
  won: boolean;
  guesses: number;
}): Promise<void> {
  const name = input.name.trim().slice(0, 24);
  if (!name || !input.playerId) return;

  const { error } = await getServiceClient()
    .from("duel_results")
    .upsert(
      {
        duel_id: input.duelId,
        player_id: input.playerId,
        name,
        won: input.won,
        guesses: input.guesses,
      },
      { onConflict: "duel_id,player_id" },
    );
  if (error) throw new Error(`submitDuelResult failed: ${error.message}`);
}

/** Both players' results for a duel — winner (fewest guesses) first. */
export async function getDuelResults(duelId: string): Promise<ResultRow[]> {
  const { data, error } = await getServiceClient()
    .from("duel_results")
    .select("player_id, name, won, guesses, created_at")
    .eq("duel_id", duelId)
    .order("won", { ascending: false })
    .order("guesses", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getDuelResults failed: ${error.message}`);

  return (data ?? []).map((r) => ({
    playerId: r.player_id as string,
    name: r.name as string,
    won: r.won as boolean,
    guesses: r.guesses as number,
  }));
}
