-- ============================================================================
-- Shirimim — database schema
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- tracks: the song library (hybrid — each row plays via iTunes OR YouTube)
-- ----------------------------------------------------------------------------
create table if not exists tracks (
  id          uuid primary key default uuid_generate_v4(),
  artist      text not null,
  title       text not null,
  source      text not null check (source in ('itunes', 'youtube')),
  preview_url text,            -- set when source = 'itunes' (30s MP3)
  youtube_id  text,            -- set when source = 'youtube' (11-char id)
  artwork_url text,            -- album art (free from iTunes; shown in end modal)
  created_at  timestamptz not null default now(),
  -- normalized identity, used as the batch-upsert conflict target
  dedupe_key  text generated always as (lower(artist) || '|' || lower(title)) stored,
  constraint tracks_has_source check (
    (source = 'itunes'  and preview_url is not null) or
    (source = 'youtube' and youtube_id  is not null)
  )
);

-- Track identity = normalized artist + title. Re-running ingestion never dupes.
create unique index if not exists tracks_dedupe_key
  on tracks (dedupe_key);

-- YouTube ids stay unique when present.
create unique index if not exists tracks_youtube_key
  on tracks (youtube_id) where youtube_id is not null;

-- Trigram indexes accelerate the autocomplete ILIKE '%term%' search.
create index if not exists tracks_artist_trgm on tracks using gin (artist gin_trgm_ops);
create index if not exists tracks_title_trgm  on tracks using gin (title  gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- daily_songs: each calendar day's puzzle, locked permanently once written
-- ----------------------------------------------------------------------------
create table if not exists daily_songs (
  day_number int  primary key,
  track_id   uuid not null references tracks(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- get_or_roll_daily: returns today's track id, picking deterministically and
-- locking it in on first call. Stable forever, no repeats until library
-- is exhausted, race-safe.
-- ----------------------------------------------------------------------------
create or replace function get_or_roll_daily(p_day int)
returns uuid
language plpgsql
as $$
declare
  v_track uuid;
begin
  select track_id into v_track from daily_songs where day_number = p_day;
  if v_track is not null then
    return v_track;
  end if;

  -- pick a not-yet-used track, deterministically seeded by the day number
  select t.id into v_track
  from tracks t
  where t.id not in (select track_id from daily_songs)
  order by md5(t.id::text || p_day::text)
  limit 1;

  -- library exhausted: allow repeats, still deterministic
  if v_track is null then
    select t.id into v_track
    from tracks t
    order by md5(t.id::text || p_day::text)
    limit 1;
  end if;

  if v_track is null then
    return null;  -- empty library
  end if;

  insert into daily_songs (day_number, track_id)
  values (p_day, v_track)
  on conflict (day_number) do nothing;

  -- re-read in case a concurrent request won the insert race
  select track_id into v_track from daily_songs where day_number = p_day;
  return v_track;
end;
$$;

-- ----------------------------------------------------------------------------
-- search_tracks: parameterized autocomplete search (injection-safe)
-- ----------------------------------------------------------------------------
create or replace function search_tracks(q text)
returns table (id uuid, artist text, title text)
language sql
as $$
  select t.id, t.artist, t.title
  from tracks t
  where t.artist ilike '%' || q || '%'
     or t.title  ilike '%' || q || '%'
  order by
    (lower(t.title)  like lower(q) || '%') desc,
    (lower(t.artist) like lower(q) || '%') desc,
    t.artist, t.title
  limit 8;
$$;

-- ----------------------------------------------------------------------------
-- random_track: pick a random track, optionally excluding the previous one and
-- optionally filtered by genre, script and/or artist (Endless + Party modes).
-- ----------------------------------------------------------------------------
-- Drop older signatures so re-running this file never leaves stale overloads.
drop function if exists random_track(uuid);
drop function if exists random_track(uuid, text, text);
drop function if exists random_track(uuid, text, text, text);

create or replace function random_track(
  exclude_id uuid default null,
  p_genre    text default null,
  p_script   text default null,
  p_artist   text default null,
  p_year_min int  default null,
  p_year_max int  default null
)
returns uuid
language sql
as $$
  select id
  from tracks
  where (exclude_id is null or id <> exclude_id)
    and (p_genre    is null or genre  = p_genre)
    and (p_script   is null or script = p_script)
    and (p_artist   is null or lower(artist) = lower(p_artist))
    and (p_year_min is null or release_year >= p_year_min)
    and (p_year_max is null or release_year <= p_year_max)
  order by random()
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- endless_genres: genres with enough tracks to make a fun Endless sub-mode.
-- ----------------------------------------------------------------------------
-- Optional p_script filters to one writing system (e.g. 'hebrew') so the
-- Endless picker can offer Hebrew-only genre sub-modes.
drop function if exists endless_genres();

create or replace function endless_genres(p_script text default null)
returns table (genre text, n bigint)
language sql
as $$
  select genre, count(*) as n
  from tracks
  where genre is not null
    and (p_script is null or script = p_script)
  group by genre
  having count(*) >= 10
  order by n desc;
$$;

-- ----------------------------------------------------------------------------
-- endless_artists: artists with enough tracks for an Endless spotlight mode.
-- ----------------------------------------------------------------------------
create or replace function endless_artists()
returns table (artist text, n bigint)
language sql
as $$
  select artist, count(*) as n
  from tracks
  group by artist
  having count(*) >= 5
  order by n desc, artist
  limit 30;
$$;

-- ----------------------------------------------------------------------------
-- endless_decades: decades with enough dated tracks for an Endless sub-mode.
-- ----------------------------------------------------------------------------
create or replace function endless_decades()
returns table (decade int, n bigint)
language sql
as $$
  select (release_year / 10) * 10 as decade, count(*) as n
  from tracks
  where release_year is not null
  group by (release_year / 10) * 10
  having count(*) >= 10
  order by decade desc;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security: enabled with no policies => no anon/public access.
-- All app reads/writes go through the server using the service_role key,
-- which bypasses RLS. Keeps the answer table un-dumpable from the browser.
-- ----------------------------------------------------------------------------
alter table tracks      enable row level security;
alter table daily_songs enable row level security;

-- ============================================================================
-- PARTY MODE — real-time multiplayer
-- ============================================================================

-- Distractor / filter metadata on tracks (populated by ingestion + backfill).
alter table tracks add column if not exists genre        text;
alter table tracks add column if not exists script       text;   -- hebrew | latin | other
alter table tracks add column if not exists release_year int;    -- 4-digit year from iTunes
alter table tracks add column if not exists start_offset_ms int not null default 0;  -- skip a quiet intro

create index if not exists tracks_genre_idx        on tracks (genre);
create index if not exists tracks_script_idx       on tracks (script);
create index if not exists tracks_release_year_idx on tracks (release_year);
create index if not exists tracks_artist_lower_idx on tracks (lower(artist));

-- ----------------------------------------------------------------------------
-- rooms: one per Party game. RLS locked — written only by server actions.
-- ----------------------------------------------------------------------------
create table if not exists rooms (
  id                uuid primary key default uuid_generate_v4(),
  code              text unique not null,
  host_id           text not null,                 -- secret; gates host actions
  status            text not null default 'waiting'
                      check (status in ('waiting', 'playing', 'finished')),
  current_round     int  not null default 0,
  max_rounds        int  not null default 10,
  current_answer_id uuid references tracks(id),     -- server-only; never sent raw
  round_started_at  timestamptz,                   -- server clock for scoring
  round_options     jsonb,                         -- 4 shown options (no answer flag)
  created_at        timestamptz not null default now()
);
create index if not exists rooms_code_idx on rooms (code);

-- Optional genre lock — when set, every round pulls only from this genre.
alter table rooms add column if not exists genre text;

-- ----------------------------------------------------------------------------
-- players: one per participant in a room.
-- ----------------------------------------------------------------------------
create table if not exists players (
  id                  uuid primary key default uuid_generate_v4(),
  room_id             uuid not null references rooms(id) on delete cascade,
  name                text not null,
  score               int  not null default 0,
  is_ready            boolean not null default false,
  last_answered_round int  not null default 0,      -- one guess per round
  created_at          timestamptz not null default now()
);
create index if not exists players_room_idx on players (room_id);

-- Power-ups: one 50:50 and one double-points per player per game.
alter table players add column if not exists used_fifty   boolean not null default false;
alter table players add column if not exists used_double  boolean not null default false;
alter table players add column if not exists double_round int     not null default 0;

-- ----------------------------------------------------------------------------
-- party_distractors: up to p_count wrong-answer tracks for a Party round.
-- Cascade, best tier first: same artist -> same genre+script -> same script -> any.
-- ----------------------------------------------------------------------------
create or replace function party_distractors(p_correct_id uuid, p_count int default 3)
returns table (id uuid, artist text, title text)
language plpgsql
as $$
declare
  v_artist text;
  v_genre  text;
  v_script text;
begin
  select t.artist, t.genre, t.script
    into v_artist, v_genre, v_script
  from tracks t where t.id = p_correct_id;

  return query
  with pool as (
    (select t.id, t.artist, t.title, 1 as tier
       from tracks t
      where t.id <> p_correct_id and lower(t.artist) = lower(v_artist)
      order by random() limit p_count)
    union all
    (select t.id, t.artist, t.title, 2 as tier
       from tracks t
      where t.id <> p_correct_id and lower(t.artist) <> lower(v_artist)
        and t.genre  is not distinct from v_genre
        and t.script is not distinct from v_script
      order by random() limit p_count)
    union all
    (select t.id, t.artist, t.title, 3 as tier
       from tracks t
      where t.id <> p_correct_id and lower(t.artist) <> lower(v_artist)
        and t.script is not distinct from v_script
      order by random() limit p_count)
    union all
    (select t.id, t.artist, t.title, 4 as tier
       from tracks t
      where t.id <> p_correct_id
      order by random() limit p_count)
  ),
  deduped as (
    select distinct on (pool.id) pool.id, pool.artist, pool.title, pool.tier
    from pool
    order by pool.id, pool.tier
  )
  select deduped.id, deduped.artist, deduped.title
  from deduped
  order by deduped.tier, random()
  limit p_count;
end;
$$;

-- Party tables: RLS locked, same as the rest of the app.
alter table rooms   enable row level security;
alter table players enable row level security;

-- ============================================================================
-- SOCIAL — friend leaderboard + duels
-- ============================================================================

-- daily_results: each player's own result for one day. Honor-system identity
-- (a per-browser id from localStorage) — one row per player per day.
create table if not exists daily_results (
  id          uuid primary key default uuid_generate_v4(),
  day_number  int  not null,
  player_id   text not null,
  name        text not null,
  won         boolean not null,
  guesses     int  not null,
  created_at  timestamptz not null default now(),
  unique (day_number, player_id)
);
create index if not exists daily_results_day_idx on daily_results (day_number);

alter table daily_results enable row level security;

-- duels: one shared song, challenged via a shareable link.
create table if not exists duels (
  id         uuid primary key default uuid_generate_v4(),
  track_id   uuid not null references tracks(id),
  created_at timestamptz not null default now()
);

-- duel_results: each player's attempt at a duel — one row per player per duel.
create table if not exists duel_results (
  id         uuid primary key default uuid_generate_v4(),
  duel_id    uuid not null references duels(id) on delete cascade,
  player_id  text not null,
  name       text not null,
  won        boolean not null,
  guesses    int  not null,
  created_at timestamptz not null default now(),
  unique (duel_id, player_id)
);
create index if not exists duel_results_duel_idx on duel_results (duel_id);

alter table duels        enable row level security;
alter table duel_results enable row level security;

-- ============================================================================
-- LYRICS MODE — guess the song from its lyrics
-- ============================================================================

-- Cached song lyrics, populated by ingest/fetch_lyrics.py. NULL until fetched.
alter table tracks add column if not exists lyrics text;

-- Partial index — Lyrics mode only ever queries the rows that have lyrics.
create index if not exists tracks_has_lyrics_idx on tracks (id) where lyrics is not null;

-- ----------------------------------------------------------------------------
-- random_lyrics_track: a random track that has cached lyrics (Lyrics mode).
-- ----------------------------------------------------------------------------
create or replace function random_lyrics_track(exclude_id uuid default null)
returns uuid
language sql
as $$
  select id
  from tracks
  where lyrics is not null
    and (exclude_id is null or id <> exclude_id)
  order by random()
  limit 1;
$$;
