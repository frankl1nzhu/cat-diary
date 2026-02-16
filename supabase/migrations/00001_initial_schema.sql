-- =============================================
-- Cat Diary (喵记) — Initial Database Schema
-- =============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── Enums ──────────────────────────────────

create type mood_type as enum ('😸', '😾', '😴');
create type bristol_type as enum ('1', '2', '3', '4', '5', '6', '7');
create type poop_color as enum ('brown', 'dark_brown', 'yellow', 'green', 'red', 'black', 'white');
create type feed_status_type as enum ('fed', 'not_fed');
create type inventory_status as enum ('plenty', 'low', 'urgent');
create type health_record_type as enum ('vaccine', 'deworming', 'medical');
create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');

-- ─── Tables ─────────────────────────────────

-- 1. Cats
create table cats (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  birthday    date,
  breed       text,
  avatar_url  text,
  adopted_at  date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Diary Entries
create table diary_entries (
  id          uuid primary key default uuid_generate_v4(),
  cat_id      uuid not null references cats(id) on delete cascade,
  text        text,
  image_url   text,
  tags        text[] default '{}',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 3. Mood Logs
create table mood_logs (
  id          uuid primary key default uuid_generate_v4(),
  cat_id      uuid not null references cats(id) on delete cascade,
  mood        mood_type not null,
  date        date not null default current_date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (cat_id, date)  -- one mood per cat per day
);

-- 4. Poop Logs
create table poop_logs (
  id            uuid primary key default uuid_generate_v4(),
  cat_id        uuid not null references cats(id) on delete cascade,
  bristol_type  bristol_type not null,
  color         poop_color not null default 'brown',
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- 5. Weight Records
create table weight_records (
  id          uuid primary key default uuid_generate_v4(),
  cat_id      uuid not null references cats(id) on delete cascade,
  weight_kg   numeric(5,2) not null check (weight_kg > 0),
  recorded_at timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

-- 6. Health Records
create table health_records (
  id          uuid primary key default uuid_generate_v4(),
  cat_id      uuid not null references cats(id) on delete cascade,
  type        health_record_type not null,
  name        text not null,
  date        date not null,
  next_due    date,
  image_url   text,
  notes       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 7. Feed Status
create table feed_status (
  id          uuid primary key default uuid_generate_v4(),
  cat_id      uuid not null references cats(id) on delete cascade,
  status      feed_status_type not null default 'not_fed',
  fed_by      uuid references auth.users(id) on delete set null,
  fed_at      timestamptz,
  meal_type   meal_type not null default 'breakfast',
  updated_at  timestamptz not null default now()
);

-- Immutable date extraction (UTC) for use in unique index
create or replace function fed_date_utc(ts timestamptz)
returns date as $$
  select (ts at time zone 'UTC')::date;
$$ language sql immutable;

-- One feed record per cat per meal type per day
create unique index feed_status_unique_daily
  on feed_status (cat_id, meal_type, fed_date_utc(fed_at));

-- 8. Inventory
create table inventory (
  id          uuid primary key default uuid_generate_v4(),
  cat_id      uuid not null references cats(id) on delete cascade,
  item_name   text not null,
  status      inventory_status not null default 'plenty',
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- 9. Countdowns
create table countdowns (
  id          uuid primary key default uuid_generate_v4(),
  cat_id      uuid not null references cats(id) on delete cascade,
  title       text not null,
  target_date date not null,
  auto_type   text,  -- 'birthday', 'deworming', 'vaccine', or null for custom
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ─── Updated_at trigger ─────────────────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cats_updated_at
  before update on cats
  for each row execute function update_updated_at_column();

create trigger feed_status_updated_at
  before update on feed_status
  for each row execute function update_updated_at_column();

create trigger inventory_updated_at
  before update on inventory
  for each row execute function update_updated_at_column();

-- ─── Row Level Security ─────────────────────

alter table cats enable row level security;
alter table diary_entries enable row level security;
alter table mood_logs enable row level security;
alter table poop_logs enable row level security;
alter table weight_records enable row level security;
alter table health_records enable row level security;
alter table feed_status enable row level security;
alter table inventory enable row level security;
alter table countdowns enable row level security;

-- Since both users share one account, RLS simply checks authenticated
create policy "Authenticated users can do everything" on cats
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything" on diary_entries
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything" on mood_logs
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything" on poop_logs
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything" on weight_records
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything" on health_records
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything" on feed_status
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything" on inventory
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything" on countdowns
  for all using (auth.role() = 'authenticated');

-- ─── Enable Realtime ────────────────────────

alter publication supabase_realtime add table feed_status;
alter publication supabase_realtime add table diary_entries;
alter publication supabase_realtime add table mood_logs;
alter publication supabase_realtime add table poop_logs;
alter publication supabase_realtime add table inventory;

-- ─── Storage bucket for photos ──────────────

insert into storage.buckets (id, name, public)
values ('cat-photos', 'cat-photos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'cat-photos' and auth.role() = 'authenticated');

create policy "Anyone can view photos"
  on storage.objects for select
  using (bucket_id = 'cat-photos');
