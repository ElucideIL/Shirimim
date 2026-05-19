"use client";

import { useEffect, useState } from "react";
import { getRoomState } from "@/actions/party";
import { getBrowserClient } from "./supabaseBrowser";
import type {
  PartyPlayer,
  PartyRound,
  RoundReveal,
} from "./types";

export type PartyPhase = "lobby" | "round" | "reveal" | "finished";

export interface PartyRoomState {
  connected: boolean;
  roster: PartyPlayer[];
  round: PartyRound | null;
  reveal: RoundReveal | null;
  answeredCount: number;
  phase: PartyPhase;
}

/**
 * Subscribes to a room's public Realtime Broadcast channel and reduces the
 * authoritative server events into game state. Receive-only — all mutations
 * go through the party server actions.
 */
export function usePartyRoom(code: string): PartyRoomState {
  const [connected, setConnected] = useState(false);
  const [roster, setRoster] = useState<PartyPlayer[]>([]);
  const [round, setRound] = useState<PartyRound | null>(null);
  const [reveal, setReveal] = useState<RoundReveal | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase.channel(`room:${code}`);

    channel
      .on("broadcast", { event: "PLAYER_JOINED" }, ({ payload }) => {
        setRoster((payload?.roster ?? []) as PartyPlayer[]);
      })
      .on("broadcast", { event: "START_ROUND" }, ({ payload }) => {
        setRound(payload as PartyRound);
        setReveal(null);
        setAnsweredCount(0);
      })
      .on("broadcast", { event: "PLAYER_ANSWERED" }, ({ payload }) => {
        setAnsweredCount((payload?.answeredCount ?? 0) as number);
      })
      .on("broadcast", { event: "END_ROUND" }, ({ payload }) => {
        const rev = payload as RoundReveal;
        setReveal(rev);
        // The reveal's leaderboard is the authoritative roster + scores.
        setRoster(
          rev.leaderboard.map((e) => ({
            id: e.playerId,
            name: e.name,
            score: e.score,
          })),
        );
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    // Seed the roster for anyone who loads after others have joined.
    getRoomState(code)
      .then((snap) => {
        if (snap) setRoster((prev) => (prev.length ? prev : snap.roster));
      })
      .catch(() => {
        /* non-fatal */
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  let phase: PartyPhase = "lobby";
  if (reveal?.gameOver) phase = "finished";
  else if (reveal && round && reveal.round === round.round) phase = "reveal";
  else if (round) phase = "round";

  return { connected, roster, round, reveal, answeredCount, phase };
}
