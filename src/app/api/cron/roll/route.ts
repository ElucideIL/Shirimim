import { NextRequest, NextResponse } from "next/server";
import { getDayNumber, getTrackForDay } from "@/lib/daily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily pre-warm: locks in today's song so the first real visitor doesn't
 * trigger the roll. Purely an optimization — getTrackForDay() is self-healing,
 * so the game works correctly even if this never runs.
 *
 * Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dayNumber = getDayNumber();
  const track = await getTrackForDay(dayNumber);

  return NextResponse.json({ dayNumber, rolled: Boolean(track) });
}
