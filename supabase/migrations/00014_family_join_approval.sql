-- Family join request workflow: require owner/admin approval before joining

create table if not exists public.family_join_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create unique index if not exists uniq_family_join_pending
  on public.family_join_requests (family_id, user_id)
  where status = 'pending';

alter table public.family_join_requests enable row level security;

drop policy if exists "fjr_select" on public.family_join_requests;
create policy "fjr_select"
  on public.family_join_requests for select
  using (
    user_id = auth.uid()
    or my_family_role(family_id) in ('owner', 'admin')
  );

drop policy if exists "fjr_insert" on public.family_join_requests;
create policy "fjr_insert"
  on public.family_join_requests for insert
  with check (user_id = auth.uid());

drop policy if exists "fjr_update" on public.family_join_requests;
create policy "fjr_update"
  on public.family_join_requests for update
  using (my_family_role(family_id) in ('owner', 'admin'));

create or replace function public.request_join_family_by_code(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family families;
  pending_request_id uuid;
  already_member boolean;
  result json;
begin
  select * into target_family
  from families
  where invite_code = upper(code);

  if target_family.id is null then
    raise exception 'Family not found with this invite code';
  end if;

  select exists(
    select 1 from family_members
    where family_id = target_family.id and user_id = auth.uid()
  ) into already_member;

  if already_member then
    select json_build_object(
      'status', 'already_member',
      'id', target_family.id,
      'name', target_family.name,
      'invite_code', target_family.invite_code
    ) into result;
    return result;
  end if;

  select id into pending_request_id
  from family_join_requests
  where family_id = target_family.id
    and user_id = auth.uid()
    and status = 'pending'
  limit 1;

  if pending_request_id is null then
    insert into family_join_requests (family_id, user_id, status)
    values (target_family.id, auth.uid(), 'pending')
    returning id into pending_request_id;
  end if;

  select json_build_object(
    'status', 'pending',
    'request_id', pending_request_id,
    'id', target_family.id,
    'name', target_family.name,
    'invite_code', target_family.invite_code
  ) into result;

  return result;
end;
$$;

create or replace function public.approve_family_join_request(req_id uuid, approve boolean)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  req family_join_requests;
  role_name text;
  result json;
begin
  select * into req
  from family_join_requests
  where id = req_id
    and status = 'pending'
  for update;

  if req.id is null then
    raise exception 'Pending request not found';
  end if;

  role_name := my_family_role(req.family_id);
  if role_name not in ('owner', 'admin') then
    raise exception 'Only owner/admin can review join requests';
  end if;

  if approve then
    insert into family_members (family_id, user_id, role)
    values (req.family_id, req.user_id, 'member')
    on conflict (family_id, user_id) do nothing;

    update family_join_requests
    set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
    where id = req.id;
  else
    update family_join_requests
    set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
    where id = req.id;
  end if;

  select json_build_object(
    'id', req.id,
    'family_id', req.family_id,
    'user_id', req.user_id,
    'status', case when approve then 'approved' else 'rejected' end
  ) into result;

  return result;
end;
$$;
