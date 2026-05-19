import { GAME_TZ } from "./constants";

/** Milliseconds remaining until the next midnight in the game timezone. */
export function msUntilNextMidnight(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GAME_TZ,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const get = (t: string) =>
    parseInt(parts.find((p) => p.type === t)!.value, 10);

  const elapsed =
    (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000 +
    now.getMilliseconds();
  return 86_400_000 - elapsed;
}

/** Format a millisecond duration as "HH:MM:SS". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    pad(Math.floor(total / 3600)),
    pad(Math.floor((total % 3600) / 60)),
    pad(total % 60),
  ].join(":");
}
