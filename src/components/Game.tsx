"use client";

import { resolveTurn } from "@/actions/guess";
import { buildShareText } from "@/lib/share";
import type { ClientTrack, TurnInput } from "@/lib/types";
import { EndModal } from "./EndModal";
import { GameBoard } from "./GameBoard";
import { MidnightCountdown } from "./MidnightCountdown";

interface Props {
  dayNumber: number;
  track: ClientTrack;
}

/** Daily mode: today's locked-in song, one play per day, midnight countdown. */
export function Game({ dayNumber, track }: Props) {
  return (
    <GameBoard
      track={track}
      headerLabel={`#${dayNumber}`}
      navHref="/endless"
      navLabel="Endless"
      persistKey={`shirimim:day:${dayNumber}`}
      onTurn={(input: TurnInput) => resolveTurn(input)}
      renderEnd={({ won, answer, guesses, close }) => (
        <EndModal
          won={won}
          answer={answer}
          guesses={guesses}
          shareText={buildShareText(dayNumber, guesses, won)}
          footer={<MidnightCountdown />}
          onClose={close}
        />
      )}
    />
  );
}
