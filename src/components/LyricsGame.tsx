"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveEndlessTurn } from "@/actions/endless";
import { startLyricsRound } from "@/actions/lyrics";
import { buildShareText } from "@/lib/share";
import type {
  Answer,
  GameStatus,
  GuessRow,
  LyricsRound,
  SearchResult,
} from "@/lib/types";
import { EndModal } from "./EndModal";
import { GuessGrid } from "./GuessGrid";
import { SearchFooter } from "./SearchFooter";

const BEST_KEY = "shirimim:lyrics:best";

function Notice({ text }: { text: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-extrabold tracking-tight">
        Shirimim<span className="text-emerald-400">.</span>
      </h1>
      <p className="text-sm text-white/50">{text}</p>
      <Link href="/" className="text-xs text-emerald-400 hover:underline">
        Back to the daily game
      </Link>
    </main>
  );
}

interface BoardProps {
  round: LyricsRound;
  streak: number;
  best: number;
  loading: boolean;
  onRoundEnd: (won: boolean) => void;
  onNext: (won: boolean) => void;
}

/** One Lyrics-mode round: reveal a lyric line per wrong guess. */
function LyricsBoard({
  round,
  streak,
  best,
  loading,
  onRoundEnd,
  onNext,
}: BoardProps) {
  const { lines, token } = round;

  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, setPending] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);

  const over = status !== "playing";

  const roundEndReported = useRef(false);
  useEffect(() => {
    if (over && !roundEndReported.current) {
      roundEndReported.current = true;
      onRoundEnd(status === "won");
    }
  }, [over, status, onRoundEnd]);

  const handleGuess = useCallback(
    async (result: SearchResult) => {
      if (over || pending) return;
      setPending(true);
      try {
        const res = await resolveEndlessTurn({
          action: "guess",
          guessTrackId: result.id,
          attemptIndex: currentAttempt,
          token,
        });
        const label = `${result.artist} — ${result.title}`;
        if (res.correct) {
          setGuesses((g) => [...g, { outcome: "correct", label }]);
          setAnswer(res.answer);
          setStatus("won");
        } else {
          const outcome = res.artistMatch ? "artist" : "wrong";
          setGuesses((g) => [...g, { outcome, label }]);
          setCurrentAttempt((a) => a + 1);
          if (res.gameOver) {
            setAnswer(res.answer);
            setStatus("lost");
          }
        }
      } catch (err) {
        console.error("lyrics guess failed", err);
      } finally {
        setPending(false);
      }
    },
    [over, pending, currentAttempt, token],
  );

  const handleSkip = useCallback(async () => {
    if (over || pending) return;
    setPending(true);
    try {
      const res = await resolveEndlessTurn({
        action: "skip",
        attemptIndex: currentAttempt,
        token,
      });
      setGuesses((g) => [...g, { outcome: "skipped", label: "Skipped" }]);
      setCurrentAttempt((a) => a + 1);
      if (res.gameOver) {
        setAnswer(res.answer);
        setStatus("lost");
      }
    } catch (err) {
      console.error("lyrics skip failed", err);
    } finally {
      setPending(false);
    }
  }, [over, pending, currentAttempt, token]);

  const revealCount = over
    ? lines.length
    : Math.min(currentAttempt + 1, lines.length);
  const showEnd = over && answer !== null && !modalDismissed;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-extrabold tracking-tight">
            Shirimim<span className="text-emerald-400">.</span>
          </h1>
          <span className="text-xs text-white/40">Lyrics · 🔥 {streak}</span>
        </div>
        <nav className="flex items-center gap-1.5">
          {over && (
            <button
              type="button"
              onClick={() => setModalDismissed(false)}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
            >
              Result
            </button>
          )}
          <Link
            href="/"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            Daily
          </Link>
          <Link
            href="/endless"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            Endless
          </Link>
        </nav>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-xs tracking-widest text-white/35 uppercase">
            Lyrics
          </p>
          <p className="text-xs text-white/35">
            {revealCount} / {lines.length} lines
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {lines.map((line, i) =>
            i < revealCount ? (
              <p key={i} className="text-[15px] leading-relaxed text-white/90">
                {line}
              </p>
            ) : (
              <div key={i} className="h-5 rounded bg-white/[0.06]" />
            ),
          )}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-white/35">
        Guess the song from its lyrics — each wrong guess reveals another line.
      </p>

      <div className="mt-5 flex-1">
        <GuessGrid
          guesses={guesses}
          currentAttempt={currentAttempt}
          status={status}
        />
      </div>

      <SearchFooter
        onGuess={handleGuess}
        onSkip={handleSkip}
        disabled={over || pending}
      />

      {showEnd && answer && (
        <EndModal
          won={status === "won"}
          answer={answer}
          guesses={guesses}
          shareText={buildShareText(null, guesses, status === "won")}
          onClose={() => setModalDismissed(true)}
          footer={
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                {status === "won" ? (
                  <span className="text-emerald-300">🔥 {streak} in a row</span>
                ) : (
                  <span className="text-white/70">Streak ended at {streak}</span>
                )}
                <span className="text-white/40"> · Best {best}</span>
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => onNext(status === "won")}
                className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
              >
                {loading
                  ? "Loading…"
                  : status === "won"
                    ? "Next song →"
                    : "New run"}
              </button>
            </div>
          }
        />
      )}
    </main>
  );
}

/** Lyrics mode: an endless run of guess-the-song-from-its-lyrics rounds. */
export function LyricsGame() {
  const [round, setRound] = useState<LyricsRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  const loadRound = useCallback(async (prevToken?: string) => {
    setLoading(true);
    try {
      const next = await startLyricsRound(prevToken);
      if (next) {
        setRound(next);
        setNotice(null);
      } else {
        setRound(null);
        setNotice(
          "No lyrics in the library yet — run ingest/fetch_lyrics.py to add them.",
        );
      }
    } catch {
      setRound(null);
      setNotice("Couldn't start a round. Check the Supabase configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {
      /* ignore */
    }
    void loadRound();
  }, [loadRound]);

  const handleRoundEnd = useCallback(
    (won: boolean) => {
      if (!won) return;
      const next = streak + 1;
      setStreak(next);
      if (next > best) {
        setBest(next);
        try {
          localStorage.setItem(BEST_KEY, String(next));
        } catch {
          /* ignore */
        }
      }
    },
    [streak, best],
  );

  const handleNext = useCallback(
    (won: boolean) => {
      if (!won) setStreak(0);
      void loadRound(round?.token);
    },
    [round, loadRound],
  );

  if (!round) {
    return <Notice text={loading ? "Loading…" : (notice ?? "Loading…")} />;
  }

  return (
    <LyricsBoard
      key={round.token}
      round={round}
      streak={streak}
      best={best}
      loading={loading}
      onRoundEnd={handleRoundEnd}
      onNext={handleNext}
    />
  );
}
