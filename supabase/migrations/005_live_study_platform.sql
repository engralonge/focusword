-- Production live-study scheduling, chat, reminders, and ownership policies.

alter table public.live_streams
  add column if not exists description text,
  add column if not exists room_name text,
  add column if not exists updated_at timestamptz not null default now();

-- Old prototype rows had no required owner and cannot be managed securely.
delete from public.live_streams where host_id is null;

update public.live_streams
set room_name = 'focusword-' || id::text
where room_name is null;

alter table public.live_streams
  alter column host_id set not null,
  alter column room_name set not null,
  alter column viewer_count set default 0,
  alter column created_at set default now();

alter table public.live_streams
  drop constraint if exists live_streams_title_length_check;
alter table public.live_streams
  add constraint live_streams_title_length_check
  check (char_length(title) between 3 and 120);

alter table public.live_streams
  drop constraint if exists live_streams_description_length_check;
alter table public.live_streams
  add constraint live_streams_description_length_check
  check (description is null or char_length(description) <= 2000);

update public.live_streams
set status = 'ended'
where status = 'scheduled' and scheduled_at is null;

alter table public.live_streams
  drop constraint if exists live_streams_schedule_check;
alter table public.live_streams
  add constraint live_streams_schedule_check
  check (status <> 'scheduled' or scheduled_at is not null);

create unique index if not exists live_streams_room_name_key
  on public.live_streams (room_name);

drop trigger if exists live_streams_set_updated_at on public.live_streams;
create trigger live_streams_set_updated_at
before update on public.live_streams
for each row execute function public.set_updated_at();

create table if not exists public.live_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.live_reminders (
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_id text,
  created_at timestamptz not null default now(),
  primary key (stream_id, user_id)
);

alter table public.live_messages enable row level security;
alter table public.live_reminders enable row level security;

drop policy if exists "Live streams are viewable by authenticated users" on public.live_streams;
create policy "Live streams are viewable"
  on public.live_streams for select
  to authenticated using (true);

create policy "Users can create live streams"
  on public.live_streams for insert
  to authenticated with check (host_id = auth.uid());

create policy "Hosts can update own live streams"
  on public.live_streams for update
  to authenticated
  using (host_id = auth.uid() or public.is_moderator())
  with check (host_id = auth.uid() or public.is_moderator());

create policy "Hosts can delete own live streams"
  on public.live_streams for delete
  to authenticated using (host_id = auth.uid() or public.is_moderator());

create policy "Published live messages are viewable"
  on public.live_messages for select
  to authenticated
  using (status = 'published' or user_id = auth.uid() or public.is_moderator());

create policy "Users can post live messages"
  on public.live_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'published'
    and exists (
      select 1 from public.live_streams
      where id = stream_id and status = 'live'
    )
  );

create policy "Users can delete own live messages"
  on public.live_messages for delete
  to authenticated using (user_id = auth.uid() or public.is_moderator());

create policy "Users manage own live reminders"
  on public.live_reminders for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists live_messages_stream_created_idx
  on public.live_messages (stream_id, created_at);
create index if not exists live_reminders_user_idx
  on public.live_reminders (user_id);

do $$
begin
  alter publication supabase_realtime add table public.live_messages;
exception
  when duplicate_object then null;
end;
$$;
