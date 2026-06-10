-- Prayer-linked progress updates and answered-prayer testimonies.

create table if not exists public.prayer_updates (
  id uuid primary key default gen_random_uuid(),
  prayer_id uuid not null references public.prayer_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'update' check (kind in ('update', 'testimony')),
  body text not null check (char_length(body) between 1 and 3000),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);

alter table public.prayer_updates enable row level security;

create policy "Published prayer updates are viewable"
  on public.prayer_updates for select
  to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.prayer_requests
      where prayer_requests.id = prayer_updates.prayer_id
        and prayer_requests.status in ('published', 'answered')
    )
  );

create policy "Prayer owners can add updates"
  on public.prayer_updates for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'published'
    and exists (
      select 1
      from public.prayer_requests
      where prayer_requests.id = prayer_updates.prayer_id
        and prayer_requests.user_id = auth.uid()
        and prayer_requests.status in ('published', 'answered')
    )
  );

create policy "Prayer owners can remove updates"
  on public.prayer_updates for delete
  to authenticated
  using (user_id = auth.uid() or public.is_moderator());

create index if not exists prayer_updates_prayer_created_idx
  on public.prayer_updates (prayer_id, created_at);

do $$
begin
  alter publication supabase_realtime add table public.prayer_updates;
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.publish_prayer_update(
  requested_prayer_id uuid,
  requested_kind text,
  requested_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_update_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if requested_kind not in ('update', 'testimony') then
    raise exception 'Invalid prayer update kind';
  end if;
  if char_length(trim(requested_body)) not between 1 and 3000 then
    raise exception 'Prayer updates must be between 1 and 3,000 characters';
  end if;
  if not exists (
    select 1
    from public.prayer_requests
    where id = requested_prayer_id
      and user_id = auth.uid()
      and status in ('published', 'answered')
  ) then
    raise exception 'Prayer request not found';
  end if;

  insert into public.prayer_updates (
    prayer_id,
    user_id,
    kind,
    body
  )
  values (
    requested_prayer_id,
    auth.uid(),
    requested_kind,
    trim(requested_body)
  )
  returning id into new_update_id;

  if requested_kind = 'testimony' then
    update public.prayer_requests
    set status = 'answered'
    where id = requested_prayer_id
      and user_id = auth.uid();
  end if;

  return new_update_id;
end;
$$;

revoke all on function public.publish_prayer_update(uuid, text, text) from public;
grant execute on function public.publish_prayer_update(uuid, text, text) to authenticated;
