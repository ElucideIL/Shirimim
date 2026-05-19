"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { endRound, startRound } from "@/actions/party";
import { PARTY_REVEAL_SECONDS, PARTY_ROUND_MS } from "@/lib/constants";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { AnswerButtons } from "./AnswerButtons";
import { Leaderboard } from "./Leaderboard";
import { Podium } from "./Podium";
import { RoundAudio } from "./RoundAudio";
import { RoundTimer } from "./RoundTimer";

export function HostView({ code, hostId }: { code: string; hostId: string }) {
  const { roster, round, reveal, answeredCount, phase } = usePartyRoom(code);
  const [busy, setBusy] = useState(false);
  const [nextReady, setNextReady] = useState(false);
  const endedRound = useRef(0);

  const handleStart = useCallback(async () => {
    setBusy(true);
    try {
      await startRound(code, hostId);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }, [code, hostId]);

  const triggerEnd = useCallback(async () => {
    if (!round || endedRound.current === round.round) return;
    endedRound.current = round.round;
    try {
      await endRound(code, hostId);
    } catch (err) {
      console.error(err);
    }
  }, [code, hostId, round]);

  // End the round automatically once everyone has answered.
  useEffect(() => {
    if (phase === "round" && roster.length > 0 && answeredCount >= roster.length) {
      void triggerEnd();
    }
  }, [phase, answeredCount, roster.length, triggerEnd]);

  // Gate the "Next round" button for the reveal window.
  useEffect(() => {
    if (phase !== "reveal") {
      setNextReady(false);
      return;
    }
    const id = window.setTimeout(
      () => setNextReady(true),
      PARTY_REVEAL_SECONDS * 1000,
    );
    return () => window.clearTimeout(id);
  }, [phase, reveal?.round]);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/party/${code}` : "";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-lg font-extrabold tracking-tight">
          Shirimim<span className="text-emerald-400">.</span>{" "}
          <span className="text-white/40">Party</span>
        </h1>
        {round && (
          <span className="text-xs text-white/40">
            Round {round.round}/{round.maxRounds}
          </span>
        )}
      </header>

      {/* ---- Lobby ---- */}
      {phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center gap-6 pt-6">
          <div className="text-center">
            <p className="text-xs tracking-widest text-white/40 uppercase">
              Join code
            </p>
            <p className="mt-1 text-5xl font-extrabold tracking-[0.3em]">
              {code}
            </p>
            <p className="mt-2 text-xs break-all text-white/35">{shareUrl}</p>
          </div>

          <div className="w-full">
            <p className="mb-2 text-sm text-white/50">
              Players ({roster.length})
            </p>
            {roster.length === 0 ? (
              <p className="text-sm text-white/30">Waiting for players to join…</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {roster.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
                  >
                    {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={busy || roster.length === 0}
            className="mt-auto mb-6 w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-30"
          >
            {busy ? "Starting…" : "Start game"}
          </button>
        </div>
      )}

      {/* ---- Round ---- */}
      {phase === "round" && round && (
        <div className="flex flex-1 flex-col gap-5 pt-2">
          <RoundAudio key={round.round} track={round.audio} muted={false} />
          <RoundTimer
            key={round.round}
            durationMs={PARTY_ROUND_MS}
            onElapsed={triggerEnd}
          />
          <p className="text-center text-sm text-white/50">
            {answeredCount} / {roster.length} answered
          </p>
          <AnswerButtons
            options={round.options}
            pickedId={null}
            correctId={null}
            disabled
            onPick={() => {}}
          />
          <button
            type="button"
            onClick={triggerEnd}
            className="mt-auto mb-6 w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-white/80 hover:bg-white/10"
          >
            Reveal now
          </button>
        </div>
      )}

      {/* ---- Reveal ---- */}
      {phase === "reveal" && reveal && (
        <div className="flex flex-1 flex-col gap-5 pt-2">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <p className="text-xs tracking-widest text-emerald-300 uppercase">
              Answer
            </p>
            {reveal.answer.artworkUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={reveal.answer.artworkUrl}
                alt=""
                className="mx-auto mt-3 h-24 w-24 rounded-xl object-cover"
              />
            )}
            <p className="mt-3 text-lg font-bold">{reveal.answer.title}</p>
            <p className="text-sm text-white/55">{reveal.answer.artist}</p>
          </div>
          <Leaderboard entries={reveal.leaderboard} />
          <button
            type="button"
            onClick={handleStart}
            disabled={busy || !nextReady}
            className="mt-auto mb-6 w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-30"
          >
            {nextReady ? "Next round" : `Next round in ${PARTY_REVEAL_SECONDS}s…`}
          </button>
        </div>
      )}

      {/* ---- Finished ---- */}
      {phase === "finished" && reveal && (
        <div className="flex flex-1 flex-col gap-6 pt-4">
          <p className="text-center text-xl font-extrabold">Game over!</p>
          <Podium entries={reveal.leaderboard} />
          <Link
            href="/party"
            className="mt-auto mb-6 w-full rounded-xl border border-white/15 px-4 py-3 text-center text-sm text-white/80 hover:bg-white/10"
          >
            New game
          </Link>
        </div>
      )}
    </main>
  );
}
