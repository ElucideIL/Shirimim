# Shirimim

A self-hosted daily music-guessing game (a Songless / Heardle-style game) for a
private friends group. Guess the song from progressively longer snippets — no manual
audio clipping, the "play 1s, 2s, 4s…" mechanic is pure frontend timing.

Two modes:

- **Daily** — one shared puzzle per day; everyone gets the same song, with a
  social emoji-grid share.
- **Endless** — a fresh random song every round, replay as much as you like.

Built with Next.js + TypeScript + Tailwind + Supabase, free to host on Vercel.

**Audio is hybrid.** Each track plays from an iTunes 30-second preview MP3 (clean,
no ads, precise timing) and falls back to an embed-verified YouTube video only when
iTunes lacks the track.

## 1. Set up Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste all of [`sql/schema.sql`](sql/schema.sql), run it.
   ("Success. No rows returned" is the expected result.)
3. From **Project Settings → API**, copy the **Project URL**, **anon key**, and
   **service_role key**.

## 2. Ingest the song library

```bash
cd ingest
python -m venv .venv
# Windows:  .venv\Scripts\activate     macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

Drop a `seed.csv` into `ingest/` (a Spotify/Exportify playlist export — any CSV with
an "Artist" column and a "Track Name"/"Title" column), then:

```bash
python ingest.py seed.csv
```

The script is resumable — if it stops or gets rate-limited, just run it again and it
picks up from `progress_state.json`. A 10-row `sample_seed.csv` is included for a
quick smoke test.

## 3. Run the app

```bash
cp .env.example .env.local    # fill in the Supabase values + a CRON_SECRET
npm install
npm run dev
```

Open <http://localhost:3000>.

## 4. Deploy to Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. Add the four environment variables from `.env.example` in the Vercel project
   settings.
3. Deploy. `vercel.json` registers a daily cron that pre-warms each day's song, and
   every future `git push` redeploys automatically.

## How the daily puzzle works

A fixed epoch (`2026-05-20`) plus the current date in **Asia/Jerusalem** gives a day
number. The day's song is chosen deterministically and **locked** in the
`daily_songs` table the first time anyone opens the game that day — so every friend
gets the same track, and old puzzle numbers never change as the library grows.

> **Honor system:** the audio URL is visible in the browser's network tab, so a
> determined player could identify the song. Fine for a private friends group.
