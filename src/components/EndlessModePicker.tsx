"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getEndlessModes } from "@/actions/endless";
import type { EndlessFilter, EndlessModes } from "@/lib/types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <p className="mt-2 text-xs tracking-widest text-white/35 uppercase">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </>
  );
}

function Chip({
  label,
  n,
  onClick,
}: {
  label: string;
  n: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
    >
      {label} <span className="text-white/40">· {n}</span>
    </button>
  );
}

/** Sub-mode picker shown when entering Endless: all / genre / Hebrew / etc. */
export function EndlessModePicker({
  onPick,
}: {
  onPick: (filter: EndlessFilter) => void;
}) {
  const [modes, setModes] = useState<EndlessModes | null>(null);

  useEffect(() => {
    getEndlessModes()
      .then(setModes)
      .catch(() =>
        setModes({
          hebrew: 0,
          genres: [],
          hebrewGenres: [],
          artists: [],
          decades: [],
        }),
      );
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

      <div className="flex flex-1 flex-col gap-3 pt-4 pb-8">
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

        {modes && modes.genres.length > 0 && (
          <Section title="By genre">
            {modes.genres.map((g) => (
              <Chip
                key={g.genre}
                label={g.genre}
                n={g.n}
                onClick={() => onPick({ kind: "genre", genre: g.genre })}
              />
            ))}
          </Section>
        )}

        {modes && modes.hebrew > 0 && (
          <Section title="Hebrew">
            <Chip
              label="All Hebrew"
              n={modes.hebrew}
              onClick={() => onPick({ kind: "hebrew" })}
            />
            {modes.hebrewGenres.map((g) => (
              <Chip
                key={g.genre}
                label={g.genre}
                n={g.n}
                onClick={() => onPick({ kind: "hebrew_genre", genre: g.genre })}
              />
            ))}
          </Section>
        )}

        {modes && modes.decades.length > 0 && (
          <Section title="By decade">
            {modes.decades.map((d) => (
              <Chip
                key={d.decade}
                label={`${d.decade}s`}
                n={d.n}
                onClick={() => onPick({ kind: "decade", decade: d.decade })}
              />
            ))}
          </Section>
        )}

        {modes && modes.artists.length > 0 && (
          <Section title="By artist">
            {modes.artists.map((a) => (
              <Chip
                key={a.artist}
                label={a.artist}
                n={a.n}
                onClick={() => onPick({ kind: "artist", artist: a.artist })}
              />
            ))}
          </Section>
        )}

        {!modes && <p className="text-sm text-white/30">Loading modes…</p>}
      </div>
    </main>
  );
}
