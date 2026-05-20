"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createRoom, getPartyGenres } from "@/actions/party";
import {
  PARTY_DEFAULT_ROUNDS,
  PARTY_MAX_ROUNDS,
  PARTY_MIN_ROUNDS,
} from "@/lib/constants";

export default function PartyEntryPage() {
  const router = useRouter();
  const [rounds, setRounds] = useState(PARTY_DEFAULT_ROUNDS);
  const [genre, setGenre] = useState("");
  const [genres, setGenres] = useState<{ genre: string; n: number }[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPartyGenres()
      .then(setGenres)
      .catch(() => setGenres([]));
  }, []);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(rounds, genre || null);
      sessionStorage.setItem(`party:${room.code}:host`, room.hostId);
      router.push(`/party/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a room.");
      setBusy(false);
    }
  }

  function handleJoin() {
    const clean = code.trim().toUpperCase();
    if (clean.length === 6) router.push(`/party/${clean}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-lg font-extrabold tracking-tight">
          Shirimim<span className="text-emerald-400">.</span>{" "}
          <span className="text-white/40">Party</span>
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Daily
        </Link>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-5 pb-10">
        <p className="text-center text-sm text-white/50">
          Race your friends to name the song — Kahoot-style.
        </p>

        {/* Create */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold">Host a new game</h2>
          <label className="mt-3 flex items-center justify-between text-sm text-white/60">
            Rounds
            <input
              type="number"
              min={PARTY_MIN_ROUNDS}
              max={PARTY_MAX_ROUNDS}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-center text-white outline-none focus:border-white/30"
            />
          </label>
          {genres.length > 0 && (
            <label className="mt-3 flex items-center justify-between text-sm text-white/60">
              Genre
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-40 rounded-lg border border-white/10 bg-neutral-800 px-3 py-1.5 text-white outline-none focus:border-white/30"
              >
                <option value="">All genres</option>
                {genres.map((g) => (
                  <option key={g.genre} value={g.genre}>
                    {g.genre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-30"
          >
            {busy ? "Creating…" : "Create room"}
          </button>
        </div>

        {/* Join */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold">Join a game</h2>
          <input
            type="text"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="6-letter code"
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] uppercase outline-none focus:border-white/30"
          />
          <button
            type="button"
            onClick={handleJoin}
            disabled={code.trim().length !== 6}
            className="mt-4 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white/85 hover:bg-white/10 disabled:opacity-30"
          >
            Join room
          </button>
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}
