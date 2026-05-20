#!/usr/bin/env python3
"""
Combine Exportify playlist CSVs from song_library/ into one deduped seed.csv.

Files are numbered by sorted filename (same order build_seed.py prints).

Usage:
    python build_seed.py                       # use every CSV in song_library/
    python build_seed.py --exclude 1,2,8       # skip files #1, #2, #8
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from ingest import read_csv  # reuses Exportify column detection + cleaning

HERE = Path(__file__).resolve().parent
LIBRARY = HERE / "song_library"
OUT = HERE / "seed.csv"


def main() -> None:
    ap = argparse.ArgumentParser(description="Combine playlist CSVs into seed.csv")
    ap.add_argument(
        "--exclude",
        default="",
        help="comma-separated 1-based file numbers to skip",
    )
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    files = sorted(LIBRARY.glob("*.csv"))
    if not files:
        raise SystemExit(f"No CSV files found in {LIBRARY}")

    skip = {int(x) for x in args.exclude.split(",") if x.strip()}
    chosen = [f for i, f in enumerate(files, 1) if i not in skip]

    seen: dict[tuple[str, str], tuple[str, str]] = {}
    raw = 0
    for fp in chosen:
        rows = read_csv(fp)
        raw += len(rows)
        for artist, title in rows:
            if artist and title:
                seen.setdefault((artist.lower(), title.lower()), (artist, title))
        print(f"  {len(rows):5}  {fp.name}")

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["artist", "title"])
        for artist, title in seen.values():
            writer.writerow([artist, title])

    print(
        f"\n{len(chosen)} playlists -> {raw} rows -> {len(seen)} unique songs"
        f"\nWrote {OUT}"
    )


if __name__ == "__main__":
    main()
