"use client";

import type { LeaderboardEntry } from "@/lib/types";

interface Props {
  entries: LeaderboardEntry[];
  /** Highlights the current player's row. */
  youId?: string;
}

export function Leaderboard({ entries, youId }: Props) {
  return (
    <ul className="flex w-full flex-col gap-2">
      {entries.map((e) => (
        <li
          key={e.playerId}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            e.playerId === youId
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-white/10 bg-white/5"
          }`}
        >
          <span className="w-6 text-sm font-bold text-white/40">{e.rank}</span>
          <span className="flex-1 truncate text-sm font-medium">{e.name}</span>
          <span className="text-sm font-bold tabular-nums text-emerald-300">
            {e.score}
          </span>
        </li>
      ))}
    </ul>
  );
}
