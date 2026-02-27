-- =============================================
-- Migration 4: Tighten RLS, enforce family-scoped access, role-based permissions
-- =============================================

-- ─── Helper function: get all family IDs for the current user ───

create or replace function my_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from family_members where user_id = auth.uid();
$$;

-- ─── Helper function: get family role for given family ───

create or replace function my_family_role(fid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from family_members where user_id = auth.uid() and family_id = fid limit 1;
$$;

-- ─── 1. Families — member can read, only creator can update/delete ───

drop policy if exists "Authenticated users can do everything" on public.families;

create policy "family_select"
  on public.families for select
  using (id in (select my_family_ids()));

create policy "family_insert"
  on public.families for insert
  with check (auth.role() = 'authenticated');

create policy "family_update"
  on public.families for update
  using (created_by = auth.uid());

create policy "family_delete"
  on public.families for delete
  using (created_by = auth.uid());

-- ─── 2. Family Members — scoped to own family memberships ───

drop policy if exists "Authenticated users can do everything" on public.family_members;

create policy "fm_select"
  on public.family_members for select
  using (family_id in (select my_family_ids()));

create policy "fm_insert"
  on public.family_members for insert
  with check (auth.role() = 'authenticated');

create policy "fm_delete_self"
  on public.family_members for delete
  using (user_id = auth.uid());

create policy "fm_delete_admin"
  on public.family_members for delete
  using (
    my_family_role(family_id) in ('owner', 'admin')
  );

-- ─── 3. Cats — visible to family members or personal (fallback) ───

drop policy if exists "Authenticated users can do everything" on public.cats;

create policy "cats_select"
  on public.cats for select
  using (
    family_id in (select my_family_ids())
    or (family_id is null and created_by = auth.uid())
  );

create policy "cats_insert"
  on public.cats for insert
  with check (
    auth.role() = 'authenticated'
    and (
      family_id in (select my_family_ids())
      or family_id is null
    )
  );

create policy "cats_update"
  on public.cats for update
  using (
    family_id in (select my_family_ids())
    or (family_id is null and created_by = auth.uid())
  );

-- Only owner/admin can delete cats
create policy "cats_delete"
  on public.cats for delete
  using (
    created_by = auth.uid()
    or my_family_role(family_id) in ('owner', 'admin')
  );

-- ─── 4. Cat-scoped tables: access via cat → family chain ───

-- Helper: check if user has access to a specific cat
create or replace function can_access_cat(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from cats
    where id = cid
    and (
      family_id in (select family_id from family_members where user_id = auth.uid())
      or (family_id is null and created_by = auth.uid())
    )
  );
$$;

-- diary_entries
drop policy if exists "Authenticated users can do everything" on public.diary_entries;

create policy "diary_select"
  on public.diary_entries for select
  using (can_access_cat(cat_id));

create policy "diary_insert"
  on public.diary_entries for insert
  with check (can_access_cat(cat_id));

create policy "diary_update"
  on public.diary_entries for update
  using (can_access_cat(cat_id));

create policy "diary_delete"
  on public.diary_entries for delete
  using (created_by = auth.uid());

-- mood_logs
drop policy if exists "Authenticated users can do everything" on public.mood_logs;

create policy "mood_select"
  on public.mood_logs for select
  using (can_access_cat(cat_id));

create policy "mood_insert"
  on public.mood_logs for insert
  with check (can_access_cat(cat_id));

create policy "mood_update"
  on public.mood_logs for update
  using (can_access_cat(cat_id));

create policy "mood_delete"
  on public.mood_logs for delete
  using (created_by = auth.uid());

-- poop_logs
drop policy if exists "Authenticated users can do everything" on public.poop_logs;

create policy "poop_select"
  on public.poop_logs for select
  using (can_access_cat(cat_id));

create policy "poop_insert"
  on public.poop_logs for insert
  with check (can_access_cat(cat_id));

create policy "poop_update"
  on public.poop_logs for update
  using (can_access_cat(cat_id));

create policy "poop_delete"
  on public.poop_logs for delete
  using (created_by = auth.uid());

-- weight_records
drop policy if exists "Authenticated users can do everything" on public.weight_records;

create policy "weight_select"
  on public.weight_records for select
  using (can_access_cat(cat_id));

create policy "weight_insert"
  on public.weight_records for insert
  with check (can_access_cat(cat_id));

create policy "weight_update"
  on public.weight_records for update
  using (can_access_cat(cat_id));

create policy "weight_delete"
  on public.weight_records for delete
  using (created_by = auth.uid());

-- health_records
drop policy if exists "Authenticated users can do everything" on public.health_records;

create policy "health_select"
  on public.health_records for select
  using (can_access_cat(cat_id));

create policy "health_insert"
  on public.health_records for insert
  with check (can_access_cat(cat_id));

create policy "health_update"
  on public.health_records for update
  using (can_access_cat(cat_id));

create policy "health_delete"
  on public.health_records for delete
  using (created_by = auth.uid());

-- feed_status
drop policy if exists "Authenticated users can do everything" on public.feed_status;

create policy "feed_select"
  on public.feed_status for select
  using (can_access_cat(cat_id));

create policy "feed_insert"
  on public.feed_status for insert
  with check (can_access_cat(cat_id));

create policy "feed_update"
  on public.feed_status for update
  using (can_access_cat(cat_id));

create policy "feed_delete"
  on public.feed_status for delete
  using (can_access_cat(cat_id));

-- inventory
drop policy if exists "Authenticated users can do everything" on public.inventory;

create policy "inv_select"
  on public.inventory for select
  using (can_access_cat(cat_id));

create policy "inv_insert"
  on public.inventory for insert
  with check (can_access_cat(cat_id));

create policy "inv_update"
  on public.inventory for update
  using (can_access_cat(cat_id));

create policy "inv_delete"
  on public.inventory for delete
  using (can_access_cat(cat_id));

-- countdowns
drop policy if exists "Authenticated users can do everything" on public.countdowns;

create policy "cd_select"
  on public.countdowns for select
  using (can_access_cat(cat_id));

create policy "cd_insert"
  on public.countdowns for insert
  with check (can_access_cat(cat_id));

create policy "cd_update"
  on public.countdowns for update
  using (can_access_cat(cat_id));

create policy "cd_delete"
  on public.countdowns for delete
  using (created_by = auth.uid());

-- ─── 5. Auto-create personal family for new users via trigger ───

create or replace function handle_new_user_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
  user_email text;
  family_display_name text;
begin
  user_email := coalesce(new.raw_user_meta_data->>'email', new.email, '用户');
  family_display_name := split_part(user_email, '@', 1) || ' 的家';

  insert into families (name, invite_code, created_by)
  values (
    family_display_name,
    upper(substr(md5(random()::text), 1, 6)),
    new.id
  )
  returning id into new_family_id;

  insert into family_members (family_id, user_id, role)
  values (new_family_id, new.id, 'owner');

  return new;
end;
$$;

-- Only create trigger if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created_family'
  ) then
    create trigger on_auth_user_created_family
      after insert on auth.users
      for each row execute function handle_new_user_family();
  end if;
end;
$$;

-- ─── 6. Backfill: create personal families for existing users without one ───

do $$
declare
  u record;
  new_fam_id uuid;
  user_display text;
begin
  for u in
    select au.id, au.email
    from auth.users au
    where not exists (
      select 1 from family_members fm where fm.user_id = au.id
    )
  loop
    user_display := split_part(coalesce(u.email, '用户'), '@', 1) || ' 的家';
    insert into families (name, invite_code, created_by)
    values (
      user_display,
      upper(substr(md5(random()::text), 1, 6)),
      u.id
    )
    returning id into new_fam_id;

    insert into family_members (family_id, user_id, role)
    values (new_fam_id, u.id, 'owner');

    -- Assign any orphan cats (family_id IS NULL) to their personal family
    update cats set family_id = new_fam_id
    where created_by = u.id and family_id is null;
  end loop;
end;
$$;
