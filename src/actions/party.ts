"use server";

import crypto from "node:crypto";
import {
  PARTY_MAX_POINTS,
  PARTY_MAX_ROUNDS,
  PARTY_MIN_ROUNDS,
  PARTY_ROUND_MS,
} from "@/lib/constants";
import { getServiceClient } from "@/lib/supabase";
import type {
  ClientTrack,
  LeaderboardEntry,
  PartyEventName,
  PartyOption,
  PartyPlayer,
  RoomSnapshot,
  RoundReveal,
} from "@/lib/types";

// Unambiguous code alphabet — no 0/O/1/I/L.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Send an authoritative event to a room's Realtime channel (server-side). */
async function broadcastToRoom(
  code: string,
  event: PartyEventName,
  payload: unknown,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [{ topic: `room:${code}`, event, payload }],
    }),
  });
  if (!res.ok) {
    console.error(
      "broadcast failed",
      res.status,
      await res.text().catch(() => ""),
    );
  }
}

async function rosterOf(roomId: string): Promise<PartyPlayer[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("players")
    .select("id, name, score")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    score: p.score as number,
  }));
}

function leaderboardOf(roster: PartyPlayer[]): LeaderboardEntry[] {
  return [...roster]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      playerId: p.id,
      name: p.name,
      score: p.score,
      rank: i + 1,
    }));
}

/** Genres with enough tracks to host a genre-locked Party game. */
export async function getPartyGenres(): Promise<
  { genre: string; n: number }[]
> {
  const { data } = await getServiceClient().rpc("endless_genres");
  return ((data ?? []) as { genre: string; n: number }[]).map((g) => ({
    genre: g.genre,
    n: Number(g.n),
  }));
}

/** Host creates a room. Returns the join code and a secret host token. */
export async function createRoom(
  maxRounds: number,
  genre?: string | null,
): Promise<{ code: string; hostId: string }> {
  const supabase = getServiceClient();
  const rounds = Math.min(
    PARTY_MAX_ROUNDS,
    Math.max(PARTY_MIN_ROUNDS, Math.round(maxRounds) || 10),
  );
  const hostId = crypto.randomUUID();

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode();
    const { error } = await supabase.from("rooms").insert({
      code,
      host_id: hostId,
      status: "waiting",
      max_rounds: rounds,
      genre: genre || null,
    });
    if (!error) return { code, hostId };
    if (error.code !== "23505") {
      throw new Error(`createRoom failed: ${error.message}`);
    }
  }
  throw new Error("Could not allocate a room code — please try again.");
}

/** A player joins a waiting room. */
export async function joinRoom(
  code: string,
  name: string,
): Promise<{ playerId: string }> {
  const supabase = getServiceClient();
  const cleanName = name.trim().slice(0, 24);
  if (!cleanName) throw new Error("Please enter a name.");

  const { data: room } = await supabase
    .from("rooms")
    .select("id, status")
    .eq("code", code)
    .single();
  if (!room) throw new Error("Room not found.");
  if (room.status !== "waiting") {
    throw new Error("That game has already started.");
  }

  const { data: player, error } = await supabase
    .from("players")
    .insert({ room_id: room.id, name: cleanName })
    .select("id")
    .single();
  if (error || !player) throw new Error("Could not join the room.");

  await broadcastToRoom(code, "PLAYER_JOINED", {
    roster: await rosterOf(room.id),
  });
  return { playerId: player.id as string };
}

/** Host starts the next round: builds the question and broadcasts it. */
export async function startRound(code: string, hostId: string): Promise<void> {
  const supabase = getServiceClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id, status, current_round, max_rounds, genre")
    .eq("code", code)
    .single();
  if (!room) throw new Error("Room not found.");
  if (room.host_id !== hostId) {
    throw new Error("Only the host can start rounds.");
  }
  if (room.status === "finished" || room.current_round >= room.max_rounds) {
    throw new Error("The game is over.");
  }

  const { data: correctId } = await supabase.rpc("random_track", {
    exclude_id: null,
    p_genre: room.genre ?? null,
  });
  if (!correctId) throw new Error("The song library is empty.");

  const { data: correct } = await supabase
    .from("tracks")
    .select(
      "id, artist, title, source, preview_url, youtube_id, artwork_url, start_offset_ms",
    )
    .eq("id", correctId)
    .single();
  if (!correct) throw new Error("Could not load a track.");

  const { data: distractors } = await supabase.rpc("party_distractors", {
    p_correct_id: correctId,
    p_count: 3,
  });

  const options: PartyOption[] = shuffle([
    { id: correct.id, artist: correct.artist, title: correct.title },
    ...((distractors ?? []) as PartyOption[]),
  ]);

  const nextRound = room.current_round + 1;
  const startedAt = Date.now();
  const audio: ClientTrack = {
    source: correct.source,
    previewUrl: correct.preview_url,
    youtubeId: correct.youtube_id,
    startOffsetMs: correct.start_offset_ms ?? 0,
  };

  await supabase
    .from("rooms")
    .update({
      status: "playing",
      current_round: nextRound,
      current_answer_id: correct.id,
      round_started_at: new Date(startedAt).toISOString(),
      round_options: options,
    })
    .eq("id", room.id);

  await broadcastToRoom(code, "START_ROUND", {
    round: nextRound,
    maxRounds: room.max_rounds,
    options,
    audio,
    startedAt,
  });
}

