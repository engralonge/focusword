-- Non-transferable community points for verified study and service activity.
-- Points have no monetary value and cannot be purchased, redeemed, or transferred.

create table if not exists public.community_point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (
    kind in (
      'focus_completion',
      'community_post',
      'community_comment',
      'prayer_support',
      'testimony',
      'live_host',
      'live_attendance',
      'live_stage'
    )
  ),
  points integer not null check (points between 1 and 100),
  source_type text not null check (char_length(source_type) between 1 and 40),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, source_id)
);

alter table public.community_point_events enable row level security;

create policy "Users view own community point events"
  on public.community_point_events for select
  to authenticated
  using (user_id = auth.uid());

create index if not exists community_point_events_user_created_idx
  on public.community_point_events (user_id, created_at desc);

create or replace function public.prevent_community_point_event_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Community point events are append-only';
end;
$$;

drop trigger if exists community_point_events_immutable
  on public.community_point_events;
create trigger community_point_events_immutable
before update on public.community_point_events
for each row execute function public.prevent_community_point_event_changes();

create or replace function public.award_community_points(
  reward_user_id uuid,
  reward_kind text,
  reward_points integer,
  reward_source_type text,
  reward_source_id uuid,
  daily_event_cap integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  events_today integer;
begin
  if reward_points not between 1 and 100 or daily_event_cap < 1 then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(reward_user_id::text || ':' || reward_kind)
  );

  select count(*)
  into events_today
  from public.community_point_events
  where user_id = reward_user_id
    and kind = reward_kind
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

  if events_today >= daily_event_cap then
    return;
  end if;

  insert into public.community_point_events (
    user_id,
    kind,
    points,
    source_type,
    source_id
  )
  values (
    reward_user_id,
    reward_kind,
    reward_points,
    reward_source_type,
    reward_source_id
  )
  on conflict (user_id, kind, source_id) do nothing;
end;
$$;

revoke all on function public.award_community_points(
  uuid, text, integer, text, uuid, integer
) from public, anon, authenticated;
grant execute on function public.award_community_points(
  uuid, text, integer, text, uuid, integer
) to service_role;

create or replace function public.validate_focus_session_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  elapsed_seconds integer;
begin
  if new.user_id is distinct from old.user_id
    or new.planned_seconds is distinct from old.planned_seconds
    or new.started_at is distinct from old.started_at then
    raise exception 'Focus Mode session identity and schedule are immutable';
  end if;

  if old.ended_at is not null then
    raise exception 'Finished Focus Mode sessions are immutable';
  end if;

  if new.focused_seconds < old.focused_seconds
    or new.interruption_count < old.interruption_count then
    raise exception 'Focus Mode progress cannot move backwards';
  end if;

  elapsed_seconds := greatest(
    0,
    floor(extract(epoch from (now() - old.started_at)))::integer
  );

  if new.focused_seconds > old.focused_seconds
    and new.focused_seconds > elapsed_seconds + 5 then
    raise exception 'Focused time cannot advance faster than elapsed time';
  end if;

  if new.completed
    and (
      new.ended_at is null
      or new.focused_seconds < new.planned_seconds
      or new.planned_seconds < 900
    ) then
    raise exception 'A completed Focus Mode session requires at least 15 focused minutes';
  end if;

  return new;
end;
$$;

drop trigger if exists focus_sessions_validate_progress on public.focus_sessions;
create trigger focus_sessions_validate_progress
before update on public.focus_sessions
for each row execute function public.validate_focus_session_progress();

create or replace function public.reward_focus_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.completed and not old.completed then
    perform public.award_community_points(
      new.user_id,
      'focus_completion',
      least(30, floor(new.focused_seconds / 60.0)::integer),
      'focus_session',
      new.id,
      2
    );
  end if;
  return new;
end;
$$;

drop trigger if exists focus_sessions_reward_completion on public.focus_sessions;
create trigger focus_sessions_reward_completion
after update on public.focus_sessions
for each row execute function public.reward_focus_completion();

create or replace function public.reward_community_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and char_length(trim(new.body)) >= 40 then
    perform public.award_community_points(
      new.user_id, 'community_post', 5, 'community_post', new.id, 2
    );
  end if;
  return new;
end;
$$;

drop trigger if exists community_posts_reward_insert on public.community_posts;
create trigger community_posts_reward_insert
after insert on public.community_posts
for each row execute function public.reward_community_post();

create or replace function public.reward_community_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and char_length(trim(new.body)) >= 20 then
    perform public.award_community_points(
      new.user_id, 'community_comment', 3, 'community_comment', new.id, 5
    );
  end if;
  return new;
end;
$$;

drop trigger if exists community_comments_reward_insert on public.community_comments;
create trigger community_comments_reward_insert
after insert on public.community_comments
for each row execute function public.reward_community_comment();

create or replace function public.reward_prayer_support()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.prayer_requests
    where id = new.prayer_id
      and user_id <> new.user_id
  ) then
    perform public.award_community_points(
      new.user_id, 'prayer_support', 5, 'prayer_request', new.prayer_id, 5
    );
  end if;
  return new;
end;
$$;

drop trigger if exists prayer_support_reward_insert on public.prayer_support;
create trigger prayer_support_reward_insert
after insert on public.prayer_support
for each row execute function public.reward_prayer_support();

create or replace function public.reward_testimony()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'testimony' and new.status = 'published' then
    perform public.award_community_points(
      new.user_id, 'testimony', 15, 'prayer_update', new.id, 1
    );
  end if;
  return new;
end;
$$;

