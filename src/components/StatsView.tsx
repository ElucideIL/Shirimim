"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MAX_ATTEMPTS } from "@/lib/constants";

interface DayRecord {
  day: number;
  won: boolean;
  guesses: number;
}

interface Stats {
  played: number;
  winPct: number;
  currentStreak: number;
  maxStreak: number;
  /** distribution[i] = games won in (i + 1) guesses. */
  distribution: number[];
}

/** Scan localStorage for every finished daily game GameBoard has persisted. */
function readDailyRecords(): DayRecord[] {
  const records: DayRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const match = key && /^shirimim:day:(\d+)$/.exec(key);
    if (!match) continue;
    try {
      const saved = JSON.parse(localStorage.getItem(key as string) as string);
      if (saved?.status !== "won" && saved?.status !== "lost") continue;
      records.push({
        day: Number(match[1]),
        won: saved.status === "won",
        guesses: Array.isArray(saved.guesses) ? saved.guesses.length : 0,
      });
    } catch {
      /* corrupt entry — skip */
    }
  }
  return records.sort((a, b) => a.day - b.day);
}

function computeStats(records: DayRecord[]): Stats {
  const played = records.length;
  const wins = records.filter((r) => r.won).length;

  const distribution = Array.from({ length: MAX_ATTEMPTS }, () => 0);
  for (const r of records) {
    if (r.won && r.guesses >= 1 && r.guesses <= MAX_ATTEMPTS) {
      distribution[r.guesses - 1]++;
    }
  }

  const wonDays = new Set(records.filter((r) => r.won).map((r) => r.day));

  // Max streak: longest run of consecutive won day-numbers.
  let maxStreak = 0;
  for (const day of wonDays) {
    if (wonDays.has(day - 1)) continue; // only count from a run's start
    let len = 0;
    for (let d = day; wonDays.has(d); d++) len++;
    maxStreak = Math.max(maxStreak, len);
  }

  // Current streak: consecutive wins ending at the most recent finished day.
  let currentStreak = 0;
  if (played > 0) {
    for (let d = records[records.length - 1].day; wonDays.has(d); d--) {
      currentStreak++;
    }
  }

  return {
    played,
    winPct: played ? Math.round((wins / played) * 100) : 0,
    currentStreak,
    maxStreak,
    distribution,
  };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] py-3 text-center">
      <div className="text-xl font-bold tabular-nums text-white">{value}</div>
      <div className="mt-0.5 text-[10px] tracking-wide text-white/40 uppercase">
        {label}
      </div>
    </div>
  );
}

function Distribution({ distribution }: { distribution: number[] }) {
  const max = Math.max(1, ...distribution);
  return (
    <ul className="flex flex-col gap-1.5">
      {distribution.map((count, i) => (
        <li key={i} className="flex items-center gap-2 text-xs">
          <span className="w-3 shrink-0 tabular-nums text-white/50">
            {i + 1}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded bg-white/[0.04]">
            <div
              className="flex h-full items-center justify-end rounded bg-emerald-500/80 px-2 text-[11px] font-semibold text-black"
              style={{
                width: `${count > 0 ? Math.max((count / max) * 100, 12) : 0}%`,
              }}
            >
              {count > 0 ? count : ""}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Wordle-style daily stats, computed entirely from localStorage. */
export function StatsView() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    setStats(computeStats(readDailyRecords()));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-lg font-extrabold tracking-tight">
          Shirimim<span className="text-emerald-400">.</span>{" "}
          <span className="text-white/40">Stats</span>
        </h1>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          Daily
        </Link>
      </header>

      {stats === null ? (
        <p className="pt-10 text-center text-sm text-white/30">Loading…</p>
      ) : stats.played === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-white/50">No daily games played yet.</p>
          <Link
            href="/"
            className="text-xs text-emerald-400 hover:underline"
          >
            Play today&apos;s song
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6 pt-2">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Played" value={stats.played} />
            <Stat label="Win %" value={stats.winPct} />
            <Stat label="Streak" value={stats.currentStreak} />
            <Stat label="Best" value={stats.maxStreak} />
          </div>

          <div>
            <p className="mb-2 text-xs tracking-widest text-white/35 uppercase">
              Guess distribution
            </p>
            <Distribution distribution={stats.distribution} />
            <p className="mt-2 text-[11px] text-white/30">
              Wins by number of guesses. Losses aren&apos;t counted here.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
