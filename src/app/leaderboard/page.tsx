import type { Metadata } from "next";
import { LeaderboardView } from "@/components/LeaderboardView";
import { getDayNumber } from "@/lib/daily";

export const metadata: Metadata = {
  title: "Shirimim — Leaderboard",
};

// Today's day number is resolved per request.
export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return <LeaderboardView dayNumber={getDayNumber()} />;
}
