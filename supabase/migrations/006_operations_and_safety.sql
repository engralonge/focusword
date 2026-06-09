-- Operational quotas and authenticated client crash reporting.

delete from public.community_posts where user_id is null;
delete from public.prayer_requests where user_id is null;

alter table public.community_posts
  alter column user_id set not null,
  drop constraint if exists community_posts_user_id_fkey;
alter table public.community_posts
  add constraint community_posts_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.prayer_requests
  alter column user_id set not null,
  drop constraint if exists prayer_requests_user_id_fkey;
alter table public.prayer_requests
  add constraint prayer_requests_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.live_streams
  drop constraint if exists live_streams_host_id_fkey;
alter table public.live_streams
  add constraint live_streams_host_id_fkey
  foreign key (host_id) references public.profiles (id) on delete cascade;

create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  primary key (user_id, action)
);

alter table public.api_rate_limits enable row level security;

create or replace function public.consume_api_quota(requested_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_requests integer;
  window_seconds integer;
  next_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  select limits.max_requests, limits.window_seconds
  into max_requests, window_seconds
  from (
    values
      ('ai_summary'::text, 10, 3600),
      ('bible_content'::text, 120, 60),
      ('livekit_token'::text, 20, 60)
  ) as limits(action, max_requests, window_seconds)
  where limits.action = requested_action;

  if max_requests is null then
    return false;
  end if;

  insert into public.api_rate_limits (
    user_id,
    action,
    window_started_at,
    request_count
  )
  values (auth.uid(), requested_action, now(), 1)
  on conflict (user_id, action) do update
  set
    request_count = case
      when public.api_rate_limits.window_started_at <=
        now() - make_interval(secs => window_seconds)
      then 1
      else public.api_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.api_rate_limits.window_started_at <=
        now() - make_interval(secs => window_seconds)
      then now()
      else public.api_rate_limits.window_started_at
    end
  returning request_count into next_count;

  return next_count <= max_requests;
end;
$$;

revoke all on function public.consume_api_quota(text) from public;
grant execute on function public.consume_api_quota(text) to authenticated;

create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  stack text check (stack is null or char_length(stack) <= 12000),
  context jsonb not null default '{}'::jsonb,
  platform text not null check (platform in ('android', 'ios', 'web', 'windows', 'macos', 'unknown')),
  environment text not null check (environment in ('development', 'preview', 'production')),
  created_at timestamptz not null default now()
);

alter table public.app_error_events enable row level security;

create policy "Users can report own app errors"
  on public.app_error_events for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Moderators can review app errors"
  on public.app_error_events for select
  to authenticated
  using (public.is_moderator());

create index if not exists app_error_events_created_idx
  on public.app_error_events (created_at desc);
