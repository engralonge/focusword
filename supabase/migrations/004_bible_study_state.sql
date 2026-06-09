-- Durable user Bible study state.

create table if not exists public.bible_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book text not null,
  chapter integer not null check (chapter > 0),
  verse integer not null check (verse > 0),
  translation text not null check (translation in ('KJV', 'NIV', 'ESV')),
  kind text not null check (kind in ('highlight', 'bookmark', 'note')),
  note text check (note is null or char_length(note) <= 5000),
  color text check (color is null or char_length(color) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book, chapter, verse, translation, kind)
);

create table if not exists public.bible_reading_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  book text not null,
  chapter integer not null check (chapter > 0),
  verse integer check (verse is null or verse > 0),
  translation text not null check (translation in ('KJV', 'NIV', 'ESV')),
  updated_at timestamptz not null default now()
);

drop trigger if exists bible_annotations_set_updated_at on public.bible_annotations;
create trigger bible_annotations_set_updated_at
before update on public.bible_annotations
for each row execute function public.set_updated_at();

drop trigger if exists bible_reading_progress_set_updated_at on public.bible_reading_progress;
create trigger bible_reading_progress_set_updated_at
before update on public.bible_reading_progress
for each row execute function public.set_updated_at();

alter table public.bible_annotations enable row level security;
alter table public.bible_reading_progress enable row level security;

create policy "Users manage own Bible annotations"
  on public.bible_annotations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own reading progress"
  on public.bible_reading_progress for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists bible_annotations_user_kind_updated_idx
  on public.bible_annotations (user_id, kind, updated_at desc);
create index if not exists bible_annotations_reference_idx
  on public.bible_annotations (user_id, book, chapter, translation);
