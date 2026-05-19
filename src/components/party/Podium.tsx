"use client";

import type { LeaderboardEntry } from "@/lib/types";
import { Leaderboard } from "./Leaderboard";

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
}
function barHeight(rank: number): string {
  return rank === 1 ? "h-28" : rank === 2 ? "h-20" : "h-14";
}

interface Props {
  entries: LeaderboardEntry[];
  youId?: string;
}

export function Podium({ entries, youId }: Props) {
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Visual order: 2nd place, 1st place, 3rd place.
  const order = [top3[1], top3[0], top3[2]].filter(
    (e): e is LeaderboardEntry => Boolean(e),
  );

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full items-end justify-center gap-3">
        {order.map((e) => (
          <div
            key={e.playerId}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span className="text-3xl">{medal(e.rank)}</span>
            <span
              className={`max-w-full truncate text-sm font-semibold ${
                e.playerId === youId ? "text-emerald-300" : ""
              }`}
            >
              {e.name}
            </span>
            <span className="text-xs text-emerald-300">{e.score}</span>
            <div
              className={`w-full rounded-t-xl bg-white/10 ${barHeight(e.rank)}`}
            />
          </div>
        ))}
      </div>
      {rest.length > 0 && <Leaderboard entries={rest} youId={youId} />}
    </div>
  );
}
