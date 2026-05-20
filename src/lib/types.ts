export type AudioSource = "itunes" | "youtube";

/** Full track row as stored in the DB and used server-side. */
export interface Track {
  id: string;
  artist: string;
  title: string;
  source: AudioSource;
  previewUrl: string | null;
  youtubeId: string | null;
  artworkUrl: string | null;
  /** Playback starts this many ms in — skips a quiet intro. */
  startOffsetMs: number;
  /** Canonical genre — null when unknown (e.g. an un-backfilled YouTube track). */
  genre: string | null;
  /** 4-digit release year — null when unknown. */
  releaseYear: number | null;
}

/** Only the fields safe to send to the browser before the game ends. */
export interface ClientTrack {
  source: AudioSource;
  previewUrl: string | null;
  youtubeId: string | null;
  /** Playback starts this many ms in — skips a quiet intro. */
  startOffsetMs: number;
}

/** One autocomplete search hit. */
export interface SearchResult {
  id: string;
  artist: string;
  title: string;
}

/** The revealed answer — sent to the client only once the game is over. */
export interface Answer {
  artist: string;
  title: string;
  artworkUrl: string | null;
}

// "artist" = wrong song but the same artist as the answer.
export type GuessOutcome = "correct" | "artist" | "wrong" | "skipped";

/** One filled row in the guess history grid. */
export interface GuessRow {
  outcome: GuessOutcome;
  label: string;
}

export type GameStatus = "playing" | "won" | "lost";

/** A guess or skip submitted for server-side validation. */
export interface TurnInput {
  action: "guess" | "skip";
  /** Track id selected from the autocomplete (required when action = "guess"). */
  guessTrackId?: string;
  /** 0-based index of the attempt this turn represents. */
  attemptIndex: number;
}

/** Progressively unlocked clues about the answer (genre, then release year). */
export interface Hint {
  /** The answer's genre — null until enough attempts are used, or if unknown. */
  genre: string | null;
  /** The answer's release year — null until enough attempts are used. */
  year: number | null;
}

/** Result of submitting a guess or a skip to the server. */
export interface TurnResult {
  correct: boolean;
  /** Wrong song, but the guessed track shares the answer's artist. */
  artistMatch: boolean;
  gameOver: boolean;
  answer: Answer | null;
  /** Clues unlocked so far — see HINT_GENRE_AFTER / HINT_YEAR_AFTER. */
  hint: Hint;
}

/** Endless-mode sub-mode: whole library, Hebrew, a genre, an artist, etc. */
export type EndlessFilter =
  | { kind: "all" }
  | { kind: "hebrew" }
  | { kind: "genre"; genre: string }
  | { kind: "hebrew_genre"; genre: string }
  | { kind: "artist"; artist: string }
  | { kind: "decade"; decade: number };

/** Available Endless sub-modes, for the mode picker. */
export interface EndlessModes {
  hebrew: number;
  genres: { genre: string; n: number }[];
  hebrewGenres: { genre: string; n: number }[];
  artists: { artist: string; n: number }[];
  decades: { decade: number; n: number }[];
}

/** One past daily puzzle, listed in the archive. */
export interface ArchiveEntry {
  day: number;
  date: string;
}

/** One Lyrics-mode round: a window of lyric lines + a sealed answer token. */
export interface LyricsRound {
  /** Lyric lines, revealed one more per wrong guess. */
  lines: string[];
  /** Opaque encrypted token binding this round to its answer. */
  token: string;
}

/** One player's result row — used by both the friend leaderboard and duels. */
export interface ResultRow {
  playerId: string;
  name: string;
  won: boolean;
  guesses: number;
}

// ---------------------------------------------------------------------------
// Party Mode
// ---------------------------------------------------------------------------
export type RoomStatus = "waiting" | "playing" | "finished";

/** One multiple-choice option (correct flag is never sent to clients). */
export interface PartyOption {
  id: string;
  artist: string;
  title: string;
}

export interface PartyPlayer {
  id: string;
  name: string;
  score: number;
  /** Consecutive correct answers (for streak bonuses). */
  streak: number;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  rank: number;
  /** Consecutive correct answers. */
  streak: number;
}

/** START_ROUND payload — audio + 4 options, never which one is correct. */
export interface PartyRound {
  round: number;
  maxRounds: number;
  options: PartyOption[];
  audio: ClientTrack;
  startedAt: number; // server epoch ms
  /** Length of this round's answer window + clip, in ms (host-configurable). */
  roundMs: number;
}

/** END_ROUND / GAME_OVER payload — the reveal once the round has closed. */
export interface RoundReveal {
  round: number;
  correctOptionId: string;
  answer: Answer;
  leaderboard: LeaderboardEntry[];
  gameOver: boolean;
  /** How many players picked each option id, for the answer breakdown. */
  optionCounts: Record<string, number>;
}

/** A floating emoji reaction flung into the room by a player. */
export interface PartyReaction {
  /** Client-assigned id, just for the React key + expiry. */
  id: number;
  emoji: string;
  name: string;
}

/** Snapshot from getRoomState for refresh / late-join. */
export interface RoomSnapshot {
  status: RoomStatus;
  currentRound: number;
  maxRounds: number;
  roster: PartyPlayer[];
}

export type PartyEventName =
  | "PLAYER_JOINED"
  | "START_ROUND"
  | "PLAYER_ANSWERED"
  | "END_ROUND"
  | "REACTION";
