"use client";

import { memo } from "react";
import { HINT_GENRE_AFTER, HINT_YEAR_AFTER } from "@/lib/constants";
import type { Hint } from "@/lib/types";

interface ChipProps {
  icon: string;
  label: string;
  value: string | null;
  unlockAt: number;
  attemptsUsed: number;
}

function Chip({ icon, label, value, unlockAt, attemptsUsed }: ChipProps) {
  if (attemptsUsed < unlockAt) {
    const remaining = unlockAt - attemptsUsed;
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] px-3 py-2 text-xs text-white/30">
        <span>🔒</span>
        <span>
          {label} in {remaining}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
      <span>{icon}</span>
      <span className="text-white/45">{label}</span>
      <span className="ml-auto truncate font-semibold text-emerald-200">
        {value ?? "Unknown"}
      </span>
    </div>
  );
}

/** Two progressively-unlocked clue chips: genre, then release year. */
function HintBarBase({
  hint,
  attemptsUsed,
}: {
  hint: Hint;
  attemptsUsed: number;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Chip
        icon="💿"
        label="Genre"
        value={hint.genre}
        unlockAt={HINT_GENRE_AFTER}
        attemptsUsed={attemptsUsed}
      />
      <Chip
        icon="📅"
        label="Year"
        value={hint.year === null ? null : String(hint.year)}
        unlockAt={HINT_YEAR_AFTER}
        attemptsUsed={attemptsUsed}
      />
    </div>
  );
}

export const HintBar = memo(HintBarBase);
