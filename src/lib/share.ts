import { MAX_ATTEMPTS } from "./constants";
import type { GuessRow } from "./types";

/**
 * Build the spoiler-free emoji result grid for sharing, e.g.:
 *
 *   Shirimim #12 3/5
 *   🔊 🟥 🟥 🟩 ⬜ ⬜
 *
 * Pass `dayNumber: null` for Endless mode (no puzzle number).
 */
export function buildShareText(
  dayNumber: number | null,
  guesses: GuessRow[],
  won: boolean,
): string {
  const squares: string[] = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const g = guesses[i];
    if (!g) squares.push("⬜");
    else if (g.outcome === "correct") squares.push("🟩");
    else squares.push("🟥"); // wrong or skipped
  }
  const header = dayNumber === null ? "Shirimim" : `Shirimim #${dayNumber}`;
  const score = won ? `${guesses.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
  return `${header} ${score}\n🔊 ${squares.join(" ")}`;
}
