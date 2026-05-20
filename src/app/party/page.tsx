"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getEndlessModes } from "@/actions/endless";
import { createRoom } from "@/actions/party";
import {
  PARTY_DEFAULT_ROUNDS,
  PARTY_MAX_ROUNDS,
  PARTY_MIN_ROUNDS,
  PARTY_ROUND_SECONDS,
  PARTY_ROUND_SECONDS_CHOICES,
} from "@/lib/constants";
import type { EndlessFilter, EndlessModes } from "@/lib/types";

/** Decode the category <select> value back into a library filter. */
function parseCategory(v: string): EndlessFilter {
  if (v === "all") return { kind: "all" };
  if (v === "hebrew") return { kind: "hebrew" };
  const sep = v.indexOf(":");
  const kind = v.slice(0, sep);
  const rest = v.slice(sep + 1);
  if (kind === "genre") return { kind: "genre", genre: rest };
  if (kind === "hgenre") return { kind: "hebrew_genre", genre: rest };
  if (kind === "artist") return { kind: "artist", artist: rest };
  if (kind === "decade") return { kind: "decade", decade: Number(rest) };
  return { kind: "all" };
}

export default function PartyEntryPage() {
  const router = useRouter();
  const [rounds, setRounds] = useState(PARTY_DEFAULT_ROUNDS);
  const [roundSeconds, setRoundSeconds] = useState(PARTY_ROUND_SECONDS);
  const [category, setCategory] = useState("all");
  const [modes, setModes] = useState<EndlessModes | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEndlessModes()
      .then(setModes)
      .catch(() => setModes(null));
  }, []);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(
        rounds,
        parseCategory(category),
        roundSeconds,
      );
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

  const field =
    "w-44 rounded-lg border border-white/10 bg-neutral-800 px-3 py-1.5 text-white outline-none focus:border-white/30";

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

          <label className="mt-3 flex items-center justify-between text-sm text-white/60">
            Seconds per round
            <select
              value={roundSeconds}
              onChange={(e) => setRoundSeconds(Number(e.target.value))}
              className={field}
            >
              {PARTY_ROUND_SECONDS_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {s} seconds
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 flex items-center justify-between text-sm text-white/60">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={field}
            >
              <optgroup label="Everything">
                <option value="all">All songs</option>
              </optgroup>
              {modes && modes.hebrew > 0 && (
                <optgroup label="Hebrew">
                  <option value="hebrew">All Hebrew</option>
                  {modes.hebrewGenres.map((g) => (
                    <option key={g.genre} value={`hgenre:${g.genre}`}>
                      Hebrew · {g.genre}
                    </option>
                  ))}
                </optgroup>
              )}
              {modes && modes.genres.length > 0 && (
                <optgroup label="Genres">
                  {modes.genres.map((g) => (
                    <option key={g.genre} value={`genre:${g.genre}`}>
                      {g.genre}
                    </option>
                  ))}
                </optgroup>
              )}
              {modes && modes.decades.length > 0 && (
                <optgroup label="Decades">
                  {modes.decades.map((d) => (
                    <option key={d.decade} value={`decade:${d.decade}`}>
                      {d.decade}s
                    </option>
                  ))}
                </optgroup>
              )}
              {modes && modes.artists.length > 0 && (
                <optgroup label="Artists">
                  {modes.artists.map((a) => (
                    <option key={a.artist} value={`artist:${a.artist}`}>
                      {a.artist}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

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
