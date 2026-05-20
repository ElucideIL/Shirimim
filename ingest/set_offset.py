#!/usr/bin/env python3
"""
Shirimim - set a per-track start offset.

Some songs (often YouTube-sourced videos with a long intro) are quiet for the
first few seconds, so the short snippets play near-silence. This skips that dead
air for one track, so playback starts where the music actually kicks in.

Usage:
    python set_offset.py "<artist>" "<title>" <seconds>
    python set_offset.py "Coldplay" "Yellow" 7      # skip the first 7 seconds
    python set_offset.py "Coldplay" "Yellow" 0      # reset back to the start

The artist/title are matched loosely (case-insensitive substring); if more than
one track matches, it lists them so you can be more specific.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

HERE = Path(__file__).resolve().parent


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    if len(sys.argv) != 4:
        raise SystemExit(
            'Usage: python set_offset.py "<artist>" "<title>" <seconds>'
        )
    artist, title, seconds = sys.argv[1], sys.argv[2], sys.argv[3]
    try:
        offset_ms = int(round(float(seconds) * 1000))
    except ValueError:
        raise SystemExit(f"Not a number of seconds: {seconds!r}")
    if offset_ms < 0:
        raise SystemExit("Seconds must be 0 or more.")

    load_dotenv(HERE / ".env")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(
            "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ingest/.env"
        )
    supabase = create_client(url, key)

    matches = (
        supabase.table("tracks")
        .select("id, artist, title, source, start_offset_ms")
        .ilike("artist", f"%{artist}%")
        .ilike("title", f"%{title}%")
        .execute()
        .data
    )
    if not matches:
        raise SystemExit(
            f"No track matches artist ~ {artist!r} and title ~ {title!r}."
        )
    if len(matches) > 1:
        print(f"{len(matches)} tracks match — narrow it down:")
        for m in matches:
            print(f"  [{m['source']}] {m['artist']} - {m['title']}")
        raise SystemExit(1)

    t = matches[0]
    supabase.table("tracks").update({"start_offset_ms": offset_ms}).eq(
        "id", t["id"]
    ).execute()
    print(
        f"{t['artist']} - {t['title']}: start offset "
        f"{t['start_offset_ms']} ms -> {offset_ms} ms."
    )


if __name__ == "__main__":
    main()
