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
-- random_track: pick a random track for Endless mode, optionally excluding the
-- previous one so the same song never appears twice in a row.
-- ----------------------------------------------------------------------------
create or replace function random_track(exclude_id uuid default null)
returns uuid
language sql
as $$
  select id
  from tracks
  where exclude_id is null or id <> exclude_id
  order by random()
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security: enabled with no policies => no anon/public access.
-- All app reads/writes go through the server using the service_role key,
-- which bypasses RLS. Keeps the answer table un-dumpable from the browser.
-- ----------------------------------------------------------------------------
alter table tracks      enable row level security;
alter table daily_songs enable row level security;
