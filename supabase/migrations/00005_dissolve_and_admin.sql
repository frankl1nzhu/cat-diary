-- =============================================
-- Migration 5: Dissolve family support + admin role management
-- =============================================

-- ─── 1. Allow family owners to update member roles ───

create policy "fm_update_owner"
  on public.family_members for update
  using (
    my_family_role(family_id) = 'owner'
  )
  with check (
    my_family_role(family_id) = 'owner'
  );

-- ─── 2. Expose auth.users email for family member display ───

create or replace function get_family_members_with_email(target_family_id uuid)
returns table (
  id uuid,
  user_id uuid,
  role text,
  email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fm.id,
    fm.user_id,
    fm.role,
    au.email,
    fm.created_at
  from family_members fm
  join auth.users au on au.id = fm.user_id
  where fm.family_id = target_family_id
  and target_family_id in (select my_family_ids())
  order by
    case fm.role
      when 'owner' then 0
      when 'admin' then 1
      else 2
    end,
    fm.created_at asc;
$$;

-- ─── 3. Server-side dissolve_family function ───
-- Uses SECURITY DEFINER to bypass RLS and cleanly delete everything

create or replace function dissolve_family(target_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify caller is the family owner
  if not exists (
    select 1 from family_members
    where family_id = target_family_id
    and user_id = auth.uid()
    and role = 'owner'
  ) then
    raise exception 'Only the family owner can dissolve the family';
  end if;

  -- Delete all cats in this family (ON DELETE CASCADE removes related records)
  delete from cats where family_id = target_family_id;

  -- Delete all family members
  delete from family_members where family_id = target_family_id;

  -- Delete the family itself
  delete from families where id = target_family_id;
end;
$$;
