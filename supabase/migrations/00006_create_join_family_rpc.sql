-- =============================================
-- Migration 6: Atomic create/join family RPCs
-- Fixes: RLS family_select blocks reading families you're not yet a member of,
-- causing both create-family (.select after insert) and join-family (lookup by
-- invite_code) to fail for users who aren't already members.
-- =============================================

-- ─── 1. Create family + add owner in one atomic step ───

create or replace function create_family_with_owner(family_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
  invite text;
  result json;
begin
  invite := upper(substr(md5(random()::text), 1, 6));

  insert into families (name, invite_code, created_by)
  values (family_name, invite, auth.uid())
  returning id into new_family_id;

  insert into family_members (family_id, user_id, role)
  values (new_family_id, auth.uid(), 'owner');

  select json_build_object(
    'id', f.id,
    'name', f.name,
    'invite_code', f.invite_code,
    'created_by', f.created_by,
    'created_at', f.created_at
  ) into result
  from families f
  where f.id = new_family_id;

  return result;
end;
$$;

-- ─── 2. Join family by invite code ───

create or replace function join_family_by_code(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family families;
  result json;
begin
  select * into target_family
  from families
  where invite_code = upper(code);

  if target_family.id is null then
    raise exception 'Family not found with this invite code';
  end if;

  insert into family_members (family_id, user_id, role)
  values (target_family.id, auth.uid(), 'member')
  on conflict (family_id, user_id) do nothing;

  select json_build_object(
    'id', f.id,
    'name', f.name,
    'invite_code', f.invite_code,
    'created_by', f.created_by,
    'created_at', f.created_at
  ) into result
  from families f
  where f.id = target_family.id;

  return result;
end;
$$;
