#!/usr/bin/env python3
"""
Shirimim - auto-detect each track's quiet intro and set start_offset_ms.

Many tracks (especially YouTube-sourced videos that open with a label logo or
an ambient build-up) are near-silent for the first several seconds, so the
short snippets play nothing. This grabs the opening of each track's audio, runs
ffmpeg's silencedetect filter to find where audible sound begins, and writes
that into tracks.start_offset_ms so playback skips the dead air.

ffmpeg is provided by the imageio-ffmpeg package - no system install needed.

Resumable: progress is checkpointed to offset_detect_state.json after every
track, so a crash or rate-limit just means re-running the script.

Usage:
    python detect_offsets.py
    python detect_offsets.py --reset    # re-analyse every track
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import imageio_ffmpeg
import requests
from dotenv import load_dotenv
from supabase import create_client

try:
    import yt_dlp
except ImportError:
    yt_dlp = None

HERE = Path(__file__).resolve().parent
STATE_FILE = HERE / "offset_detect_state.json"

# Silence-detection tuning.
SILENCE_NOISE = "-25dB"      # audio fainter than this counts as "nothing playing"
SILENCE_MIN_DUR = "0.4"      # ...sustained for at least this many seconds
LEADING_TOLERANCE_S = 0.4    # a silence is "leading" only if it starts this near 0:00
MIN_OFFSET_MS = 1500         # ignore trivial lead-ins shorter than this
MAX_OFFSET_MS = 12000        # never skip more than this (likely a broken track)
YT_DELAY = 1.5               # pause between YouTube downloads (politeness)

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


# ---------------------------------------------------------------------------
# Audio analysis
# ---------------------------------------------------------------------------
def leading_silence_ms(audio_path: Path) -> int:
    """Milliseconds of near-silence at the very start of the audio file."""
    proc = subprocess.run(
        [FFMPEG, "-hide_banner", "-nostats", "-i", str(audio_path),
         "-af", f"silencedetect=noise={SILENCE_NOISE}:d={SILENCE_MIN_DUR}",
         "-f", "null", "-"],
        capture_output=True, text=True, timeout=90,
    )
    log = proc.stderr or ""
    starts = re.findall(r"silence_start:\s*(-?[\d.]+)", log)
    ends = re.findall(r"silence_end:\s*(-?[\d.]+)", log)
    if not starts or not ends:
        return 0
    # Only a silence that begins at (or just after) 0:00 is a quiet intro.
    if float(starts[0]) > LEADING_TOLERANCE_S:
        return 0
    return max(0, int(round(float(ends[0]) * 1000)))


def fetch_itunes(preview_url: str, dest: Path) -> bool:
    """Download an iTunes preview clip to dest. Returns True on success."""
    r = requests.get(
        preview_url, timeout=30,
        headers={"User-Agent": "songless-ingest/1.0"},
    )
    r.raise_for_status()
    dest.write_bytes(r.content)
    return dest.stat().st_size > 0


def fetch_youtube(youtube_id: str, dest_dir: Path) -> Path | None:
    """Download the lowest-quality audio for a YouTube id. Returns the file."""
    if yt_dlp is None:
        return None
    opts = {
        "quiet": True, "no_warnings": True, "noplaylist": True,
        "format": "worstaudio/bestaudio/worst",
        "outtmpl": str(dest_dir / "yt.%(ext)s"),
        "socket_timeout": 30,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={youtube_id}"])
    files = list(dest_dir.glob("yt.*"))
    return files[0] if files else None


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------
def fetch_all_tracks(supabase) -> list[dict]:
    """Page through the whole tracks table (a Supabase select caps at 1000)."""
    rows: list[dict] = []
    page = 0
    while True:
        chunk = (
            supabase.table("tracks")
            .select("id, artist, title, source, preview_url, youtube_id, start_offset_ms")
            .range(page * 1000, page * 1000 + 999)
            .execute()
            .data
        )
        rows.extend(chunk)
        if len(chunk) < 1000:
            return rows
        page += 1


def load_state() -> set:
    if not STATE_FILE.exists():
        return set()
    try:
        return set(json.loads(STATE_FILE.read_text()).get("done", []))
    except Exception:
        return set()


def save_state(done: set):
    STATE_FILE.write_text(json.dumps({"done": sorted(done)}))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def parse_args():
    p = argparse.ArgumentParser(
        description="Auto-detect quiet intros and set start_offset_ms"
    )
    p.add_argument("--reset", action="store_true",
                   help="ignore the checkpoint and re-analyse every track")
    return p.parse_args()


def main():
    args = parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    load_dotenv(HERE / ".env")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(
            "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ingest/.env"
        )
    supabase = create_client(url, key)

    tracks = fetch_all_tracks(supabase)
    done = set() if args.reset else load_state()
    pending = [t for t in tracks if t["id"] not in done]
    print(f"{len(tracks)} tracks, {len(pending)} to analyse "
          f"({len(done)} already done).\n")

    stats = {"offset": 0, "clean": 0, "fail": 0}
    last_yt = 0.0
    try:
        for i, t in enumerate(pending):
            label = f"[{i + 1}/{len(pending)}] {t['artist']} - {t['title']}"
            with tempfile.TemporaryDirectory() as tmp:
                tmpdir = Path(tmp)
                try:
                    audio: Path | None = None
                    if t["source"] == "itunes" and t["preview_url"]:
                        clip = tmpdir / "itunes_clip"
                        if fetch_itunes(t["preview_url"], clip):
                            audio = clip
                    elif t["source"] == "youtube" and t["youtube_id"]:
                        wait = YT_DELAY - (time.time() - last_yt)
                        if wait > 0:
                            time.sleep(wait)
                        audio = fetch_youtube(t["youtube_id"], tmpdir)
                        last_yt = time.time()

                    if audio is None:
                        stats["fail"] += 1
                        print(f"{label} -> no audio")
                        continue

                    sil = leading_silence_ms(audio)
                    offset = sil if MIN_OFFSET_MS <= sil <= MAX_OFFSET_MS else 0

                    if offset != (t["start_offset_ms"] or 0):
                        supabase.table("tracks").update(
                            {"start_offset_ms": offset}
                        ).eq("id", t["id"]).execute()
                    if offset:
                        stats["offset"] += 1
                        print(f"{label} -> offset {offset} ms")
                    else:
                        stats["clean"] += 1
                        print(f"{label} -> clean")
                except Exception as e:
                    stats["fail"] += 1
                    print(f"{label} -> error: {e}")
            done.add(t["id"])
            save_state(done)
    except KeyboardInterrupt:
        print("\nInterrupted - progress saved.")
        save_state(done)

    print(f"\nDone. offsets set={stats['offset']}  clean={stats['clean']}  "
          f"failed={stats['fail']}")


if __name__ == "__main__":
    main()