/** A player locks in one answer for the current round. */
export async function submitPartyAnswer(
  code: string,
  playerId: string,
  pickedOptionId: string,
): Promise<{ accepted: boolean }> {
  const supabase = getServiceClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, status, current_round, current_answer_id, round_started_at")
    .eq("code", code)
    .single();
  if (!room || room.status !== "playing" || !room.round_started_at) {
    return { accepted: false };
  }

  const { data: player } = await supabase
    .from("players")
    .select("id, room_id, name, score, last_answered_round, double_round")
    .eq("id", playerId)
    .single();
  if (!player || player.room_id !== room.id) return { accepted: false };
  if (player.last_answered_round >= room.current_round) {
    return { accepted: false }; // one guess per round
  }

  const correct = pickedOptionId === room.current_answer_id;
  const elapsed = Date.now() - new Date(room.round_started_at).getTime();
  const remaining = Math.min(PARTY_ROUND_MS, Math.max(0, PARTY_ROUND_MS - elapsed));
  const doubled = player.double_round === room.current_round;
  let gained = correct
    ? Math.round(PARTY_MAX_POINTS * (remaining / PARTY_ROUND_MS))
    : 0;
  if (doubled) gained *= 2;

  await supabase
    .from("players")
    .update({
      score: player.score + gained,
      last_answered_round: room.current_round,
    })
    .eq("id", playerId);

  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("last_answered_round", room.current_round);

  await broadcastToRoom(code, "PLAYER_ANSWERED", {
    name: player.name,
    answeredCount: count ?? 0,
  });
  return { accepted: true };
}

/**
 * Power-up: spend a player's one-time 50:50. The server (which alone knows the
 * answer) returns two wrong option ids for that player's client to hide.
 */
export async function useFiftyFifty(
  code: string,
  playerId: string,
): Promise<{ removedOptionIds: string[] }> {
  const empty = { removedOptionIds: [] };
  const supabase = getServiceClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, status, current_round, current_answer_id, round_options")
    .eq("code", code)
    .single();
  if (!room || room.status !== "playing") return empty;

  const { data: player } = await supabase
    .from("players")
    .select("id, room_id, used_fifty, last_answered_round")
    .eq("id", playerId)
    .single();
  if (!player || player.room_id !== room.id) return empty;
  if (player.used_fifty || player.last_answered_round >= room.current_round) {
    return empty;
  }

  const options = (room.round_options ?? []) as PartyOption[];
  const wrong = options.filter((o) => o.id !== room.current_answer_id);
  const removedOptionIds = shuffle(wrong)
    .slice(0, 2)
    .map((o) => o.id);

  await supabase
    .from("players")
    .update({ used_fifty: true })
    .eq("id", playerId);
  return { removedOptionIds };
}

/**
 * Power-up: arm a player's one-time double-points for the current round. The
 * doubling is applied server-side in submitPartyAnswer.
 */
export async function useDoublePoints(
  code: string,
  playerId: string,
): Promise<{ armed: boolean }> {
  const supabase = getServiceClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, status, current_round")
    .eq("code", code)
    .single();
  if (!room || room.status !== "playing") return { armed: false };

  const { data: player } = await supabase
    .from("players")
    .select("id, room_id, used_double, last_answered_round")
    .eq("id", playerId)
    .single();
  if (!player || player.room_id !== room.id) return { armed: false };
  if (player.used_double || player.last_answered_round >= room.current_round) {
    return { armed: false };
  }

  await supabase
    .from("players")
    .update({ used_double: true, double_round: room.current_round })
    .eq("id", playerId);
  return { armed: true };
}

/** Host ends the round: reveals the answer and the leaderboard. */
export async function endRound(code: string, hostId: string): Promise<void> {
  const supabase = getServiceClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id, status, current_round, max_rounds, current_answer_id")
    .eq("code", code)
    .single();
  if (!room) throw new Error("Room not found.");
  if (room.host_id !== hostId) {
    throw new Error("Only the host can end rounds.");
  }

  const leaderboard = leaderboardOf(await rosterOf(room.id));

  let answer = { artist: "", title: "", artworkUrl: null as string | null };
  if (room.current_answer_id) {
    const { data: t } = await supabase
      .from("tracks")
      .select("artist, title, artwork_url")
      .eq("id", room.current_answer_id)
      .single();
    if (t) {
      answer = { artist: t.artist, title: t.title, artworkUrl: t.artwork_url };
    }
  }

  const gameOver = room.current_round >= room.max_rounds;
  if (gameOver) {
    await supabase.from("rooms").update({ status: "finished" }).eq("id", room.id);
  }

  const reveal: RoundReveal = {
    round: room.current_round,
    correctOptionId: room.current_answer_id ?? "",
    answer,
    leaderboard,
    gameOver,
  };
  await broadcastToRoom(code, "END_ROUND", reveal);
}

/** Snapshot for a client that just loaded or refreshed. */
export async function getRoomState(code: string): Promise<RoomSnapshot | null> {
  const supabase = getServiceClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, status, current_round, max_rounds")
    .eq("code", code)
    .single();
  if (!room) return null;
  return {
    status: room.status,
    currentRound: room.current_round,
    maxRounds: room.max_rounds,
    roster: await rosterOf(room.id),
  };
}
