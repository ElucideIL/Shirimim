"use client";

import { useEffect } from "react";
import { useAudioEngine } from "@/lib/audioEngine";
import type { ClientTrack } from "@/lib/types";

interface Props {
  track: ClientTrack;
  /** When true, this device stays silent (host always plays; players opt in). */
  muted: boolean;
  /** Length of the clip to play, in ms (the host-configured round length). */
  durationMs: number;
}

/**
 * Plays one Party round's clip. Mount it with a per-round React key so each
 * round gets a fresh audio backend. Renders nothing — the YouTube player lives
 * in the permanent layout-level host (see audioEngine).
 */
export function RoundAudio({ track, muted, durationMs }: Props) {
  const { isReady, playSegment, stop } = useAudioEngine(track);

  useEffect(() => {
    if (muted) {
      stop();
      return;
    }
    if (isReady) playSegment(durationMs);
  }, [muted, isReady, playSegment, stop, durationMs]);

  return null;
}
