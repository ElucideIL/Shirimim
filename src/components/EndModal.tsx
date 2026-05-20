"use client";

import { useState, type ReactNode } from "react";
import { MAX_ATTEMPTS } from "@/lib/constants";
import type { Answer, GuessRow } from "@/lib/types";

interface Props {
  won: boolean;
  answer: Answer;
  guesses: GuessRow[];
  /** Pre-built emoji share string. */
  shareText: string;
  /** Mode-specific bottom slot: a midnight countdown, or a "Next song" button. */
  footer: ReactNode;
  onClose: () => void;
  /** Replay the longer post-answer clip. */
  playFull: () => void;
  /** Stop playback. */
  stopAudio: () => void;
  /** True while the clip is sounding. */
  isPlaying: boolean;
}

function squaresFor(guesses: GuessRow[]): string[] {
  return Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
    const g = guesses[i];
    if (!g) return "⬜";
    if (g.outcome === "correct") return "🟩";
    if (g.outcome === "artist") return "🟨";
    return "🟥";
  });
}

function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function EndModal({
  won,
  answer,
  guesses,
  shareText,
  footer,
  onClose,
  playFull,
  stopAudio,
  isPlaying,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(shareText);
      ok = true;
    } catch {
      ok = legacyCopy(shareText);
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>

        <p
          className={`text-sm font-semibold tracking-wide uppercase ${
            won ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {won ? "You got it!" : "Out of guesses"}
        </p>

        {answer.artworkUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={answer.artworkUrl}
            alt=""
            className="mx-auto mt-4 h-32 w-32 rounded-xl object-cover"
          />
        )}

        <h2 className="mt-4 text-xl font-bold text-white">{answer.title}</h2>
        <p className="text-sm text-white/55">{answer.artist}</p>

        <div className="mt-5 text-lg tracking-[0.2em]">
          {squaresFor(guesses).join("")}
        </div>
        <p className="mt-1 text-xs text-white/40">
          {won
            ? `Solved in ${guesses.length}/${MAX_ATTEMPTS}`
            : `${MAX_ATTEMPTS}/${MAX_ATTEMPTS} used`}
        </p>

        <button
          type="button"
          onClick={isPlaying ? stopAudio : playFull}
          className="mt-4 w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
        >
          {isPlaying ? "■  Stop" : "▶  Hear more of the song"}
        </button>

        <button
          type="button"
          onClick={share}
          className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
        >
          {copied ? "Copied to clipboard!" : "Share result"}
        </button>

        <div className="mt-4">{footer}</div>
      </div>
    </div>
  );
}
