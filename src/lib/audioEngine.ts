"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientTrack } from "./types";

// ---------------------------------------------------------------------------
// Minimal YouTube IFrame API typings (only what this engine uses)
// ---------------------------------------------------------------------------
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
}
interface YTPlayerEvent {
  data: number;
  target: YTPlayer;
}
interface YTNamespace {
  Player: new (
    el: string | HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (e: YTPlayerEvent) => void;
        onStateChange?: (e: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** DOM id of the off-screen host div the YouTube player mounts into. */
export const YT_HOST_ID = "yt-player-host";

let ytApiPromise: Promise<YTNamespace> | null = null;

/** Load the YouTube IFrame API once and resolve when it is ready. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<YTNamespace>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT as YTNamespace);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

export interface AudioEngine {
  /** True once the backend can play. */
  isReady: boolean;
  /** True while audio is actually sounding. */
  isPlaying: boolean;
  /** Current playhead position within the clip, in ms. */
  positionMs: number;
  /** Play from 0; auto-stops at `capMs` and parks the playhead there. */
  playSegment: (capMs: number) => void;
  /** Stop immediately and rewind to 0. */
  stop: () => void;
}

/**
 * Drives playback for one track over either backend:
 *   - "itunes"  -> an HTML5 <audio> element fed the 30s preview MP3
 *   - "youtube" -> a hidden YouTube IFrame player
 *
 * The segment cutoff is driven off the real playback position (currentTime),
 * not a setTimeout — so buffering delay never eats into the played seconds.
 */
export function useAudioEngine(track: ClientTrack): AudioEngine {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<YTPlayer | null>(null);

  const capRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Playback is offset by track.startOffsetMs to skip a quiet intro; positions
  // reported to the game are always relative to that offset (0 = clip start).
  const getPositionMs = useCallback((): number => {
    const raw =
      track.source === "itunes"
        ? (audioRef.current?.currentTime ?? 0) * 1000
        : (ytRef.current?.getCurrentTime() ?? 0) * 1000;
    return Math.max(0, raw - track.startOffsetMs);
  }, [track.source, track.startOffsetMs]);

  const rewindBackend = useCallback(() => {
    const offsetSec = track.startOffsetMs / 1000;
    if (track.source === "itunes") {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.currentTime = offsetSec;
      }
    } else {
      const p = ytRef.current;
      if (p) {
        p.pauseVideo();
        p.seekTo(offsetSec, true);
      }
    }
  }, [track.source, track.startOffsetMs]);

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** Hard stop: rewind the playhead all the way back to 0. */
  const stop = useCallback(() => {
    activeRef.current = false;
    cancelRaf();
    rewindBackend();
    setIsPlaying(false);
    setPositionMs(0);
  }, [cancelRaf, rewindBackend]);

  const tick = useCallback(() => {
    if (!activeRef.current) return;
    const t = getPositionMs();
    const cap = capRef.current;
    // An iTunes preview can be shorter than the cap (extended replay) — treat
    // the clip running out the same as hitting the cap.
    const ended =
      track.source === "itunes" && (audioRef.current?.ended ?? false);

    if (t >= cap || ended) {
      // Segment finished: rewind audio, leave the playhead parked at the cap.
      activeRef.current = false;
      cancelRaf();
      rewindBackend();
      setIsPlaying(false);
      setPositionMs(cap);
      return;
    }
    if (t > 0) setIsPlaying(true);
    setPositionMs(t);
    rafRef.current = requestAnimationFrame(tick);
  }, [getPositionMs, cancelRaf, rewindBackend, track.source]);

  const playSegment = useCallback(
    (capMs: number) => {
      capRef.current = capMs;
      activeRef.current = true;
      setPositionMs(0);
      const offsetSec = track.startOffsetMs / 1000;

      if (track.source === "itunes") {
        const a = audioRef.current;
        if (!a) return;
        a.currentTime = offsetSec;
        void a.play().catch(() => {
          /* autoplay/gesture rejection — ignore */
        });
      } else {
        const p = ytRef.current;
        if (!p) return;
        p.seekTo(offsetSec, true);
        p.playVideo();
      }

      cancelRaf();
      rafRef.current = requestAnimationFrame(tick);
    },
    [track.source, track.startOffsetMs, cancelRaf, tick],
  );

  // --- Backend setup -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setIsReady(false);

    if (track.source === "itunes") {
      if (!track.previewUrl) return;
      const audio = new Audio(track.previewUrl);
      audio.preload = "auto";
      audioRef.current = audio;

      const markReady = () => {
        if (!cancelled) setIsReady(true);
      };
      audio.addEventListener("canplay", markReady, { once: true });
      audio.load();
      // Safety net: never leave the Play button permanently disabled.
      const fallback = window.setTimeout(markReady, 5000);

      return () => {
        cancelled = true;
        window.clearTimeout(fallback);
        audio.pause();
        audio.removeEventListener("canplay", markReady);
        audioRef.current = null;
      };
    }

    // YouTube backend. The YT IFrame API REPLACES the element it is handed
    // with an <iframe>. Handing it a React-rendered node makes React crash on
    // unmount ("removeChild: node is not a child") because the node it expects
    // is gone. So we mount the player into our own throwaway child div instead
    // — React only ever owns the stable #yt-player-host wrapper.
    if (!track.youtubeId) return;
    let player: YTPlayer | null = null;
    void loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      const host = document.getElementById(YT_HOST_ID);
      if (!host) return;
      const mount = document.createElement("div");
      host.appendChild(mount);
      player = new YT.Player(mount, {
        videoId: track.youtubeId as string,
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
        events: {
          onReady: () => {
            if (!cancelled) setIsReady(true);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING && !cancelled) {
              setIsPlaying(true);
            }
          },
        },
      });
      ytRef.current = player;
    });

    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        /* noop */
      }
      ytRef.current = null;
    };
  }, [track.source, track.previewUrl, track.youtubeId]);

  // Cancel any pending animation frame on unmount.
  useEffect(() => () => cancelRaf(), [cancelRaf]);

  return { isReady, isPlaying, positionMs, playSegment, stop };
}
