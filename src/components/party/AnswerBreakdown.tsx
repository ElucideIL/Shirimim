"use client";

import type { PartyOption } from "@/lib/types";

interface Props {
  options: PartyOption[];
  /** How many players picked each option id. */
  counts: Record<string, number>;
  correctId: string;
  /** The viewing player's own pick, if any. */
  pickedId?: string | null;
}

/** Kahoot-style per-option tally shown on the reveal. */
export function AnswerBreakdown({ options, counts, correctId, pickedId }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
        const n = counts[opt.id] ?? 0;
        const pct = total > 0 ? (n / total) * 100 : 0;
        const isCorrect = opt.id === correctId;
        const isWrongPick = opt.id === pickedId && opt.id !== correctId;
        return (
          <div
            key={opt.id}
            className={`relative overflow-hidden rounded-xl border px-3 py-2.5 ${
              isCorrect
                ? "border-emerald-500/50 bg-emerald-500/10"
                : isWrongPick
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-white/10 bg-white/5"
            }`}
          >
            <div
              className={`absolute inset-y-0 left-0 ${
                isCorrect ? "bg-emerald-500/25" : "bg-white/10"
              }`}
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-semibold">{opt.title}</span>
                <span className="text-white/45"> · {opt.artist}</span>
              </span>
              {isCorrect && <span className="text-sm">✓</span>}
              <span className="shrink-0 text-xs tabular-nums text-white/55">
                {n}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
