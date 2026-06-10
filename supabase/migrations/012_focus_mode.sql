-- Explicit Focus Mode consent and durable, auditable study sessions.

create table if not exists public.focus_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  consented_at timestamptz not null,
  consent_version text not null default '2026-06'
    check (char_length(consent_version) between 1 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  planned_seconds integer not null check (planned_seconds between 300 and 10800),
  focused_seconds integer not null default 0
    check (focused_seconds >= 0 and focused_seconds <= planned_seconds),
  interruption_count integer not null default 0 check (interruption_count >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

drop trigger if exists focus_preferences_set_updated_at on public.focus_preferences;
create trigger focus_preferences_set_updated_at
before update on public.focus_preferences
for each row execute function public.set_updated_at();

alter table public.focus_preferences enable row level security;
alter table public.focus_sessions enable row level security;

create policy "Users manage own Focus Mode consent"
  on public.focus_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users view own focus sessions"
  on public.focus_sessions for select
  to authenticated using (user_id = auth.uid());

create policy "Users create own focus sessions"
  on public.focus_sessions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and ended_at is null
    and completed = false
    and exists (
      select 1
      from public.focus_preferences
      where focus_preferences.user_id = auth.uid()
    )
  );

create policy "Users update own focus sessions"
  on public.focus_sessions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create unique index if not exists focus_sessions_one_active_per_user_idx
  on public.focus_sessions (user_id)
  where ended_at is null;

create index if not exists focus_sessions_user_started_idx
  on public.focus_sessions (user_id, started_at desc);
