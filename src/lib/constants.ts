/** Cumulative playback caps in ms — attempt N may hear 0..INTERVALS[N]. */
export const INTERVALS = [1000, 2000, 4000, 8000, 15000] as const;

/** Total attempts allowed (and rows in the guess grid). */
export const MAX_ATTEMPTS = INTERVALS.length;

/** Full length of the progress bar in ms. */
export const TOTAL_MS = INTERVALS[INTERVALS.length - 1];

/** Per-segment widths, proportional to each interval's increment [1,1,2,3,4,5]. */
export const SEGMENT_MS: number[] = INTERVALS.map(
  (ms, i) => ms - (i === 0 ? 0 : INTERVALS[i - 1]),
);

/** Day 0 of the game (calendar date in GAME_TZ). */
export const EPOCH = "2026-05-20";

/** All daily-puzzle date math happens in this timezone. */
export const GAME_TZ = "Asia/Jerusalem";
