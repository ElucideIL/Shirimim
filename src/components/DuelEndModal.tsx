"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getDuelResults, submitDuelResult } from "@/actions/duel";
import { MAX_ATTEMPTS } from "@/lib/constants";
import {
  MAX_NAME_LENGTH,
  getPlayerId,
  getPlayerName,
  setPlayerName,
} from "@/lib/identity";
import type { Answer, GuessRow, ResultRow } from "@/lib/types";

interface Props {
  duelId: string;
  won: boolean;
  answer: Answer;
  guesses: GuessRow[];
  onClose: () => void;
}

function DuelRow({ row, you = false }: { row: ResultRow; you?: boolean }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
        you
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <span className="flex-1 truncate text-sm text-white">
        {row.name}
        {you && (
          <span className="ml-1.5 text-[10px] tracking-wide text-emerald-400/80 uppercase">
            you
          </span>
        )}
      </span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          row.won ? "text-emerald-300" : "text-red-300"
        }`}
      >
        {row.won ? `${row.guesses}/${MAX_ATTEMPTS}` : "X"}
      </span>
    </li>
  );
}

/** Duel end screen: your result, the share link, and the friend's result. */
export function DuelEndModal({ duelId, won, answer, guesses, onClose }: Props) {
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");

  const myGuesses = guesses.length;

  const sync = useCallback(async () => {
    const pid = getPlayerId();
    const savedName = getPlayerName();
    if (savedName) {
      await submitDuelResult({
        duelId,
        playerId: pid,
        name: savedName,
        won,
        guesses: myGuesses,
      }).catch(() => {});
    }
    const rows = await getDuelResults(duelId).catch(() => []);
    setResults(rows);
  }, [duelId, won, myGuesses]);

  useEffect(() => {
    setPlayerId(getPlayerId());
    const savedName = getPlayerName();
    setName(savedName);
    setNameInput(savedName);
    setLink(`${window.location.origin}/duel/${duelId}`);
    void sync();
  }, [duelId, sync]);

  async function saveName() {
    const clean = nameInput.trim().slice(0, MAX_NAME_LENGTH);
    if (!clean) return;
    setBusy(true);
    setPlayerName(clean);
    setName(clean);
    await sync();
    setBusy(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — the link is shown below for manual copy */
    }
  }

  const mine = results?.find((r) => r.playerId === playerId) ?? null;
  const others = results?.filter((r) => r.playerId !== playerId) ?? [];

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
            className="mx-auto mt-4 h-28 w-28 rounded-xl object-cover"
          />
        )}
        <h2 className="mt-3 text-lg font-bold text-white">{answer.title}</h2>
        <p className="text-sm text-white/55">{answer.artist}</p>
        <p className="mt-2 text-xs text-white/45">
          Your result:{" "}
          {won ? `${myGuesses}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`}
        </p>

        {!name && (
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={nameInput}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="Your name"
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            <button
              type="button"
              onClick={saveName}
              disabled={busy || !nameInput.trim()}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-30"
            >
              Save
            </button>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-widest text-white/35 uppercase">
              Duel
            </p>
            <button
              type="button"
              onClick={() => void sync()}
              className="text-xs text-white/45 hover:text-white/80"
            >
              Refresh
            </button>
          </div>
          {results === null ? (
            <p className="py-2 text-center text-xs text-white/30">Loading…</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {mine && <DuelRow row={mine} you />}
              {others.map((r) => (
                <DuelRow key={r.playerId} row={r} />
              ))}
              {others.length === 0 && (
                <li className="py-1 text-center text-xs text-white/35">
                  Waiting for your friend to play…
                </li>
              )}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={copyLink}
          className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
        >
          {copied ? "Link copied!" : "Copy challenge link"}
        </button>
        <p className="mt-2 truncate text-[11px] text-white/30">{link}</p>

        <div className="mt-3">
          <Link href="/duel" className="text-xs text-emerald-400 hover:underline">
            Start a new duel
          </Link>
        </div>
      </div>
    </div>
  );
}
