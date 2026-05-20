"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAudioEngine, YT_HOST_ID } from "@/lib/audioEngine";
import { INTERVALS, MAX_ATTEMPTS, TOTAL_MS } from "@/lib/constants";
import type {
  Answer,
  ClientTrack,
  GameStatus,
  GuessRow,
  SearchResult,
  TurnInput,
  TurnResult,
} from "@/lib/types";
import { GuessGrid } from "./GuessGrid";
import { PlayButton } from "./PlayButton";
import { ProgressBar } from "./ProgressBar";
import { SearchFooter } from "./SearchFooter";

/** Context handed to a mode's end-screen renderer. */
export interface EndContext {
  won: boolean;
  answer: Answer;
  guesses: GuessRow[];
  /** Dismiss the end screen (the board stays visible behind it). */
  close: () => void;
}

interface SavedState {
  currentAttempt: number;
  guesses: GuessRow[];
  status: GameStatus;
  answer: Answer | null;
}

interface Props {
  track: ClientTrack;
  /** Small label next to the brand, e.g. "#42" or "Endless". */
  headerLabel: string;
  /** Link to the other game mode. */
  navHref: string;
  navLabel: string;
  /** Validates a guess/skip — daily and endless inject different resolvers. */
  onTurn: (input: TurnInput) => Promise<TurnResult>;
  /** Renders the mode-specific end screen once the round is over. */
  renderEnd: (ctx: EndContext) => ReactNode;
  /** localStorage key for progress persistence. Omit for ephemeral rounds. */
  persistKey?: string;
  /** Fired once when the round ends — used by Endless for streak tracking. */
  onRoundEnd?: (won: boolean) => void;
}

/**
 * The shared one-round game: audio engine, progress bar, guess grid, search
 * footer, and state machine. Mode-agnostic — daily and endless wrap it.
 */
export function GameBoard({
  track,
  headerLabel,
  navHref,
  navLabel,
  onTurn,
  renderEnd,
  persistKey,
  onRoundEnd,
}: Props) {
  const { isReady, isPlaying, positionMs, playSegment, stop } =
    useAudioEngine(track);

  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);

  // Restore saved progress (only when a persist key is supplied).
  useEffect(() => {
    if (!persistKey) {
      setHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) {
        const saved = JSON.parse(raw) as SavedState;
        setCurrentAttempt(saved.currentAttempt ?? 0);
        setGuesses(saved.guesses ?? []);
        setStatus(saved.status ?? "playing");
        setAnswer(saved.answer ?? null);
      }
    } catch {
      /* corrupt entry — start fresh */
    }
    setHydrated(true);
  }, [persistKey]);

  // Persist progress so a refresh resumes the round.
  useEffect(() => {
    if (!hydrated || !persistKey) return;
    const saved: SavedState = { currentAttempt, guesses, status, answer };
    try {
      localStorage.setItem(persistKey, JSON.stringify(saved));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [hydrated, persistKey, currentAttempt, guesses, status, answer]);

  // Report the round result exactly once when it ends.
  const roundEndReported = useRef(false);
  useEffect(() => {
    if (status !== "playing" && !roundEndReported.current) {
      roundEndReported.current = true;
      onRoundEnd?.(status === "won");
    }
  }, [status, onRoundEnd]);

  const handlePlayToggle = useCallback(() => {
    if (status !== "playing") return;
    if (isPlaying) stop();
    else playSegment(INTERVALS[currentAttempt]);
  }, [status, isPlaying, stop, playSegment, currentAttempt]);

  const handleGuess = useCallback(
    async (result: SearchResult) => {
      if (status !== "playing" || pending) return;
      setPending(true);
      stop();
      try {
        const res = await onTurn({
          action: "guess",
          guessTrackId: result.id,
          attemptIndex: currentAttempt,
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
        console.error("guess failed", err);
      } finally {
        setPending(false);
      }
    },
    [status, pending, stop, currentAttempt, onTurn],
  );

  const handleSkip = useCallback(async () => {
    if (status !== "playing" || pending) return;
    setPending(true);
    stop();
    try {
      const res = await onTurn({ action: "skip", attemptIndex: currentAttempt });
      setGuesses((g) => [...g, { outcome: "skipped", label: "Skipped" }]);
      setCurrentAttempt((a) => a + 1);
      if (res.gameOver) {
        setAnswer(res.answer);
        setStatus("lost");
      }
    } catch (err) {
      console.error("skip failed", err);
    } finally {
      setPending(false);
    }
  }, [status, pending, stop, currentAttempt, onTurn]);

  const over = status !== "playing";
  const unlockedMs = over
    ? TOTAL_MS
    : INTERVALS[Math.min(currentAttempt, MAX_ATTEMPTS - 1)];
  const showEnd = over && answer !== null && !modalDismissed;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-extrabold tracking-tight">
            Shirimim<span className="text-emerald-400">.</span>
          </h1>
          <span className="text-xs text-white/40">{headerLabel}</span>
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-1.5">
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
            href={navHref}
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            {navLabel}
          </Link>
          <Link
            href="/archive"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            Archive
          </Link>
          <Link
            href="/stats"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            Stats
          </Link>
          <Link
            href="/party"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
          >
            Party
          </Link>
        </nav>
      </header>

      <ProgressBar positionMs={positionMs} unlockedMs={unlockedMs} />

      <div className="flex justify-center py-8">
        <PlayButton
          isPlaying={isPlaying}
          disabled={!isReady || over}
          onClick={handlePlayToggle}
        />
      </div>

      <div className="flex-1">
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

      {track.source === "youtube" && (
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 left-[-9999px] h-[200px] w-[200px] overflow-hidden"
        >
          <div id={YT_HOST_ID} />
        </div>
      )}

      {showEnd &&
        answer &&
        renderEnd({
          won: status === "won",
          answer,
          guesses,
          close: () => setModalDismissed(true),
        })}
    </main>
  );
}
