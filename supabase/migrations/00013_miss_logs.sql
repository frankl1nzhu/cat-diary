-- Add miss logs: each press records one "miss cat" event

create table if not exists public.miss_logs (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.miss_logs enable row level security;

drop policy if exists "miss_select" on public.miss_logs;
create policy "miss_select"
  on public.miss_logs for select
  using (can_access_cat(cat_id));

drop policy if exists "miss_insert" on public.miss_logs;
create policy "miss_insert"
  on public.miss_logs for insert
  with check (can_access_cat(cat_id));

drop policy if exists "miss_delete" on public.miss_logs;
create policy "miss_delete"
  on public.miss_logs for delete
  using (created_by = auth.uid());
