"use client";

import { memo } from "react";
import { MAX_ATTEMPTS } from "@/lib/constants";
import type { GameStatus, GuessRow } from "@/lib/types";

interface Props {
  guesses: GuessRow[];
  currentAttempt: number;
  status: GameStatus;
}

function Dot({ outcome }: { outcome: GuessRow["outcome"] }) {
  const color =
    outcome === "correct"
      ? "bg-emerald-400"
      : outcome === "artist"
        ? "bg-amber-400"
        : outcome === "wrong"
          ? "bg-red-400"
          : "bg-white/40";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function Row({ guess, isCurrent }: { guess?: GuessRow; isCurrent: boolean }) {
  if (!guess) {
    return (
      <li
        className={`h-11 rounded-lg border ${
          isCurrent ? "border-white/25 bg-white/[0.04]" : "border-white/[0.07]"
        }`}
      />
    );
  }

  const palette =
    guess.outcome === "correct"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : guess.outcome === "artist"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : guess.outcome === "wrong"
          ? "border-red-500/40 bg-red-500/10 text-red-300"
          : "border-white/10 bg-white/[0.03] text-white/45";

  return (
    <li className={`flex h-11 items-center gap-2.5 rounded-lg border px-3 ${palette}`}>
      <Dot outcome={guess.outcome} />
      <span className="truncate text-sm">
        {guess.outcome === "skipped" ? "Skipped" : guess.label}
      </span>
      {guess.outcome === "artist" && (
        <span className="ml-auto shrink-0 text-[10px] tracking-wide text-amber-400/80 uppercase">
          right artist
        </span>
      )}
    </li>
  );
}

function GuessGridBase({ guesses, currentAttempt, status }: Props) {
  return (
    <ul className="flex w-full flex-col gap-2">
      {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
        <Row
          key={i}
          guess={guesses[i]}
          isCurrent={i === currentAttempt && status === "playing"}
        />
      ))}
    </ul>
  );
}

export const GuessGrid = memo(GuessGridBase);
