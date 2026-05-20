#!/usr/bin/env python3
"""
Shirimim - hybrid library ingestion.

Reads a CSV of {artist, title}, resolves each track to a playable source
(iTunes 30s preview first, embed-verified YouTube fallback second), and
batch-upserts into the Supabase `tracks` table.

Resumable: progress is checkpointed to progress_state.json after every batch
flush, so a crash or rate-limit just means re-running the script.

Usage:
    python ingest.py seed.csv
    python ingest.py sample_seed.csv          # quick smoke test
    python ingest.py seed.csv --reset         # ignore saved progress
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import random
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import create_client

try:
    import yt_dlp
except ImportError:
    yt_dlp = None

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
PROGRESS_FILE = HERE / "progress_state.json"
UNRESOLVED_FILE = HERE / "unresolved.csv"

ITUNES_ENDPOINT = "https://itunes.apple.com/search"
ITUNES_COUNTRY = "IL"          # Israeli store: strong Hebrew + full global catalog
ITUNES_DELAY = 3.6             # ~16 req/min, safely under iTunes' ~20/min limit
YT_DELAY_MIN = 2.0             # randomized jitter between YouTube searches
YT_DELAY_MAX = 4.5
BATCH_SIZE = 50               # rows per Supabase upsert
MIN_DURATION_S = 60           # reject interludes / skits
MAX_DURATION_S = 12 * 60      # reject mega-mixes / 1-hour loops

YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
COL_AVOID = ("uri", "url", "id", "isrc", "href")

# Alternate-version markers — a guessing game wants the original recording.
# A term is only disqualifying if it is NOT also in the requested title.
BAD_VERSION_TERMS = (
    "remix", "instrumental", "karaoke", "live", "cover", "acoustic",
    "sped up", "spedup", "slowed", "nightcore", "mashup", "8d audio",
    "reverb", "mixed", "re-recorded", "tribute", "loop", "rmx",
)


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------
def clean(text) -> str:
    """Normalize, strip control characters, collapse whitespace."""
    if text is None:
        return ""
    text = unicodedata.normalize("NFKC", str(text))
    text = "".join(ch for ch in text if unicodedata.category(ch)[0] != "C")
    return re.sub(r"\s+", " ", text).strip()


def norm(text: str) -> str:
    """Loose comparison key: lowercase alphanumerics + Hebrew letters only."""
    text = unicodedata.normalize("NFKD", (text or "").lower())
    return re.sub(r"[^a-z0-9֐-׿]", "", text)


def detect_script(text: str) -> str:
    """Classify writing system for distractor matching: hebrew, latin, or other."""
    if re.search(r"[֐-׿]", text or ""):
        return "hebrew"
    if re.search(r"[A-Za-z]", text or ""):
        return "latin"
    return "other"


def _year_from(release_date) -> int | None:
    """Extract a 4-digit year from an iTunes releaseDate (e.g. '2019-06-21T07:00:00Z')."""
    m = re.match(r"\d{4}", str(release_date or ""))
    return int(m.group(0)) if m else None


def artist_matches(query_artist: str, result_artist: str) -> bool:
    """True if either artist string loosely contains the other."""
    a, b = norm(query_artist), norm(result_artist)
    if not a or not b:
        return False
    return a in b or b in a


def title_relevant(result_title: str, query_title: str) -> bool:
    """True if the result's song name overlaps the requested one."""
    r, q = norm(result_title), norm(query_title)
    if not r or not q:
        return False
    return q in r or r in q


def is_alternate_version(result_title: str, query_title: str) -> bool:
    """True if the result is a remix/instrumental/live/etc. the query didn't ask for."""
    rt, qt = result_title.lower(), query_title.lower()
    return any(term in rt and term not in qt for term in BAD_VERSION_TERMS)


# ---------------------------------------------------------------------------
# CSV reading
# ---------------------------------------------------------------------------
def _pick_column(header, must, prefer, avoid):
    """Return the index of the best-matching header column, or None."""
    best_i, best_score = None, -1
    for i, raw in enumerate(header):
        h = raw.strip().lower()
        if not any(m in h for m in must):
            continue
        if any(a in h for a in avoid):
            continue
        score = sum(1 for p in prefer if p in h)
        if score > best_score:
            best_i, best_score = i, score
    return best_i


def detect_columns(header):
    """Find the artist and title column indexes in a CSV header row."""
    artist_idx = _pick_column(
        header, must=("artist",), prefer=("name",), avoid=COL_AVOID
    )
    title_idx = _pick_column(
        header,
        must=("track name", "track title", "title", "song name"),
        prefer=("name", "title"),
        avoid=COL_AVOID + ("album", "artist"),
    )
    if title_idx is None:
        title_idx = _pick_column(
            header, must=("name", "song", "track"),
            prefer=("track", "song"), avoid=COL_AVOID + ("album", "artist"),
        )
    if artist_idx is None or title_idx is None:
        raise SystemExit(
            f"Could not detect artist/title columns. Header was: {header}"
        )
    return artist_idx, title_idx


