"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  durationMs: number;
  /** Fired once when the countdown reaches zero. */
  onElapsed?: () => void;
}

/** A 15-second countdown. Mount it with a per-round key so it restarts cleanly. */
export function RoundTimer({ durationMs, onElapsed }: Props) {
  const [remaining, setRemaining] = useState(durationMs);
  const cb = useRef(onElapsed);
  cb.current = onElapsed;

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, durationMs - (Date.now() - start));
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        cb.current?.();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [durationMs]);

  const pct = (remaining / durationMs) * 100;
  const secs = Math.ceil(remaining / 1000);

  return (
    <div className="w-full">
      <div className="mb-1 text-center text-2xl font-bold tabular-nums">
        {secs}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-100 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
