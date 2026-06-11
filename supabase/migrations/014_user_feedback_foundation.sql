-- User-feedback foundation: avatars, activity inbox, and recorded-study catalog.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users upload own avatar images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users replace own avatar images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users remove own avatar images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (
    kind in (
      'comment',
      'reaction',
      'prayer_support',
      'stage_invitation',
      'stage_update',
      'points'
    )
  ),
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 500),
  url text check (url is null or char_length(url) <= 500),
  entity_type text not null check (char_length(entity_type) between 1 and 40),
  entity_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, actor_id, kind, entity_type, entity_id)
);

alter table public.activity_events enable row level security;

create policy "Users view own activity"
  on public.activity_events for select
  to authenticated using (user_id = auth.uid());

create policy "Users mark own activity read"
  on public.activity_events for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.protect_activity_event_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.actor_id is distinct from old.actor_id
    or new.kind is distinct from old.kind
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.url is distinct from old.url
    or new.entity_type is distinct from old.entity_type
    or new.entity_id is distinct from old.entity_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Only activity read status can be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists activity_events_protect_content on public.activity_events;
create trigger activity_events_protect_content
before update on public.activity_events
for each row execute function public.protect_activity_event_content();

create index if not exists activity_events_user_created_idx
  on public.activity_events (user_id, created_at desc);
create index if not exists activity_events_user_unread_idx
  on public.activity_events (user_id, read_at)
  where read_at is null;

create or replace function public.add_activity_event(
  recipient_id uuid,
  activity_actor_id uuid,
  activity_kind text,
  activity_title text,
  activity_body text,
  activity_url text,
  activity_entity_type text,
  activity_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if recipient_id is null or recipient_id = activity_actor_id then
    return;
  end if;

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
  values (
    recipient_id,
    activity_actor_id,
    activity_kind,
    activity_title,
    activity_body,
    activity_url,
    activity_entity_type,
    activity_entity_id
  )
  on conflict (user_id, kind, entity_type, entity_id) do nothing;
end;
$$;

revoke all on function public.add_activity_event(
  uuid, uuid, text, text, text, text, text, uuid
) from public, anon, authenticated;

create or replace function public.activity_from_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner
  from public.community_posts
  where id = new.post_id;

  perform public.add_activity_event(
    post_owner,
    new.user_id,
    'comment',
    'New response to your reflection',
    left(new.body, 180),
    'focusword://community',
    'community_comment',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists community_comments_create_activity
  on public.community_comments;
create trigger community_comments_create_activity
after insert on public.community_comments
for each row execute function public.activity_from_comment();

create or replace function public.activity_from_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner
  from public.community_posts
  where id = new.post_id;

  perform public.add_activity_event(
    post_owner,
    new.user_id,
    'reaction',
    'Someone appreciated your reflection',
    null,
    'focusword://community',
    'community_reaction',
    new.post_id
  );
  return new;
end;
$$;

drop trigger if exists community_reactions_create_activity
  on public.community_reactions;
create trigger community_reactions_create_activity
after insert on public.community_reactions
for each row execute function public.activity_from_reaction();

create or replace function public.activity_from_prayer_support()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prayer_owner uuid;
begin
  select user_id into prayer_owner
  from public.prayer_requests
  where id = new.prayer_id;

  perform public.add_activity_event(
    prayer_owner,
    new.user_id,
    'prayer_support',
    'Someone prayed with you',
    null,
    'focusword://prayer',
    'prayer_support',
    new.prayer_id
  );
  return new;
end;
$$;

drop trigger if exists prayer_support_create_activity on public.prayer_support;
create trigger prayer_support_create_activity
after insert on public.prayer_support
for each row execute function public.activity_from_prayer_support();

create or replace function public.activity_from_stage_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  stream_host uuid;
  stream_title text;
begin
  select host_id, title into stream_host, stream_title
  from public.live_streams
  where id = new.stream_id;

  if new.status = 'invited' and old.status is distinct from 'invited' then
    perform public.add_activity_event(
      new.user_id,
      stream_host,
      'stage_invitation',
      'Invitation to join the live stage',
      stream_title,
      'focusword://live/' || new.stream_id::text,
      'live_stage_invitation',
      new.id
    );
  elsif new.status in ('approved', 'declined', 'removed')
    and old.status is distinct from new.status then
    perform public.add_activity_event(
      new.user_id,
      stream_host,
      'stage_update',
      case new.status
        when 'approved' then 'Your live-stage request was approved'
        when 'declined' then 'Your live-stage request was declined'
        else 'You left the live stage'
      end,
      stream_title,
      'focusword://live/' || new.stream_id::text,
      'live_stage_update',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists live_stage_requests_create_activity
  on public.live_stage_requests;
create trigger live_stage_requests_create_activity
after update on public.live_stage_requests
for each row execute function public.activity_from_stage_request();

create or replace function public.activity_from_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
  values (
    new.user_id,
    null,
    'points',
    'Community points earned',
    '+' || new.points::text || ' points for ' || replace(new.kind, '_', ' '),
    'focusword://profile/points',
    'community_points',
    new.id
  )
  on conflict (user_id, kind, entity_type, entity_id) do nothing;
  return new;
end;
$$;

drop trigger if exists community_points_create_activity
  on public.community_point_events;
create trigger community_points_create_activity
after insert on public.community_point_events
for each row execute function public.activity_from_points();

alter table public.live_streams
  add column if not exists recording_requested boolean not null default false;

create table if not exists public.live_recordings (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null unique references public.live_streams (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'recording', 'processing', 'ready', 'failed')),
  egress_id text,
  playback_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  created_at timestamptz not null default now(),
  ready_at timestamptz
);

alter table public.live_recordings enable row level security;

create policy "Ready recordings are viewable"
  on public.live_recordings for select
  to authenticated
  using (
    status = 'ready'
    or public.is_moderator()
    or exists (
      select 1
      from public.live_streams
      where live_streams.id = live_recordings.stream_id
        and live_streams.host_id = auth.uid()
    )
  );

create index if not exists live_recordings_ready_idx
  on public.live_recordings (ready_at desc)
  where status = 'ready';

create or replace function public.create_requested_recording()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recording_requested then
    insert into public.live_recordings (stream_id)
    values (new.id)
    on conflict (stream_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists live_streams_create_recording on public.live_streams;
create trigger live_streams_create_recording
after insert on public.live_streams
for each row execute function public.create_requested_recording();
