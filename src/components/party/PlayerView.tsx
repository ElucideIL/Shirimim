"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  joinRoom,
  submitPartyAnswer,
  useDoublePoints,
  useFiftyFifty,
} from "@/actions/party";
import { PARTY_ROUND_MS } from "@/lib/constants";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { AnswerButtons } from "./AnswerButtons";
import { Leaderboard } from "./Leaderboard";
import { Podium } from "./Podium";
import { RoundAudio } from "./RoundAudio";
import { RoundTimer } from "./RoundTimer";

export function PlayerView({ code }: { code: string }) {
  const { roster, round, reveal, phase } = usePartyRoom(code);

  const [hydrated, setHydrated] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  // Power-ups: one 50:50 and one double-points per game.
  const [usedFifty, setUsedFifty] = useState(false);
  const [usedDouble, setUsedDouble] = useState(false);
  const [doubleArmed, setDoubleArmed] = useState(false);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const storeKey = `party:${code}:player`;

  useEffect(() => {
    setPlayerId(sessionStorage.getItem(storeKey));
    setHydrated(true);
  }, [storeKey]);

  // Reset the per-round state whenever a new round starts.
  useEffect(() => {
    setPicked(null);
    setDoubleArmed(false);
    setRemovedIds([]);
  }, [round?.round]);

  const handleJoin = useCallback(async () => {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await joinRoom(code, name);
      sessionStorage.setItem(storeKey, res.playerId);
      setPlayerId(res.playerId);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setJoining(false);
    }
  }, [code, name, storeKey]);

  const handlePick = useCallback(
    async (optionId: string) => {
      if (!playerId || picked) return;
      setPicked(optionId);
      try {
        await submitPartyAnswer(code, playerId, optionId);
      } catch (err) {
        console.error(err);
      }
    },
    [code, playerId, picked],
  );

  const handleFifty = useCallback(async () => {
    if (!playerId || usedFifty || picked) return;
    setUsedFifty(true);
    try {
      const res = await useFiftyFifty(code, playerId);
      setRemovedIds(res.removedOptionIds);
    } catch (err) {
      console.error(err);
    }
  }, [code, playerId, usedFifty, picked]);

  const handleDouble = useCallback(async () => {
    if (!playerId || usedDouble || picked) return;
    setUsedDouble(true);
    try {
      const res = await useDoublePoints(code, playerId);
      setDoubleArmed(res.armed);
    } catch (err) {
      console.error(err);
    }
  }, [code, playerId, usedDouble, picked]);

  const shell = "mx-auto flex min-h-dvh w-full max-w-md flex-col px-5";

  if (!hydrated) return <main className={shell} />;

  // ---- Name entry ----
  if (!playerId) {
    return (
      <main className={`${shell} items-center justify-center gap-4`}>
        <h1 className="text-lg font-extrabold tracking-tight">
          Shirimim<span className="text-emerald-400">.</span> Party
        </h1>
        <p className="text-sm text-white/50">
          Joining room <span className="font-bold text-white">{code}</span>
        </p>
        <input
          type="text"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && handleJoin()}
          placeholder="Your name"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm outline-none focus:border-white/30"
        />
        <button
          type="button"
          onClick={handleJoin}
          disabled={joining || !name.trim()}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-30"
        >
          {joining ? "Joining…" : "Join game"}
        </button>
        {joinError && <p className="text-sm text-red-400">{joinError}</p>}
        <Link href="/party" className="text-xs text-white/40 hover:underline">
          Wrong room?
        </Link>
      </main>
    );
  }

  const youName = roster.find((p) => p.id === playerId)?.name ?? name;

  return (
    <main className={shell}>
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
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm font-semibold text-emerald-300">
            You&apos;re in, {youName}!
          </p>
          <p className="text-sm text-white/45">
            Waiting for the host to start the game…
          </p>
          <p className="text-xs text-white/35">{roster.length} players in the room</p>
        </div>
      )}

      {/* ---- Round ---- */}
      {phase === "round" && round && (
        <div className="flex flex-1 flex-col gap-5 pt-2">
          <RoundAudio key={round.round} track={round.audio} muted={muted} />
          <div className="flex items-center justify-between">
            <RoundTimer key={round.round} durationMs={PARTY_ROUND_MS} />
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="ml-3 shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              {muted ? "🔇 Tap for sound" : "🔊 Sound on"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleFifty}
              disabled={usedFifty || picked !== null}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-30"
            >
              {usedFifty ? "50:50 used" : "✂️ 50:50"}
            </button>
            <button
              type="button"
              onClick={handleDouble}
              disabled={usedDouble || picked !== null}
              className={`rounded-lg border px-3 py-2 text-xs font-medium hover:bg-white/10 disabled:opacity-30 ${
                doubleArmed
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                  : "border-white/15 text-white/80"
              }`}
            >
              {doubleArmed
                ? "2× armed!"
                : usedDouble
                  ? "2× used"
                  : "✨ 2× points"}
            </button>
          </div>
          <AnswerButtons
            options={round.options}
            pickedId={picked}
            correctId={null}
            disabled={picked !== null}
            removedIds={removedIds}
            onPick={handlePick}
          />
          {picked && (
            <p className="text-center text-sm text-emerald-300">
              Answer locked in — hang tight!
            </p>
          )}
        </div>
      )}

      {/* ---- Reveal ---- */}
      {phase === "reveal" && reveal && (
        <div className="flex flex-1 flex-col gap-5 pt-2">
          <div
            className={`rounded-2xl border p-5 text-center ${
              picked && picked === reveal.correctOptionId
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            <p className="text-sm font-bold">
              {!picked
                ? "Too slow!"
                : picked === reveal.correctOptionId
                  ? "Correct!"
                  : "Wrong!"}
            </p>
            <p className="mt-2 text-lg font-bold">{reveal.answer.title}</p>
            <p className="text-sm text-white/55">{reveal.answer.artist}</p>
          </div>
          <Leaderboard entries={reveal.leaderboard} youId={playerId} />
        </div>
      )}

      {/* ---- Finished ---- */}
      {phase === "finished" && reveal && (
        <div className="flex flex-1 flex-col gap-6 pt-4">
          <p className="text-center text-xl font-extrabold">Final results</p>
          <Podium entries={reveal.leaderboard} youId={playerId} />
          <Link
            href="/"
            className="mt-auto mb-6 w-full rounded-xl border border-white/15 px-4 py-3 text-center text-sm text-white/80 hover:bg-white/10"
          >
            Back to Shirimim
          </Link>
        </div>
      )}
    </main>
  );
}
