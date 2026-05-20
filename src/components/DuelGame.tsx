"use client";

import { resolveDuelTurn } from "@/actions/duel";
import type { ClientTrack, TurnInput } from "@/lib/types";
import { DuelEndModal } from "./DuelEndModal";
import { GameBoard } from "./GameBoard";

/** Duel mode: one fixed song, shared with a friend via a link. */
export function DuelGame({
  duelId,
  track,
}: {
  duelId: string;
  track: ClientTrack;
}) {
  return (
    <GameBoard
      track={track}
      headerLabel="Duel"
      navHref="/"
      navLabel="Daily"
      persistKey={`shirimim:duel:${duelId}`}
      onTurn={(input: TurnInput) => resolveDuelTurn(input, duelId)}
      renderEnd={({ won, answer, guesses, close }) => (
        <DuelEndModal
          duelId={duelId}
          won={won}
          answer={answer}
          guesses={guesses}
          onClose={close}
        />
      )}
    />
  );
}
