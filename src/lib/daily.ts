import "server-only";
import { EPOCH, GAME_TZ } from "./constants";
import { getServiceClient } from "./supabase";
import type { Track } from "./types";

/** 'YYYY-MM-DD' wall-clock date for `d` in the given timezone. */
function ymdInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Whole days between the game epoch and `now`, measured in GAME_TZ. */
export function getDayNumber(now: Date = new Date()): number {
  const today = Date.parse(`${ymdInTz(now, GAME_TZ)}T00:00:00Z`);
  const epoch = Date.parse(`${EPOCH}T00:00:00Z`);
  return Math.floor((today - epoch) / 86_400_000);
}

/** Human calendar label (e.g. "May 18, 2026") for a given day number. */
export function dateLabelForDay(dayNumber: number): string {
  const epoch = Date.parse(`${EPOCH}T00:00:00Z`);
  const d = new Date(epoch + dayNumber * 86_400_000);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

function mapRow(row: Record<string, unknown>): Track {
  return {
    id: row.id as string,
    artist: row.artist as string,
    title: row.title as string,
    source: row.source as Track["source"],
    previewUrl: (row.preview_url as string | null) ?? null,
    youtubeId: (row.youtube_id as string | null) ?? null,
    artworkUrl: (row.artwork_url as string | null) ?? null,
    startOffsetMs: (row.start_offset_ms as number | null) ?? 0,
  };
}

/** Resolve (and permanently lock in) the track for a given day number. */
export async function getTrackForDay(dayNumber: number): Promise<Track | null> {
  const supabase = getServiceClient();

  const { data: trackId, error } = await supabase.rpc("get_or_roll_daily", {
    p_day: dayNumber,
  });
  if (error) throw new Error(`get_or_roll_daily failed: ${error.message}`);
  if (!trackId) return null; // empty library

  const { data, error: fetchError } = await supabase
    .from("tracks")
    .select(
      "id, artist, title, source, preview_url, youtube_id, artwork_url, start_offset_ms",
    )
    .eq("id", trackId)
    .single();
  if (fetchError) throw new Error(`track fetch failed: ${fetchError.message}`);

  return mapRow(data);
}

/** Today's day number and its locked-in track. */
export async function getDailyTrack(): Promise<{
  dayNumber: number;
  track: Track | null;
}> {
  const dayNumber = getDayNumber();
  const track = await getTrackForDay(dayNumber);
  return { dayNumber, track };
}
