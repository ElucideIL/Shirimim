# Shirimim

A self-hosted music-guessing game — Songless / Heardle-style — for a private
friends group. Guess the song from progressively longer snippets (1s, 2s, 4s,
8s, 15s); there's no manual audio clipping, the timing is pure frontend.

Built with Next.js 16 + TypeScript + Tailwind + Supabase, free to host on Vercel.

## Modes

- **Daily** — one shared puzzle a day; everyone gets the same song. Emoji-grid
  share, plus an **archive** to replay any past day.
- **Endless** — a fresh random song every round with a streak counter. Pick a
  sub-mode: all songs, Hebrew (and Hebrew sub-genres like Mizrahi), a genre, a
  decade, or a single artist.
- **Party** — Kahoot-style real-time multiplayer. The host opens a room, friends
  join with a 6-character code, and everyone races to pick the song from four
  options, scored by speed. Optional genre lock, live leaderboard, final podium.
  Each player gets two one-shot power-ups: **50:50** (knocks out two wrong
  options) and **2× points**.
- **Duel** — async 1-v-1: start a duel on a random song, share the link, and the
  end screen compares both players' results.
- **Lyrics** — guess the song from its lyrics instead of audio. One line shows up
  front and each wrong guess reveals another, with a streak counter.

Plus a **Stats** page (Wordle-style win %, streaks, guess distribution) and a
friend **Leaderboard** for the daily puzzle. Guesses are colour-coded — green
(correct), yellow (right artist, wrong song), red (wrong) — and once a round
ends you can hear a longer clip of the song. In Daily, Endless and Duel a
**genre hint** unlocks after two guesses and a **release-year hint** after three.

## Audio

Hybrid. Each track plays from an iTunes 30-second preview MP3 (clean, no ads,
precise timing) and falls back to an embed-verified YouTube video only when
iTunes lacks the track.

## 1. Set up Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste all of [`sql/schema.sql`](sql/schema.sql) and
   run it. The file is idempotent — re-run the whole thing after pulling schema
   changes.
3. From **Project Settings → API**, copy the **Project URL**, **anon key**, and
   **service_role key**.

## 2. Ingest the song library

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

After ingesting, backfill genre + release year (genre for YouTube-sourced
tracks, release year for the decade mode):

```bash
python backfill_metadata.py
python backfill_metadata.py --normalize-only   # re-apply genre rules only
```

`genre_rules.py` holds the genre-folding map and the Mizrahi artist list — edit
it and re-run the backfill to reshape how genres are bucketed.

Two more optional passes, both resumable and safe to leave running in the
background:

```bash
python detect_offsets.py   # auto-skip quiet song intros (ffmpeg silence detect)
python fetch_lyrics.py     # cache lyrics (lyrics.ovh) — powers Lyrics mode
```

Lyrics mode only draws from tracks that `fetch_lyrics.py` resolved, so coverage
grows as that pass runs; non-English titles match poorly and are simply skipped.

## 3. Run the app

```bash
cp .env.example .env.local    # Supabase values + a CRON_SECRET
npm install
npm run dev
```

Open <http://localhost:3000>.

## 4. Deploy to Vercel

1. Push to GitHub and import at [vercel.com/new](https://vercel.com/new).
2. Add the environment variables from `.env.example` in the Vercel project
   settings.
3. Deploy. `vercel.json` registers a daily cron that pre-warms each day's song,
   and every `git push` redeploys automatically.

## How the daily puzzle works

A fixed epoch (`2026-05-20`) plus the current date in **Asia/Jerusalem** gives a
day number. The day's song is chosen deterministically and **locked** into the
`daily_songs` table the first time anyone opens the game that day — so every
friend gets the same track and old puzzle numbers never change as the library
grows.

## Architecture

All database access is server-side via the Supabase service-role key; the
browser never talks to Supabase directly except for Party Mode's realtime
channel (receive-only). Row-level security is enabled with no policies, so the
answer tables can't be dumped from the client.

> **Honor system:** the audio URL is visible in the browser's network tab, so a
> determined player could identify the song. Fine for a private friends group.
