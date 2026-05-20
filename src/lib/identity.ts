// Honor-system player identity for the friend leaderboard and duels.
// A stable per-browser id plus an editable display name, both in localStorage.
// Client-only — every function here touches localStorage.

const PID_KEY = "shirimim:pid";
const NAME_KEY = "shirimim:name";

/** The maximum display-name length (also enforced server-side). */
export const MAX_NAME_LENGTH = 24;

/** Stable per-browser id, generated once and reused. */
export function getPlayerId(): string {
  let id = localStorage.getItem(PID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PID_KEY, id);
  }
  return id;
}

/** The player's chosen display name, or "" if they haven't picked one. */
export function getPlayerName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

/** Store a display name (trimmed and length-capped). */
export function setPlayerName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, MAX_NAME_LENGTH));
}