def read_csv(path: Path):
    """Return a list of (artist, title) tuples from the CSV."""
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            raise SystemExit("CSV file is empty.")
        a_idx, t_idx = detect_columns(header)
        print(f"Detected columns -> artist: '{header[a_idx]}'  title: '{header[t_idx]}'")
        for raw in reader:
            if len(raw) <= max(a_idx, t_idx):
                continue
            artist = clean(raw[a_idx])
            title = clean(raw[t_idx])
            # Exportify joins multiple artists with ";" - keep the primary one.
            # (Split only on ";", never "," — names like "Tyler, The Creator".)
            if ";" in artist:
                artist = artist.split(";")[0].strip()
            rows.append((artist, title))
    return rows


# ---------------------------------------------------------------------------
# Source resolution
# ---------------------------------------------------------------------------
def itunes_lookup(artist: str, title: str):
    """Resolve a track via the iTunes Search API. Returns a record dict or None.

    Picks the first relevant *original* recording. If iTunes only offers
    remixes/instrumentals, returns None so the YouTube fallback can try.
    """
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

    candidates = []
    for r in resp.json().get("results", []):
        preview = r.get("previewUrl")
        dur_ms = r.get("trackTimeMillis") or 0
        result_title = r.get("trackName") or ""
        if not preview:
            continue
        if not (MIN_DURATION_S * 1000 <= dur_ms <= MAX_DURATION_S * 1000):
            continue
        if not artist_matches(artist, r.get("artistName", "")):
            continue
        if not title_relevant(result_title, title):
            continue
        candidates.append(r)

    # Prefer an original recording; skip remixes / instrumentals / live cuts.
    originals = [
        r for r in candidates
        if not is_alternate_version(r.get("trackName") or "", title)
    ]
    if not originals:
        return None  # let the YouTube fallback look for the original

    r = originals[0]
    artwork = (r.get("artworkUrl100") or "").replace("100x100bb", "600x600bb")
    final_artist = clean(r.get("artistName") or artist)
    final_title = clean(r.get("trackName") or title)
    return {
        "artist": final_artist,
        "title": final_title,
        "source": "itunes",
        "preview_url": r.get("previewUrl"),
        "youtube_id": None,
        "artwork_url": artwork or None,
        "genre": clean(r.get("primaryGenreName")) or None,
        "release_year": _year_from(r.get("releaseDate")),
        "script": detect_script(f"{final_artist} {final_title}"),
    }


def youtube_lookup(artist: str, title: str):
    """Resolve a track via yt-dlp. Returns the first embeddable result, or None."""
    if yt_dlp is None:
        return None
    query = f"ytsearch5:{artist} - {title} (Audio)"

    # Stage 1 - cheap flat search for candidate video ids.
    flat_opts = {
        "quiet": True, "no_warnings": True, "skip_download": True,
        "extract_flat": True, "noplaylist": True, "socket_timeout": 20,
    }
    with yt_dlp.YoutubeDL(flat_opts) as ydl:
        info = ydl.extract_info(query, download=False)
    candidates = [
        e.get("id") for e in (info or {}).get("entries", [])
        if e and e.get("id")
    ]

    # Stage 2 - full extract each candidate until one is embeddable + sane.
    full_opts = {
        "quiet": True, "no_warnings": True, "skip_download": True,
        "noplaylist": True, "socket_timeout": 20,
    }
    for vid in candidates:
        if not YT_ID_RE.match(vid):
            continue
        try:
            with yt_dlp.YoutubeDL(full_opts) as ydl:
                meta = ydl.extract_info(
                    f"https://www.youtube.com/watch?v={vid}", download=False
                )
        except Exception:
            continue
        duration = meta.get("duration") or 0
        if not (MIN_DURATION_S <= duration <= MAX_DURATION_S):
            continue
        if meta.get("playable_in_embed") is False:
            continue  # would throw error 101/150 in the iframe player
        if meta.get("availability") in ("private", "needs_auth", "premium_only"):
            continue
        if is_alternate_version(meta.get("title") or "", title):
            continue  # remix / instrumental / live / etc.
        return {
            "artist": artist,
            "title": title,
            "source": "youtube",
            "preview_url": None,
            "youtube_id": vid,
            "artwork_url": meta.get("thumbnail"),
            "genre": None,         # iTunes-only — backfill_metadata.py fills it later
            "release_year": None,  # iTunes-only — backfill_metadata.py fills it later
            "script": detect_script(f"{artist} {title}"),
        }
    return None


# ---------------------------------------------------------------------------
# Progress + persistence
# ---------------------------------------------------------------------------
def load_progress(reset: bool, csv_name: str) -> int:
    """Resume position — but only if the saved progress is for THIS csv file."""
    if reset or not PROGRESS_FILE.exists():
        return 0
    try:
        data = json.loads(PROGRESS_FILE.read_text())
        if data.get("csv") != csv_name:
            return 0  # a different playlist file — start fresh
        return int(data.get("next_row", 0))
    except Exception:
        return 0


