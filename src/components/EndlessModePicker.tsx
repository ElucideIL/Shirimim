"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getEndlessModes } from "@/actions/endless";
import type { EndlessFilter, EndlessModes } from "@/lib/types";

/** Sub-mode picker shown when entering Endless: All / Hebrew / by genre. */
export function EndlessModePicker({
  onPick,
}: {
  onPick: (filter: EndlessFilter) => void;
}) {
  const [modes, setModes] = useState<EndlessModes | null>(null);

  useEffect(() => {
    getEndlessModes()
      .then(setModes)
      .catch(() => setModes({ hebrew: 0, genres: [], artists: [] }));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-lg font-extrabold tracking-tight">
          Shirimim<span className="text-emerald-400">.</span>{" "}
          <span className="text-white/40">Endless</span>
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Daily
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-3 pt-4">
        <p className="text-sm text-white/50">
          Pick a mode — guess songs back to back until you miss one.
        </p>

        <button
          type="button"
          onClick={() => onPick({ kind: "all" })}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          All songs
        </button>

        {modes && modes.hebrew > 0 && (
          <button
            type="button"
            onClick={() => onPick({ kind: "hebrew" })}
            className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-medium hover:bg-white/10"
          >
            Hebrew songs <span className="text-white/40">· {modes.hebrew}</span>
          </button>
        )}

        {modes && modes.genres.length > 0 && (
          <>
            <p className="mt-2 text-xs tracking-widest text-white/35 uppercase">
              By genre
            </p>
            <div className="flex flex-wrap gap-2">
              {modes.genres.map((g) => (
                <button
                  key={g.genre}
                  type="button"
                  onClick={() => onPick({ kind: "genre", genre: g.genre })}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                >
                  {g.genre} <span className="text-white/40">· {g.n}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {modes && modes.artists.length > 0 && (
          <>
            <p className="mt-2 text-xs tracking-widest text-white/35 uppercase">
              By artist
            </p>
            <div className="flex flex-wrap gap-2 pb-6">
              {modes.artists.map((a) => (
                <button
                  key={a.artist}
                  type="button"
                  onClick={() => onPick({ kind: "artist", artist: a.artist })}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                >
                  {a.artist} <span className="text-white/40">· {a.n}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {!modes && <p className="text-sm text-white/30">Loading modes…</p>}
      </div>
    </main>
  );
}
