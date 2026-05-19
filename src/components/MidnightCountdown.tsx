"use client";

import { useEffect, useState } from "react";
import { formatDuration, msUntilNextMidnight } from "@/lib/time";

/** Live countdown to the next daily puzzle (next midnight in the game timezone). */
export function MidnightCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(msUntilNextMidnight());
    const id = window.setInterval(
      () => setRemaining(msUntilNextMidnight()),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <p className="text-xs text-white/40">
      Next song in{" "}
      <span className="tabular-nums text-white/70">
        {remaining === null ? "--:--:--" : formatDuration(remaining)}
      </span>
    </p>
  );
}