def save_progress(next_row: int, stats: dict, csv_name: str):
    PROGRESS_FILE.write_text(json.dumps({
        "csv": csv_name,
        "next_row": next_row,
        "stats": stats,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }, indent=2, ensure_ascii=False))


def log_unresolved(artist: str, title: str, reason: str):
    is_new = not UNRESOLVED_FILE.exists()
    with open(UNRESOLVED_FILE, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if is_new:
            w.writerow(["artist", "title", "reason"])
        w.writerow([artist, title, reason])


def upsert_rows(supabase, rows) -> int:
    """Batch-upsert; on failure retry row-by-row so one bad row can't block 50."""
    if not rows:
        return 0
    try:
        supabase.table("tracks").upsert(rows, on_conflict="dedupe_key").execute()
        return len(rows)
    except Exception as e:
        print(f"  ! batch upsert failed ({e}); retrying row by row")
        ok = 0
        for r in rows:
            try:
                supabase.table("tracks").upsert(
                    [r], on_conflict="dedupe_key"
                ).execute()
                ok += 1
            except Exception as e2:
                print(f"  ! skipped {r['artist']} - {r['title']}: {e2}")
        return ok


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def parse_args():
    p = argparse.ArgumentParser(description="Songless hybrid library ingestion")
    p.add_argument("csv", nargs="?", default="seed.csv",
                   help="CSV file inside ingest/ (or an absolute path)")
    p.add_argument("--reset", action="store_true",
                   help="ignore saved progress and start from row 1")
    return p.parse_args()


def main():
    args = parse_args()
    # Force UTF-8 stdout — Windows defaults to a locale codepage (e.g. cp1255)
    # that can't encode every artist/title character.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    load_dotenv(HERE / ".env")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(
            "Missing credentials. Copy ingest/.env.example to ingest/.env and "
            "fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )
    supabase = create_client(url, key)

    if yt_dlp is None:
        print("WARNING: yt-dlp is not installed - the YouTube fallback is disabled. "
              "Tracks missing from iTunes will be logged as unresolved.")

    csv_arg = Path(args.csv)
    csv_path = csv_arg if csv_arg.is_absolute() else (HERE / csv_arg)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")
    csv_name = csv_path.name

    rows = read_csv(csv_path)
    total = len(rows)
    start = load_progress(args.reset, csv_name)
    stats = {"itunes": 0, "youtube": 0, "unresolved": 0}
    print(f"Loaded {total} rows from {csv_path.name}. Resuming at row {start + 1}.\n")

    batch = []
    last_flushed = start
    processed_through = start
    last_itunes_call = 0.0

    def flush(through_row: int):
        nonlocal batch, last_flushed
        if batch:
            n = upsert_rows(supabase, batch)
            print(f"  > upserted {n}/{len(batch)} rows")
            batch = []
        last_flushed = through_row
        save_progress(last_flushed, stats, csv_name)

    try:
        for idx in range(start, total):
            artist, title = rows[idx]
            if not artist or not title:
                stats["unresolved"] += 1
                log_unresolved(artist, title, "missing artist or title")
                save_progress(last_flushed, stats, csv_name)
                continue

            print(f"[{idx + 1}/{total}] {artist} - {title}")
            record = None

            # --- iTunes (rate-limited) ---
            wait = ITUNES_DELAY - (time.time() - last_itunes_call)
            if wait > 0:
                time.sleep(wait)
            try:
                record = itunes_lookup(artist, title)
            except Exception as e:
                print(f"  iTunes error: {e}")
            finally:
                last_itunes_call = time.time()

            # --- YouTube fallback ---
            if record is None:
                try:
                    record = youtube_lookup(artist, title)
                except Exception as e:
                    print(f"  YouTube error: {e}")
                time.sleep(random.uniform(YT_DELAY_MIN, YT_DELAY_MAX))

            if record is None:
                stats["unresolved"] += 1
                log_unresolved(artist, title, "no playable source found")
                print("  -> unresolved")
            else:
                stats[record["source"]] += 1
                batch.append(record)
                print(f"  -> {record['source']}")

            processed_through = idx + 1
            if len(batch) >= BATCH_SIZE:
                flush(processed_through)
            else:
                save_progress(last_flushed, stats, csv_name)

        flush(total)

    except KeyboardInterrupt:
        print("\nInterrupted - flushing the current batch before exit...")
        flush(processed_through)

    print(f"\nDone. iTunes={stats['itunes']}  YouTube={stats['youtube']}  "
          f"unresolved={stats['unresolved']}")
    if stats["unresolved"]:
        print(f"Unresolved tracks logged to {UNRESOLVED_FILE.name}")


if __name__ == "__main__":
    main()
