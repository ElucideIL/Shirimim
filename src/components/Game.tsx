"use client";

import Link from "next/link";
import { resolveTurn } from "@/actions/guess";
import { buildShareText } from "@/lib/share";
import type { ClientTrack, TurnInput } from "@/lib/types";
import { EndModal } from "./EndModal";
import { GameBoard } from "./GameBoard";
import { MidnightCountdown } from "./MidnightCountdown";

interface Props {
  dayNumber: number;
  track: ClientTrack;
  /** True when replaying a past puzzle from the archive. */
  archived?: boolean;
}

/** Daily mode: a locked-in song for one day. `archived` replays a past day. */
export function Game({ dayNumber, track, archived = false }: Props) {
  return (
    <GameBoard
      track={track}
      headerLabel={archived ? `#${dayNumber} · archive` : `#${dayNumber}`}
      navHref="/endless"
      navLabel="Endless"
      persistKey={`shirimim:day:${dayNumber}`}
      onTurn={(input: TurnInput) => resolveTurn(input, dayNumber)}
      renderEnd={({ won, answer, guesses, close }) => (
        <EndModal
          won={won}
          answer={answer}
          guesses={guesses}
          shareText={buildShareText(dayNumber, guesses, won)}
          footer={
            archived ? (
              <Link
                href="/archive"
                className="text-xs text-emerald-400 hover:underline"
              >
                More from the archive
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <MidnightCountdown />
                <Link
                  href="/duel"
                  className="text-xs text-emerald-400 hover:underline"
                >
                  Challenge a friend to a duel →
                </Link>
              </div>
            )
          }
          onClose={close}
        />
      )}
    />
  );
}
