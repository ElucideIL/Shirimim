"use client";

import { useEffect } from "react";
import { PARTY_ROUND_MS } from "@/lib/constants";
import { useAudioEngine } from "@/lib/audioEngine";
import type { ClientTrack } from "@/lib/types";

interface Props {
  track: ClientTrack;
  /** When true, this device stays silent (host always plays; players opt in). */
  muted: boolean;
}

/**
 * Plays one Party round's 15-second clip. Mount it with a per-round React key
 * so each round gets a fresh audio backend. Renders nothing — the YouTube
 * player lives in the permanent layout-level host (see audioEngine).
 */
export function RoundAudio({ track, muted }: Props) {
  const { isReady, playSegment, stop } = useAudioEngine(track);

  useEffect(() => {
    if (muted) {
      stop();
      return;
    }
    if (isReady) playSegment(PARTY_ROUND_MS);
  }, [muted, isReady, playSegment, stop]);

  return null;
}
