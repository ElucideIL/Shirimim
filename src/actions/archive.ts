"use server";

import { dateLabelForDay, getDayNumber } from "@/lib/daily";
import { getServiceClient } from "@/lib/supabase";
import type { ArchiveEntry } from "@/lib/types";

/** Past daily puzzles (strictly before today), newest first. */
export async function getDailyArchive(): Promise<ArchiveEntry[]> {
  const today = getDayNumber();
  const { data, error } = await getServiceClient()
    .from("daily_songs")
    .select("day_number")
    .lt("day_number", today)
    .order("day_number", { ascending: false });
  if (error) throw new Error(`archive fetch failed: ${error.message}`);

  return (data ?? []).map((r) => {
    const day = r.day_number as number;
    return { day, date: dateLabelForDay(day) };
  });
}
