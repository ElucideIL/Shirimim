"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ArchiveEntry } from "@/lib/types";

type Played = "won" | "lost" | null;

/** Read a past day's saved result from localStorage (written by GameBoard). */
function playedStatus(day: number): Played {
  try {
    const raw = localStorage.getItem(`shirimim:day:${day}`);
    if (!raw) return null;
    const status = JSON.parse(raw)?.status;
    return status === "won" || status === "lost" ? status : null;
  } catch {
    return null;
  }
}

function Badge({ status }: { status: Played }) {
  if (status === "won") {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
        Solved
      </span>
    );
  }
  if (status === "lost") {
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
        Missed
      </span>
    );
  }
  return <span className="text-xs text-emerald-400">Play →</span>;
}

/** The daily archive: every past puzzle, with the player's own result badge. */
export function ArchiveList({ entries }: { entries: ArchiveEntry[] }) {
  const [played, setPlayed] = useState<Record<number, Played>>({});

  useEffect(() => {
    const map: Record<number, Played> = {};
    for (const e of entries) map[e.day] = playedStatus(e.day);
    setPlayed(map);
  }, [entries]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-lg font-extrabold tracking-tight">
          Shirimim<span className="text-emerald-400">.</span>{" "}
          <span className="text-white/40">Archive</span>
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Daily
        </Link>
      </header>

      {entries.length === 0 ? (
        <p className="pt-10 text-center text-sm text-white/30">
          No past puzzles yet — check back tomorrow.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 pb-8">
          {entries.map((e) => (
            <li key={e.day}>
              <Link
                href={`/archive/${e.day}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.07]"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-white">
                    #{e.day}
                  </span>
                  <span className="text-xs text-white/45">{e.date}</span>
                </span>
                <Badge status={played[e.day] ?? null} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
