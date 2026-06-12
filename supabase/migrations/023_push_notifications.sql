-- Device push tokens, notification preferences, and server-side delivery queue.

alter table public.activity_events
  drop constraint if exists activity_events_kind_check;
alter table public.activity_events
  add constraint activity_events_kind_check check (
    kind in (
      'comment',
      'reaction',
      'prayer_support',
      'stage_invitation',
      'stage_update',
      'points',
      'live_reminder'
    )
  );

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique check (
    expo_push_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'
  ),
  platform text not null check (platform in ('android', 'ios')),
  device_name text check (device_name is null or char_length(device_name) <= 160),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  live boolean not null default true,
  community boolean not null default true,
  prayer boolean not null default true,
  points boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  activity_event_id uuid not null unique
    references public.activity_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'partial', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_ticket_ids jsonb not null default '[]'::jsonb,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.push_tokens enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "Users view own push tokens"
  on public.push_tokens for select
  to authenticated using (user_id = auth.uid());
create policy "Users register own push tokens"
  on public.push_tokens for insert
  to authenticated with check (user_id = auth.uid() and public.is_account_active());
create policy "Users refresh own push tokens"
  on public.push_tokens for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_account_active());
create policy "Users remove own push tokens"
  on public.push_tokens for delete
  to authenticated using (user_id = auth.uid());

create policy "Users view own notification preferences"
  on public.notification_preferences for select
  to authenticated using (user_id = auth.uid());
create policy "Users create own notification preferences"
  on public.notification_preferences for insert
  to authenticated with check (user_id = auth.uid() and public.is_account_active());
create policy "Users update own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_account_active());

create policy "Users view own notification deliveries"
  on public.notification_deliveries for select
  to authenticated using (user_id = auth.uid() or public.is_moderator());

create or replace function public.register_push_token(
  requested_token text,
  requested_platform text,
  requested_device_name text default null,
  requested_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_id uuid;
begin
  if auth.uid() is null or not public.is_account_active() then
    raise exception 'An active account is required';
  end if;
  if requested_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid Expo push token';
  end if;
  if requested_platform not in ('android', 'ios') then
    raise exception 'Invalid push platform';
  end if;

  insert into public.push_tokens (
    user_id,
    expo_push_token,
    platform,
    device_name,
    app_version,
    enabled,
    last_seen_at
  )
  values (
    auth.uid(),
    requested_token,
    requested_platform,
    left(nullif(trim(requested_device_name), ''), 160),
    left(nullif(trim(requested_app_version), ''), 40),
    true,
    now()
  )
  on conflict (expo_push_token) do update
  set
    user_id = auth.uid(),
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    enabled = true,
    last_seen_at = now()
  returning id into token_id;

  insert into public.notification_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return token_id;
end;
$$;

create or replace function public.unregister_push_token(requested_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens
  where user_id = auth.uid() and expo_push_token = requested_token;
$$;

revoke all on function public.register_push_token(text, text, text, text)
  from public, anon;
grant execute on function public.register_push_token(text, text, text, text)
  to authenticated;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

create or replace function public.notification_category(requested_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when requested_kind in ('stage_invitation', 'stage_update', 'live_reminder') then 'live'
    when requested_kind in ('comment', 'reaction') then 'community'
    when requested_kind = 'prayer_support' then 'prayer'
    when requested_kind = 'points' then 'points'
    else null
  end;
$$;

create or replace function public.queue_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category text;
  preference_enabled boolean;
begin
  category := public.notification_category(new.kind);
  if category is null or not public.is_account_active(new.user_id) then
    return new;
  end if;

  insert into public.notification_preferences (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;

  select case category
    when 'live' then live
    when 'community' then community
    when 'prayer' then prayer
    when 'points' then points
    else false
  end
  into preference_enabled
  from public.notification_preferences
  where user_id = new.user_id;

  insert into public.notification_deliveries (
    activity_event_id,
    user_id,
    status
  )
  values (
    new.id,
    new.user_id,
    case when preference_enabled then 'pending' else 'skipped' end
  )
  on conflict (activity_event_id) do nothing;

  return new;
end;
$$;

drop trigger if exists activity_events_queue_notification on public.activity_events;
create trigger activity_events_queue_notification
after insert on public.activity_events
for each row execute function public.queue_activity_notification();

create or replace function public.enqueue_due_live_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.activity_events (
    user_id,
    actor_id,
    kind,
    title,
    body,
    url,
    entity_type,
    entity_id
  )
  select
    reminder.user_id,
    stream.host_id,
    'live_reminder',
    stream.title || ' starts soon',
    'Join the live Bible study in about 10 minutes.',
    'focusword://live/' || stream.id::text,
    'live_reminder',
    stream.id
  from public.live_reminders as reminder
  join public.live_streams as stream on stream.id = reminder.stream_id
  where stream.status = 'scheduled'
    and stream.scheduled_at > now()
    and stream.scheduled_at <= now() + interval '11 minutes'
    and stream.scheduled_at >= now() + interval '9 minutes'
  on conflict (user_id, kind, entity_type, entity_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.notification_category(text) from public, anon;
revoke all on function public.queue_activity_notification() from public, anon, authenticated;
revoke all on function public.enqueue_due_live_reminders() from public, anon, authenticated;

create index if not exists push_tokens_user_enabled_idx
  on public.push_tokens (user_id, enabled);
create index if not exists notification_deliveries_pending_idx
  on public.notification_deliveries (created_at)
  where status in ('pending', 'failed');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'enqueue-live-study-reminders'
  ) then
    perform cron.schedule(
      'enqueue-live-study-reminders',
      '* * * * *',
      'select public.enqueue_due_live_reminders();'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'deliver-community-push-notifications'
  ) then
    perform cron.schedule(
      'deliver-community-push-notifications',
      '* * * * *',
      $command$
        select net.http_post(
          url := 'https://jmavzlywiqmvvvenewxx.supabase.co/functions/v1/push-notifications',
          headers := '{"Content-Type":"application/json"}'::jsonb,
          body := '{}'::jsonb
        );
      $command$
    );
  end if;
end;
$$;
