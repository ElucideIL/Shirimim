"use client";

import { PARTY_REACTIONS } from "@/lib/constants";
import type { PartyReaction } from "@/lib/types";

/** The row of emoji a player can fling into the room. */
export function ReactionBar({
  onReact,
  disabled,
}: {
  onReact: (emoji: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-center gap-2">
      {PARTY_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={disabled}
          onClick={() => onReact(emoji)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-lg transition hover:bg-white/10 active:scale-90 disabled:opacity-30"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** The floating reactions everyone in the room sees pop up. */
export function ReactionOverlay({ reactions }: { reactions: PartyReaction[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-40 flex flex-col-reverse items-center gap-1">
      {reactions.map((r) => (
        <div
          key={r.id}
          style={{ animation: "float-up 3.4s ease-out forwards" }}
          className="flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1 backdrop-blur"
        >
          <span className="text-xl">{r.emoji}</span>
          <span className="text-xs font-medium text-white/80">{r.name}</span>
        </div>
      ))}
    </div>
  );
}
