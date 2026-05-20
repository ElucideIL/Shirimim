#!/usr/bin/env python3
"""
Shirimim - fetch song lyrics for Lyrics mode.

Lyrics mode shows a song's lyrics line by line instead of playing audio. This
script pulls each track's lyrics from the free lyrics.ovh API and caches them
in tracks.lyrics. A track with no lyrics hit is simply left NULL - the Lyrics
mode RPC only ever picks tracks that already have lyrics.

lyrics.ovh needs no API key and has no hard quota, but it is a community
service: be polite (a short delay between calls) and expect spotty coverage,
especially for non-English titles.

Resumable: progress is checkpointed to lyrics_fetch_state.json after every
track. A definite miss (no lyrics found) is recorded so it is not retried; a
transient failure (timeout, rate-limit) is left pending so re-running retries it.

Usage:
    python fetch_lyrics.py
    python fetch_lyrics.py --reset    # re-fetch every track
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from supabase import create_client

HERE = Path(__file__).resolve().parent
STATE_FILE = HERE / "lyrics_fetch_state.json"

LYRICS_API = "https://api.lyrics.ovh/v1"
FETCH_DELAY = 0.4   # seconds between calls (politeness)


class RetryLater(Exception):
    """Raised on a transient failure — the track stays pending for a re-run."""


# ---------------------------------------------------------------------------
# Matching helpers — lyrics.ovh matches best on a bare "artist/title"
# ---------------------------------------------------------------------------
_FEAT = re.compile(r"\s*(?:feat\.?|ft\.?|featuring|with)\s.*$", re.IGNORECASE)
_PARENS = re.compile(r"\s*[\(\[][^\)\]]*[\)\]]\s*")


def clean_artist(artist: str) -> str:
    """Drop featured-artist credits and collaborators for a cleaner lookup."""
    a = _FEAT.sub("", artist)
    a = re.split(r"\s*(?:&|,|/| x | vs\.? )\s*", a, maxsplit=1)[0]
    return a.strip()


def clean_title(title: str) -> str:
    """Drop "(feat. …)", "(Remastered)", "(Live)" and similar title noise."""
    t = _PARENS.sub(" ", title)
    t = _FEAT.sub("", t)
    return t.strip()


# ---------------------------------------------------------------------------
# Lyrics fetch
# ---------------------------------------------------------------------------
def fetch_lyrics(artist: str, title: str) -> str | None:
    """Lyrics for one song, or None if none exist. Raises RetryLater on a
    transient failure (timeout, rate-limit, server error)."""
    url = f"{LYRICS_API}/{quote(artist)}/{quote(title)}"
    try:
        r = requests.get(
            url, timeout=20,
            headers={"User-Agent": "songless-ingest/1.0"},
        )
    except requests.RequestException as e:
        raise RetryLater(str(e)) from e

    if r.status_code == 404:
        return None  # definite miss
    if r.status_code == 429 or r.status_code >= 500:
        raise RetryLater(f"HTTP {r.status_code}")
    if r.status_code != 200:
        return None

    try:
        body = r.json()
    except ValueError:
        return None
    lyrics = body.get("lyrics")
    if isinstance(lyrics, str) and lyrics.strip():
        return lyrics.strip()
    return None


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
            .select("id, artist, title, lyrics")
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
    p = argparse.ArgumentParser(description="Fetch song lyrics for Lyrics mode")
    p.add_argument("--reset", action="store_true",
                   help="ignore the checkpoint and re-fetch every track")
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
    pending = [t for t in tracks if t["id"] not in done and not t.get("lyrics")]
    print(f"{len(tracks)} tracks, {len(pending)} to look up "
          f"({len(done)} already done).\n")

    stats = {"found": 0, "miss": 0, "retry": 0}
    try:
        for i, t in enumerate(pending):
            label = f"[{i + 1}/{len(pending)}] {t['artist']} - {t['title']}"
            artist = clean_artist(t["artist"])
            title = clean_title(t["title"])
            try:
                lyrics = fetch_lyrics(artist, title)
            except RetryLater as e:
                stats["retry"] += 1
                print(f"{label} -> retry later ({e})")
                time.sleep(2.0)
                continue

            if lyrics:
                supabase.table("tracks").update(
                    {"lyrics": lyrics}
                ).eq("id", t["id"]).execute()
                stats["found"] += 1
                print(f"{label} -> {len(lyrics.splitlines())} lines")
            else:
                stats["miss"] += 1
                print(f"{label} -> no lyrics")

            done.add(t["id"])
            save_state(done)
            time.sleep(FETCH_DELAY)
    except KeyboardInterrupt:
        print("\nInterrupted - progress saved.")
        save_state(done)

    print(f"\nDone. found={stats['found']}  miss={stats['miss']}  "
          f"retry={stats['retry']}")


if __name__ == "__main__":
    main()
