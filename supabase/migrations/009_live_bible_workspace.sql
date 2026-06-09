-- Durable, realtime Scripture state shared by everyone in a live study.

create table if not exists public.live_bible_workspaces (
  stream_id uuid primary key references public.live_streams (id) on delete cascade,
  book text not null default 'John' check (char_length(book) between 2 and 64),
  chapter integer not null default 1 check (chapter between 1 and 150),
  translation text not null default 'WEB'
    check (translation in ('WEB', 'KJV', 'NIV', 'ESV')),
  active_verse integer check (active_verse is null or active_verse > 0),
  is_visible boolean not null default false,
  summary text check (summary is null or char_length(summary) <= 12000),
  summary_reference text
    check (summary_reference is null or char_length(summary_reference) <= 120),
  updated_at timestamptz not null default now()
);

alter table public.live_bible_workspaces enable row level security;

drop trigger if exists live_bible_workspaces_set_updated_at
  on public.live_bible_workspaces;
create trigger live_bible_workspaces_set_updated_at
before update on public.live_bible_workspaces
for each row execute function public.set_updated_at();

create policy "Live Bible workspaces are viewable"
  on public.live_bible_workspaces for select
  to authenticated
  using (true);

create policy "Hosts can create their live Bible workspace"
  on public.live_bible_workspaces for insert
  to authenticated
  with check (
    public.is_moderator()
    or exists (
      select 1
      from public.live_streams
      where live_streams.id = live_bible_workspaces.stream_id
        and live_streams.host_id = auth.uid()
    )
  );

create policy "Hosts can update their live Bible workspace"
  on public.live_bible_workspaces for update
  to authenticated
  using (
    public.is_moderator()
    or exists (
      select 1
      from public.live_streams
      where live_streams.id = live_bible_workspaces.stream_id
        and live_streams.host_id = auth.uid()
    )
  )
  with check (
    public.is_moderator()
    or exists (
      select 1
      from public.live_streams
      where live_streams.id = live_bible_workspaces.stream_id
        and live_streams.host_id = auth.uid()
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.live_bible_workspaces;
exception
  when duplicate_object then null;
end;
$$;
