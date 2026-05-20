"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  resolveEndlessTurn,
  startEndlessRound,
  type EndlessRound,
} from "@/actions/endless";
import { buildShareText } from "@/lib/share";
import type { EndlessFilter, TurnInput } from "@/lib/types";
import { EndModal } from "./EndModal";
import { EndlessModePicker } from "./EndlessModePicker";
import { GameBoard } from "./GameBoard";

function modeKey(f: EndlessFilter): string {
  if (f.kind === "genre") return `genre:${f.genre}`;
  if (f.kind === "hebrew_genre") return `hebrew_genre:${f.genre}`;
  if (f.kind === "artist") return `artist:${f.artist}`;
  if (f.kind === "decade") return `decade:${f.decade}`;
  return f.kind;
}
function modeLabel(f: EndlessFilter): string {
  if (f.kind === "all") return "All songs";
  if (f.kind === "hebrew") return "Hebrew";
  if (f.kind === "genre") return f.genre;
  if (f.kind === "hebrew_genre") return `Hebrew · ${f.genre}`;
  if (f.kind === "decade") return `${f.decade}s`;
  return f.artist;
}
function bestKey(f: EndlessFilter): string {
  return `shirimim:endless:best:${modeKey(f)}`;
}

function Notice({
  text,
  onChangeMode,
}: {
  text: string;
  onChangeMode?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-extrabold tracking-tight">
        Shirimim<span className="text-emerald-400">.</span>
      </h1>
      <p className="text-sm text-white/50">{text}</p>
      {onChangeMode ? (
        <button
          type="button"
          onClick={onChangeMode}
          className="text-xs text-emerald-400 hover:underline"
        >
          Pick another mode
        </button>
      ) : (
        <Link href="/" className="text-xs text-emerald-400 hover:underline">
          Back to the daily game
        </Link>
      )}
    </main>
  );
}

/** Endless mode: pick a sub-mode, then run a streak until you miss a song. */
export function EndlessGame() {
  const [filter, setFilter] = useState<EndlessFilter | null>(null);
  const [round, setRound] = useState<EndlessRound | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  const loadRound = useCallback(
    async (prevToken: string | undefined, f: EndlessFilter) => {
      setLoading(true);
      try {
        const next = await startEndlessRound(prevToken, f);
        if (next) {
          setRound(next);
          setNotice(null);
        } else {
          setRound(null);
          setNotice("No songs in this mode yet — try another.");
        }
      } catch {
        setRound(null);
        setNotice("Couldn't start a round. Check the Supabase configuration.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handlePickMode = useCallback(
    (f: EndlessFilter) => {
      setFilter(f);
      setStreak(0);
      let saved = 0;
      try {
        saved = Number(localStorage.getItem(bestKey(f))) || 0;
      } catch {
        /* ignore */
      }
      setBest(saved);
      void loadRound(undefined, f);
    },
    [loadRound],
  );

  const handleRoundEnd = useCallback(
    (won: boolean) => {
      if (!won || !filter) return;
      const next = streak + 1;
      setStreak(next);
      if (next > best) {
        setBest(next);
        try {
          localStorage.setItem(bestKey(filter), String(next));
        } catch {
          /* ignore */
        }
      }
    },
    [filter, streak, best],
  );

  const changeMode = useCallback(() => {
    setFilter(null);
    setRound(null);
    setNotice(null);
  }, []);

  if (!filter) {
    return <EndlessModePicker onPick={handlePickMode} />;
  }
  if (!round) {
    return (
      <Notice
        text={loading ? "Loading…" : (notice ?? "Loading…")}
        onChangeMode={notice ? changeMode : undefined}
      />
    );
  }

  return (
    <GameBoard
      key={round.token}
      track={round.track}
      headerLabel={`${modeLabel(filter)} · 🔥 ${streak}`}
      navHref="/"
      navLabel="Daily"
      onTurn={(input: TurnInput) =>
        resolveEndlessTurn({ ...input, token: round.token })
      }
      onRoundEnd={handleRoundEnd}
      renderEnd={({ won, answer, guesses, close, playFull, stopAudio, isPlaying }) => (
        <EndModal
          won={won}
          answer={answer}
          guesses={guesses}
          playFull={playFull}
          stopAudio={stopAudio}
          isPlaying={isPlaying}
          shareText={buildShareText(null, guesses, won)}
          onClose={close}
          footer={
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                {won ? (
                  <span className="text-emerald-300">🔥 {streak} in a row</span>
                ) : (
                  <span className="text-white/70">
                    Streak ended at {streak}
                  </span>
                )}
                <span className="text-white/40"> · Best {best}</span>
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (!won) setStreak(0);
                  void loadRound(round.token, filter);
                }}
                className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
              >
                {loading ? "Loading…" : won ? "Next song →" : "New run"}
              </button>
              <button
                type="button"
                onClick={changeMode}
                className="text-xs text-white/45 hover:text-white/80"
              >
                Change mode
              </button>
            </div>
          }
        />
      )}
    />
  );
}
