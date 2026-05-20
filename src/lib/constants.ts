/** Cumulative playback caps in ms — attempt N may hear 0..INTERVALS[N]. */
export const INTERVALS = [1000, 2000, 4000, 8000, 15000] as const;

/** Total attempts allowed (and rows in the guess grid). */
export const MAX_ATTEMPTS = INTERVALS.length;

/** Full length of the progress bar in ms. */
export const TOTAL_MS = INTERVALS[INTERVALS.length - 1];

/** Post-answer "hear more" replay length, in ms (iTunes previews cap at ~30s). */
export const FULL_CLIP_MS = 30000;

/** Per-segment widths, proportional to each interval's increment [1,1,2,3,4,5]. */
export const SEGMENT_MS: number[] = INTERVALS.map(
  (ms, i) => ms - (i === 0 ? 0 : INTERVALS[i - 1]),
);

// --- Hints ---
/** Attempts that must be used before the genre hint unlocks. */
export const HINT_GENRE_AFTER = 2;
/** Attempts that must be used before the release-year hint unlocks. */
export const HINT_YEAR_AFTER = 3;

// --- Lyrics mode ---
/** Lyric lines in one round — one is shown up front, one more per wrong guess. */
export const LYRICS_LINES = MAX_ATTEMPTS;

/**
 * DOM id of the permanent off-screen host the YouTube IFrame player mounts
 * into. It lives in the root layout and must never unmount — see audioEngine.
 */
export const YT_HOST_ID = "yt-player-host";

/** Day 0 of the game (calendar date in GAME_TZ). */
export const EPOCH = "2026-05-20";

/** All daily-puzzle date math happens in this timezone. */
export const GAME_TZ = "Asia/Jerusalem";

// --- Party Mode ---
/** Default Party round length; the host can override it (see _CHOICES). */
export const PARTY_ROUND_SECONDS = 15;
export const PARTY_ROUND_MS = PARTY_ROUND_SECONDS * 1000;
/** Round lengths the host may pick from, in seconds. */
export const PARTY_ROUND_SECONDS_CHOICES = [10, 15, 20] as const;
/** Max points for an instant correct answer. */
export const PARTY_MAX_POINTS = 1000;
/** Streak bonus: +STEP points per consecutive correct answer, capped at CAP. */
export const PARTY_STREAK_STEP = 100;
export const PARTY_STREAK_CAP = 5;
/** How long the reveal + leaderboard shows between rounds. */
export const PARTY_REVEAL_SECONDS = 5;
/** Round-count bounds the host can choose when creating a room. */
export const PARTY_DEFAULT_ROUNDS = 10;
export const PARTY_MIN_ROUNDS = 3;
export const PARTY_MAX_ROUNDS = 20;
/** The emoji a player can fling into the room. */
export const PARTY_REACTIONS = ["🔥", "😂", "😮", "👏", "💀"] as const;
