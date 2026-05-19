"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  resolveEndlessTurn,
  startEndlessRound,
  type EndlessRound,
} from "@/actions/endless";
import { buildShareText } from "@/lib/share";
import type { TurnInput } from "@/lib/types";
import { EndModal } from "./EndModal";
import { GameBoard } from "./GameBoard";

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

/** Endless mode: a fresh random song every round, replay as much as you like. */
export function EndlessGame() {
  const [round, setRound] = useState<EndlessRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRound = useCallback(async (prevToken?: string) => {
    setLoading(true);
    try {
      const next = await startEndlessRound(prevToken);
      if (next) {
        setRound(next);
        setNotice(null);
      } else {
        setNotice("The song library is empty — run the ingestion script first.");
      }
    } catch {
      setNotice("Couldn't start a round. Check the Supabase configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRound();
  }, [loadRound]);

  if (!round) {
    return <Notice text={loading ? "Loading…" : (notice ?? "Loading…")} />;
  }

  return (
    <GameBoard
      key={round.token}
      track={round.track}
      headerLabel="Endless"
      navHref="/"
      navLabel="Daily"
      onTurn={(input: TurnInput) =>
        resolveEndlessTurn({ ...input, token: round.token })
      }
      renderEnd={({ won, answer, guesses, close }) => (
        <EndModal
          won={won}
          answer={answer}
          guesses={guesses}
          shareText={buildShareText(null, guesses, won)}
          onClose={close}
          footer={
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadRound(round.token)}
              className="w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10 disabled:opacity-40"
            >
              {loading ? "Loading…" : "Next song →"}
            </button>
          }
        />
      )}
    />
  );
}
