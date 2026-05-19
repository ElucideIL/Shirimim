"use client";

import { INTERVALS, SEGMENT_MS, TOTAL_MS } from "@/lib/constants";

interface Props {
  /** Current playhead position in ms. */
  positionMs: number;
  /** How far the player is allowed to hear, in ms. */
  unlockedMs: number;
}

/**
 * A single bar split into 6 segments sized proportionally to each interval's
 * increment. The playhead travels smoothly but is only ever driven within the
 * currently unlocked range by the game engine.
 */
export function ProgressBar({ positionMs, unlockedMs }: Props) {
  const playheadPct = Math.min(100, Math.max(0, (positionMs / TOTAL_MS) * 100));

  return (
    <div className="w-full">
      <div className="relative flex h-3 w-full gap-px overflow-hidden rounded-full">
        {SEGMENT_MS.map((ms, i) => (
          <div
            key={i}
            style={{ flexGrow: ms }}
            className={
              INTERVALS[i] <= unlockedMs ? "bg-white/30" : "bg-white/[0.07]"
            }
          />
        ))}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-[3px] -translate-x-1/2 rounded bg-emerald-400"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
      <div className="mt-1.5 flex w-full gap-px">
        {SEGMENT_MS.map((ms, i) => (
          <div
            key={i}
            style={{ flexGrow: ms }}
            className="overflow-hidden text-right text-[10px] tabular-nums whitespace-nowrap text-white/30"
          >
            {ms / TOTAL_MS > 0.045 ? `${INTERVALS[i] / 1000}s` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