drop trigger if exists prayer_updates_reward_testimony on public.prayer_updates;
create trigger prayer_updates_reward_testimony
after insert on public.prayer_updates
for each row execute function public.reward_testimony();

create table if not exists public.live_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  participant_sid text not null check (char_length(participant_sid) between 1 and 160),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  unique (stream_id, participant_sid)
);

alter table public.live_attendance_sessions enable row level security;

create policy "Users view own live attendance"
  on public.live_attendance_sessions for select
  to authenticated
  using (user_id = auth.uid());

create index if not exists live_attendance_user_stream_idx
  on public.live_attendance_sessions (user_id, stream_id, joined_at);

create or replace function public.record_live_attendance(
  requested_stream_id uuid,
  requested_user_id uuid,
  requested_participant_sid text,
  requested_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stream_host_id uuid;
  attended_seconds integer;
begin
  if requested_action not in ('joined', 'left')
    or char_length(requested_participant_sid) not between 1 and 160 then
    return;
  end if;

  select host_id
  into stream_host_id
  from public.live_streams
  where id = requested_stream_id;

  if stream_host_id is null or requested_user_id = stream_host_id then
    return;
  end if;

  if requested_action = 'joined' then
    insert into public.live_attendance_sessions (
      stream_id,
      user_id,
      participant_sid
    )
    values (
      requested_stream_id,
      requested_user_id,
      requested_participant_sid
    )
    on conflict (stream_id, participant_sid) do nothing;

    if exists (
      select 1
      from public.live_stage_requests
      where stream_id = requested_stream_id
        and user_id = requested_user_id
        and status = 'approved'
    ) then
      perform public.award_community_points(
        requested_user_id,
        'live_stage',
        10,
        'live_stream',
        requested_stream_id,
        3
      );
    end if;
    return;
  end if;

  update public.live_attendance_sessions
  set
    left_at = now(),
    duration_seconds = greatest(
      0,
      floor(extract(epoch from (now() - joined_at)))::integer
    )
  where stream_id = requested_stream_id
    and user_id = requested_user_id
    and participant_sid = requested_participant_sid
    and left_at is null;

  select coalesce(sum(duration_seconds), 0)
  into attended_seconds
  from public.live_attendance_sessions
  where stream_id = requested_stream_id
    and user_id = requested_user_id;

  if attended_seconds >= 900 then
    perform public.award_community_points(
      requested_user_id,
      'live_attendance',
      15,
      'live_stream',
      requested_stream_id,
      3
    );
  end if;
end;
$$;

revoke all on function public.record_live_attendance(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.record_live_attendance(
  uuid, uuid, text, text
) to service_role;

alter table public.live_streams
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;

create or replace function public.track_live_stream_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'live' then
      new.started_at = now();
    else
      new.started_at = null;
    end if;
    new.ended_at = null;
    return new;
  end if;

  new.started_at = old.started_at;
  new.ended_at = old.ended_at;
  if new.status = 'live' and old.status is distinct from 'live' then
    new.started_at = now();
    new.ended_at = null;
  elsif new.status = 'ended' and old.status is distinct from 'ended' then
    new.ended_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists live_streams_track_timestamps on public.live_streams;
create trigger live_streams_track_timestamps
before insert or update on public.live_streams
for each row execute function public.track_live_stream_timestamps();

create or replace function public.reward_live_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ended'
    and old.status is distinct from 'ended'
    and new.started_at is not null
    and new.ended_at >= new.started_at + interval '10 minutes' then
    perform public.award_community_points(
      new.host_id, 'live_host', 20, 'live_stream', new.id, 2
    );
  end if;
  return new;
end;
$$;

drop trigger if exists live_streams_reward_host on public.live_streams;
create trigger live_streams_reward_host
after update on public.live_streams
for each row execute function public.reward_live_host();

create or replace function public.get_my_community_point_summary(
  requested_timezone text default 'UTC'
)
returns table (
  total_points bigint,
  today_points bigint,
  current_streak integer,
  completed_actions bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_timezone text := 'UTC';
  local_today date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select name
  into safe_timezone
  from pg_timezone_names
  where name = requested_timezone
  limit 1;
  safe_timezone := coalesce(safe_timezone, 'UTC');
  local_today := (now() at time zone safe_timezone)::date;

  return query
  with activity_days as (
    select distinct (events.created_at at time zone safe_timezone)::date as activity_day
    from public.community_point_events as events
    where events.user_id = auth.uid()
  ),
  anchor_day as (
    select max(activity_day) as value
    from activity_days
    where activity_day >= local_today - 1
  ),
  numbered_days as (
    select
      activity_days.activity_day,
      row_number() over (order by activity_days.activity_day desc) as position
    from activity_days
    cross join anchor_day
    where activity_days.activity_day <= anchor_day.value
  )
  select
    coalesce((
      select sum(events.points)
      from public.community_point_events as events
      where events.user_id = auth.uid()
    ), 0)::bigint,
    coalesce((
      select sum(events.points)
      from public.community_point_events as events
      where events.user_id = auth.uid()
        and (events.created_at at time zone safe_timezone)::date = local_today
    ), 0)::bigint,
    coalesce((
      select count(*)
      from numbered_days
      cross join anchor_day
      where numbered_days.activity_day =
        anchor_day.value - (numbered_days.position::integer - 1)
    ), 0)::integer,
    (
      select count(*)
      from public.community_point_events as events
      where events.user_id = auth.uid()
    )::bigint;
end;
$$;

revoke all on function public.get_my_community_point_summary(text) from public;
grant execute on function public.get_my_community_point_summary(text) to authenticated;
