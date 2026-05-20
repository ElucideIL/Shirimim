"use server";

import { LYRICS_LINES } from "@/lib/constants";
import { openTrackId, sealTrackId } from "@/lib/round";
import { getServiceClient } from "@/lib/supabase";
import type { LyricsRound } from "@/lib/types";

/**
 * Build the lyric window shown for one round: a run of consecutive lines, with
 * any line that gives away the artist or title removed so the clue stays fair.
 */
function pickWindow(lyrics: string, artist: string, title: string): string[] {
  const banned = [artist.toLowerCase(), title.toLowerCase()].filter(Boolean);
  const lines = lyrics
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 6)
    .filter((l) => !banned.some((b) => l.toLowerCase().includes(b)));

  if (lines.length === 0) return [];
  if (lines.length <= LYRICS_LINES) return lines;

  const start = Math.floor(Math.random() * (lines.length - LYRICS_LINES + 1));
  return lines.slice(start, start + LYRICS_LINES);
}

/**
 * Start a Lyrics-mode round: pick a random track that has cached lyrics, build
 * a fair lyric window, and return it with a sealed answer token. Guesses are
 * validated by resolveEndlessTurn — the token format is identical.
 */
export async function startLyricsRound(
  prevToken?: string,
): Promise<LyricsRound | null> {
  const supabase = getServiceClient();
  const excludeId = prevToken ? openTrackId(prevToken) : null;

  // A picked track might have only giveaway lines — retry a few times.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: trackId, error } = await supabase.rpc("random_lyrics_track", {
      exclude_id: excludeId,
    });
    if (error) throw new Error(`random_lyrics_track failed: ${error.message}`);
    if (!trackId) return null; // no track in the library has lyrics yet

    const { data } = await supabase
      .from("tracks")
      .select("artist, title, lyrics")
      .eq("id", trackId)
      .single();
    if (!data?.lyrics) continue;

    const lines = pickWindow(data.lyrics, data.artist, data.title);
    if (lines.length === 0) continue;

    return { lines, token: sealTrackId(trackId as string) };
  }
  return null;
}
