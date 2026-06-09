-- Production auth/profile foundation.

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Adopt profiles created by the legacy Citizens Bible Community schema.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
  ) then
    execute '
      update public.profiles
      set display_name = coalesce(display_name, full_name)
      where display_name is null
    ';
  end if;
end;
$$;

alter table public.community_posts
  add column if not exists body text;

-- Preserve legacy community post content while moving to the current API shape.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'community_posts'
      and column_name = 'content'
  ) then
    execute '
      update public.community_posts
      set body = coalesce(body, content)
      where body is null
    ';
    execute '
      alter table public.community_posts
      alter column content drop not null
    ';
  end if;
end;
$$;

update public.community_posts
set body = ''
where body is null;

alter table public.community_posts
  alter column body set not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for auth users created before this migration.
insert into public.profiles (id, display_name, avatar_url)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
    split_part(users.email, '@', 1)
  ),
  users.raw_user_meta_data ->> 'avatar_url'
from auth.users as users
on conflict (id) do nothing;

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create index if not exists live_streams_status_created_at_idx
  on public.live_streams (status, created_at desc);
create index if not exists prayer_requests_created_at_idx
  on public.prayer_requests (created_at desc);
create index if not exists community_posts_created_at_idx
  on public.community_posts (created_at desc);
