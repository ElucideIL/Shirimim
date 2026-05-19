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

// --- Party Mode ---
/** Length of one Party round's audio clip + answer window. */
export const PARTY_ROUND_SECONDS = 15;
export const PARTY_ROUND_MS = PARTY_ROUND_SECONDS * 1000;
/** Max points for an instant correct answer. */
export const PARTY_MAX_POINTS = 1000;
/** How long the reveal + leaderboard shows between rounds. */
export const PARTY_REVEAL_SECONDS = 5;
/** Round-count bounds the host can choose when creating a room. */
export const PARTY_DEFAULT_ROUNDS = 10;
export const PARTY_MIN_ROUNDS = 3;
export const PARTY_MAX_ROUNDS = 20;
