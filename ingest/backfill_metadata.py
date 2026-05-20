#!/usr/bin/env python3
"""
Shirimim - backfill genre + release_year on tracks that are missing them.

YouTube-sourced tracks carry no genre (it is an iTunes-only field), and until
this script runs no track has a release_year. Resolution runs cheapest tier
first:

  Tier 0 (free, instant): canonicalize every existing genre via genre_rules
          (folds "Hard Rock" into "Rock", "Rap" into "Hip-Hop/Rap", etc.).
  Tier 1 (genre, free, instant): for every track missing a genre, copy the
          most common genre used by other tracks from the same artist.
  Tier 2 (genre + year, free, rate-limited): re-query the iTunes Search API
          for metadata only. Ingestion needs a playable preview and rejects
          remixes; for genre/year we need neither - even a preview-less or
          remix catalog hit carries the right genre and release year.

Whatever iTunes still cannot resolve is left NULL: the Endless genre picker
hides genres under its size threshold and the Party distractor cascade
already tolerates a NULL genre.

Resumable: Tier 2 progress is checkpointed to genre_backfill_state.json after
every track, so a crash or rate-limit just means re-running the script.

Usage:
    python backfill_metadata.py
    python backfill_metadata.py --reset            # ignore the checkpoint
    python backfill_metadata.py --normalize-only   # just re-run Tier 0
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import create_client

from genre_rules import canonical_genre, is_mizrahi_artist
from ingest import (
    ITUNES_COUNTRY,
    ITUNES_DELAY,
    ITUNES_ENDPOINT,
    _year_from,
    artist_matches,
    clean,
    is_alternate_version,
    title_relevant,
)

HERE = Path(__file__).resolve().parent
STATE_FILE = HERE / "genre_backfill_state.json"


# ---------------------------------------------------------------------------
# iTunes metadata-only lookup
# ---------------------------------------------------------------------------
def itunes_metadata(artist: str, title: str) -> dict:
    """Genre + release year for a track. Metadata only - no preview required,
    no remix filter. Returns {'genre': str|None, 'year': int|None}."""
    params = {
        "term": f"{artist} {title}",
        "media": "music",
        "entity": "song",
        "limit": 12,
        "country": ITUNES_COUNTRY,
    }
    resp = requests.get(
        ITUNES_ENDPOINT, params=params, timeout=20,
        headers={"User-Agent": "songless-ingest/1.0"},
    )
    resp.raise_for_status()

    matches = [
        r for r in resp.json().get("results", [])
        if artist_matches(artist, r.get("artistName", ""))
        and title_relevant(r.get("trackName") or "", title)
    ]
    if not matches:
        return {"genre": None, "year": None}

    # Prefer an original recording so the year is the song's own release.
    originals = [
        r for r in matches
        if not is_alternate_version(r.get("trackName") or "", title)
    ]
    r = (originals or matches)[0]
    return {
        "genre": canonical_genre(clean(r.get("primaryGenreName"))),
        "year": _year_from(r.get("releaseDate")),
    }


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------
def fetch_all_tracks(supabase) -> list[dict]:
    """Page through the whole tracks table (a Supabase select caps at 1000)."""
    rows: list[dict] = []
    page = 0
    while True:
        chunk = (
            supabase.table("tracks")
            .select("id,artist,title,genre,release_year")
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
    p = argparse.ArgumentParser(description="Backfill genre + release_year")
    p.add_argument("--reset", action="store_true",
                   help="ignore the checkpoint and redo every iTunes lookup")
    p.add_argument("--normalize-only", action="store_true",
                   help="only canonicalize existing genres (Tier 0), then exit")
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
            "Missing credentials. Fill SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY in ingest/.env."
        )
    supabase = create_client(url, key)

    tracks = fetch_all_tracks(supabase)
    print(f"Loaded {len(tracks)} tracks.\n")

    # --- Tier 0: canonicalize existing genres ------------------------------
    tier0 = 0
    for t in tracks:
        g = t.get("genre")
        if g:
            canon = canonical_genre(g)
            if canon != g:
                supabase.table("tracks").update({"genre": canon}).eq(
                    "id", t["id"]
                ).execute()
                t["genre"] = canon
                tier0 += 1
    print(f"Tier 0 (normalize genres): updated {tier0} genres.\n")

    # --- Tier 0.5: tag tracks by known Mizrahi artists ---------------------
    mizrahi = 0
    for t in tracks:
        if is_mizrahi_artist(t["artist"]) and t.get("genre") != "Mizrahi":
            supabase.table("tracks").update({"genre": "Mizrahi"}).eq(
                "id", t["id"]
            ).execute()
            t["genre"] = "Mizrahi"
            mizrahi += 1
    print(f"Tier 0.5 (Mizrahi tagging): tagged {mizrahi} tracks.\n")

    if args.normalize_only:
        print("Done (normalize-only).")
        return

    # --- Tier 1: propagate genre from same-artist tracks --------------------
    by_artist: dict[str, Counter] = {}
    for t in tracks:
        if t.get("genre"):
            by_artist.setdefault(t["artist"].lower(), Counter())[t["genre"]] += 1
    artist_genre = {a: c.most_common(1)[0][0] for a, c in by_artist.items()}

    tier1 = 0
    for t in tracks:
        if not t.get("genre"):
            g = artist_genre.get(t["artist"].lower())
            if g:
                supabase.table("tracks").update({"genre": g}).eq("id", t["id"]).execute()
                t["genre"] = g
                tier1 += 1
    print(f"Tier 1 (artist propagation): filled {tier1} genres.\n")

    # --- Tier 2: iTunes metadata re-lookup ---------------------------------
    worklist = sorted(
        (t for t in tracks if not t.get("genre") or not t.get("release_year")),
        key=lambda t: t["id"],
    )
    done = set() if args.reset else load_state()
    pending = [t for t in worklist if t["id"] not in done]
    print(f"Tier 2: {len(pending)} tracks need an iTunes lookup "
          f"({len(done)} already done).\n")

    stats = {"genre": 0, "year": 0, "miss": 0}
    last_call = 0.0
    try:
        for i, t in enumerate(pending):
            wait = ITUNES_DELAY - (time.time() - last_call)
            if wait > 0:
                time.sleep(wait)
            print(f"[{i + 1}/{len(pending)}] {t['artist']} - {t['title']}")
            try:
                meta = itunes_metadata(t["artist"], t["title"])
            except Exception as e:
                print(f"  iTunes error: {e}")
                meta = {"genre": None, "year": None}
            finally:
                last_call = time.time()

            update = {}
            if not t.get("genre") and meta["genre"]:
                update["genre"] = meta["genre"]
                stats["genre"] += 1
            if not t.get("release_year") and meta["year"]:
                update["release_year"] = meta["year"]
                stats["year"] += 1
            if update:
                supabase.table("tracks").update(update).eq("id", t["id"]).execute()
                print(f"  -> {update}")
            else:
                stats["miss"] += 1
                print("  -> nothing found")

            done.add(t["id"])
            save_state(done)
    except KeyboardInterrupt:
        print("\nInterrupted - progress saved.")
        save_state(done)

    print(f"\nDone. Tier 1 genres={tier1}  Tier 2 genres={stats['genre']}  "
          f"years={stats['year']}  unresolved={stats['miss']}")


if __name__ == "__main__":
    main()
