"use client";

import { useEffect } from "react";
import { PARTY_ROUND_MS } from "@/lib/constants";
import { useAudioEngine, YT_HOST_ID } from "@/lib/audioEngine";
import type { ClientTrack } from "@/lib/types";

interface Props {
  track: ClientTrack;
  /** When true, this device stays silent (host always plays; players opt in). */
  muted: boolean;
}

/**
 * Plays one Party round's 15-second clip. Mount it with a per-round React key
 * so each round gets a fresh audio backend.
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

  if (track.source !== "youtube") return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-[-9999px] h-[200px] w-[200px] overflow-hidden"
    >
      <div id={YT_HOST_ID} />
    </div>
  );
}
