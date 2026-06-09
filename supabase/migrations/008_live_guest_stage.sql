-- Moderated guest-stage requests for interactive live studies.

create table if not exists public.live_stage_requests (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'removed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stream_id, user_id)
);

alter table public.live_stage_requests enable row level security;

drop trigger if exists live_stage_requests_set_updated_at
  on public.live_stage_requests;
create trigger live_stage_requests_set_updated_at
before update on public.live_stage_requests
for each row execute function public.set_updated_at();

create policy "Stage requests are visible to their user and stream host"
  on public.live_stage_requests for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or exists (
      select 1
      from public.live_streams
      where live_streams.id = live_stage_requests.stream_id
        and live_streams.host_id = auth.uid()
    )
  );

create index if not exists live_stage_requests_stream_status_idx
  on public.live_stage_requests (stream_id, status, created_at);

do $$
begin
  alter publication supabase_realtime add table public.live_stage_requests;
exception
  when duplicate_object then null;
end;
$$;

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
      ('livekit_token'::text, 20, 60),
      ('livekit_stage'::text, 60, 60)
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
