# Shirimim

A self-hosted music-guessing game — Heardle / Songless-style — built for a
private group of friends. Guess the song from progressively longer snippets,
race friends in real time, or work it out from the lyrics alone.

![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-087EA4?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

**Live demo — [shirimim.vercel.app](https://shirimim.vercel.app)**

## Game modes

| Mode | How it plays |
| ---- | ------------ |
| **Daily** | One shared puzzle a day — everyone gets the same song. Snippets grow 1s → 2s → 4s → 8s → 15s, with an emoji-grid result to share. |
| **Endless** | A fresh random song every round with a streak counter. Filter by whole library, Hebrew, a genre, a Hebrew sub-genre (e.g. Mizrahi), a decade, or a single artist. |
| **Party** | Kahoot-style real-time multiplayer. The host opens a room, friends join with a 6-character code, and everyone races to pick the song from four options, scored by speed. |
| **Duel** | Asynchronous 1-v-1 — start a duel on a random song, share the link, and the end screen compares both players' results. |
| **Lyrics** | Guess the song from its lyrics instead of audio — one line shows up front, and each wrong guess reveals another. |

Plus a **Stats** page (win %, streaks, guess distribution), a friend
**Leaderboard** for the daily puzzle, and an **Archive** to replay any past day.

## Highlights

- **Progressive hints** — in Daily, Endless and Duel, the song's genre is revealed after two wrong guesses and its release year after three.
- **Party power-ups** — every player gets a one-shot 50:50 (knocks out two wrong options) and a 2× points multiplier.
- **Party depth** — host-chosen category and round length, streak bonuses, a Kahoot-style answer breakdown on the reveal, and live emoji reactions.
- **Hybrid audio** — each track plays from a clean iTunes 30-second preview, falling back to an embed-verified YouTube video only when iTunes lacks the song.
- **Auto-tuned playback** — an ingestion pass detects quiet song intros and skips the dead air so short snippets are never silent.
- **Server-authoritative** — Row-Level Security is locked with no policies; the browser never reads the answer tables directly.

## Tech stack

- **Next.js 16** — App Router, Server Actions, Turbopack — with **React 19**
- **TypeScript** (strict) and **Tailwind CSS v4**
- **Supabase** — Postgres, Row-Level Security, and Realtime broadcast for Party
- **Python** ingestion pipeline — `yt-dlp`, the iTunes Search API, `lyrics.ovh`, and bundled `ffmpeg`
- Deployed on **Vercel** (free tier)

## Getting started

### 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste all of [`sql/schema.sql`](sql/schema.sql) and
   run it. The file is idempotent — re-run the whole thing after pulling schema
   changes.
3. From **Project Settings → API**, copy the **Project URL**, **anon key**, and
   **service_role key**.

### 2. Ingest the song library

```bash
cd ingest
python -m venv .venv
# Windows:  .venv\Scripts\activate     macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

Drop a CSV into `ingest/` (a Spotify/Exportify export — any CSV with an artist
column and a track-name column), then:

```bash
python ingest.py seed.csv
python ingest.py mizrahi.csv --genre Mizrahi   # force one CSV's genre
```

`build_seed.py` merges and de-dupes several playlist CSVs into one `seed.csv`.
Ingestion is resumable — if it stops or gets rate-limited, just run it again.

Then enrich the library with three resumable passes (all safe to leave running
in the background):

```bash
python backfill_metadata.py   # genre + release year (for genre / decade modes)
python detect_offsets.py      # auto-skip quiet song intros (ffmpeg silencedetect)
python fetch_lyrics.py        # cache lyrics (lyrics.ovh) — powers Lyrics mode
```

`genre_rules.py` holds the genre-folding map and the Mizrahi artist list — edit
it and re-run the backfill to reshape how genres are bucketed. Lyrics coverage
is English-leaning; non-English titles match poorly and are simply skipped.

### 3. Run the app

```bash
cp .env.example .env.local    # Supabase values + a CRON_SECRET
npm install
npm run dev
```

Open <http://localhost:3000>.

### 4. Deploy to Vercel

1. Push to GitHub and import at [vercel.com/new](https://vercel.com/new).
2. Add the environment variables from `.env.example` in the Vercel project
   settings.
3. Deploy. `vercel.json` registers a daily cron that pre-warms each day's song,
   and every `git push` redeploys automatically.

## How it works

**The daily puzzle** — a fixed epoch (`2026-05-20`) plus the current date in
**Asia/Jerusalem** gives a day number. The day's song is chosen deterministically
and **locked** into the `daily_songs` table the first time anyone opens the game
that day — so every friend gets the same track and old puzzle numbers never
change as the library grows.

**Architecture** — all database access is server-side via the Supabase
service-role key; the browser never talks to Supabase directly except for Party
Mode's realtime channel (receive-only). Row-Level Security is enabled with no
policies, so the answer tables can't be dumped from the client.

> **Honor system:** the audio URL is visible in the browser's network tab, so a
> determined player could identify the song. That's a fine trade-off for a
> private friends group.

## License

Released under the [MIT License](LICENSE).
