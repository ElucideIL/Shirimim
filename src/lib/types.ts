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
}

/** Only the fields safe to send to the browser before the game ends. */
export interface ClientTrack {
  source: AudioSource;
  previewUrl: string | null;
  youtubeId: string | null;
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

export type GuessOutcome = "correct" | "wrong" | "skipped";

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

/** Result of submitting a guess or a skip to the server. */
export interface TurnResult {
  correct: boolean;
  gameOver: boolean;
  answer: Answer | null;
}
