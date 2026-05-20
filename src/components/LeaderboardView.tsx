"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getDailyLeaderboard,
  submitDailyResult,
} from "@/actions/leaderboard";
import { MAX_ATTEMPTS } from "@/lib/constants";
import {
  MAX_NAME_LENGTH,
  getPlayerId,
  getPlayerName,
  setPlayerName,
} from "@/lib/identity";
import type { ResultRow } from "@/lib/types";

interface OwnResult {
  won: boolean;
  guesses: number;
}

/** Read this browser's saved result for the given day, if the game finished. */
function readOwnResult(dayNumber: number): OwnResult | null {
  try {
    const raw = localStorage.getItem(`shirimim:day:${dayNumber}`);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.status !== "won" && saved?.status !== "lost") return null;
    return {
      won: saved.status === "won",
      guesses: Array.isArray(saved.guesses)
        ? saved.guesses.length
        : MAX_ATTEMPTS,
    };
  } catch {
    return null;
  }
}

function ResultBadge({ row }: { row: ResultRow }) {
  return row.won ? (
    <span className="text-sm font-semibold tabular-nums text-emerald-300">
      {row.guesses}/{MAX_ATTEMPTS}
    </span>
  ) : (
    <span className="text-sm font-semibold text-red-300">X</span>
  );
}

/** Today's friend leaderboard — honor-system, identified by display name. */
export function LeaderboardView({ dayNumber }: { dayNumber: number }) {
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [own, setOwn] = useState<OwnResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-read this browser's result, post it if a name is set, refetch the board.
  const sync = useCallback(async () => {
    const pid = getPlayerId();
    const savedName = getPlayerName();
    const ownResult = readOwnResult(dayNumber);
    setOwn(ownResult);

    if (savedName && ownResult) {
      await submitDailyResult({
        dayNumber,
        playerId: pid,
        name: savedName,
        won: ownResult.won,
        guesses: ownResult.guesses,
      }).catch(() => {});
    }
    const board = await getDailyLeaderboard(dayNumber).catch(() => []);
    setRows(board);
  }, [dayNumber]);

  useEffect(() => {
    setPlayerId(getPlayerId());
    const savedName = getPlayerName();
    setName(savedName);
    setNameInput(savedName);
    void sync();
  }, [sync]);

  async function saveName() {
    const clean = nameInput.trim().slice(0, MAX_NAME_LENGTH);
    if (!clean) return;
    setBusy(true);
    setPlayerName(clean);
    setName(clean);
    setEditingName(false);
    await sync();
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-lg font-extrabold tracking-tight">
          Shirimim<span className="text-emerald-400">.</span>{" "}
          <span className="text-white/40">Leaderboard</span>
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Daily
        </Link>
      </header>

      <p className="text-sm text-white/50">
        Today&apos;s puzzle · <span className="text-white/70">#{dayNumber}</span>
      </p>
      <Link
        href="/duel"
        className="mt-1 inline-block text-xs text-emerald-400 hover:underline"
      >
        Or challenge a friend to a 1-v-1 duel →
      </Link>

      {name && !editingName ? (
        <p className="mt-3 text-xs text-white/45">
          You&apos;re playing as{" "}
          <span className="font-semibold text-white/80">{name}</span>{" "}
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="text-emerald-400 hover:underline"
          >
            change
          </button>
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={nameInput}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            placeholder="Pick a name to join the board"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={busy || !nameInput.trim()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-30"
          >
            Save
          </button>
        </div>
      )}

      {!own && (
        <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
          Play{" "}
          <Link href="/" className="text-emerald-400 hover:underline">
            today&apos;s song
          </Link>{" "}
          to get on the board.
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs tracking-widest text-white/35 uppercase">
          Results
        </p>
        <button
          type="button"
          onClick={() => void sync()}
          className="text-xs text-white/45 hover:text-white/80"
        >
          Refresh
        </button>
      </div>

      {rows === null ? (
        <p className="pt-6 text-center text-sm text-white/30">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="pt-6 text-center text-sm text-white/30">
          No results yet — be the first.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5 pb-8">
          {rows.map((row, i) => {
            const isMe = row.playerId === playerId;
            return (
              <li
                key={row.playerId}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                  isMe
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-white/40">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm text-white">
                  {row.name}
                  {isMe && (
                    <span className="ml-1.5 text-[10px] tracking-wide text-emerald-400/80 uppercase">
                      you
                    </span>
                  )}
                </span>
                <ResultBadge row={row} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
