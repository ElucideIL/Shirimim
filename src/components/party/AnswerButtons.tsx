"use client";

import type { PartyOption } from "@/lib/types";

const COLORS = ["bg-rose-600", "bg-sky-600", "bg-amber-500", "bg-violet-600"];

interface Props {
  options: PartyOption[];
  pickedId: string | null;
  /** Set once the round is revealed; null while answering. */
  correctId: string | null;
  disabled: boolean;
  onPick: (id: string) => void;
}

export function AnswerButtons({
  options,
  pickedId,
  correctId,
  disabled,
  onPick,
}: Props) {
  const revealing = correctId !== null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((opt, i) => {
        const isCorrect = revealing && opt.id === correctId;
        const isWrongPick =
          revealing && opt.id === pickedId && opt.id !== correctId;
        const dim = revealing && !isCorrect && !isWrongPick;
        const selected = !revealing && pickedId === opt.id;

        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(opt.id)}
            className={[
              COLORS[i % 4],
              "relative flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl px-4 py-4 text-center transition",
              dim ? "opacity-30" : "",
              isCorrect || selected ? "ring-4 ring-white" : "",
              isWrongPick ? "ring-4 ring-red-300" : "",
              disabled ? "cursor-default" : "hover:brightness-110 active:scale-[0.98]",
            ].join(" ")}
          >
            <span className="text-base font-bold text-white">{opt.title}</span>
            <span className="text-xs text-white/80">{opt.artist}</span>
            {isCorrect && (
              <span className="absolute top-2 right-3 text-lg">✓</span>
            )}
            {isWrongPick && (
              <span className="absolute top-2 right-3 text-lg">✕</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
