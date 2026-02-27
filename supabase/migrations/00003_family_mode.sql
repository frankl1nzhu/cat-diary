-- Family mode: create/join household and bind cats to family

create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

alter table public.cats
  add column if not exists family_id uuid references public.families(id) on delete set null;

create index if not exists idx_cats_family_id on public.cats(family_id);
create index if not exists idx_family_members_user_id on public.family_members(user_id);

alter table public.families enable row level security;
alter table public.family_members enable row level security;

drop policy if exists "Authenticated users can do everything" on public.families;
create policy "Authenticated users can do everything" on public.families
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.family_members;
create policy "Authenticated users can do everything" on public.family_members
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
