-- Citizens Bible Community initial schema
-- Run in Supabase SQL editor or via CLI

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  host_id uuid references public.profiles (id),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  stream_url text,
  viewer_count int default 0,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  content text not null,
  is_anonymous boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  body text not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.live_streams enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.community_posts enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "Live streams are viewable by authenticated users" on public.live_streams;
create policy "Live streams are viewable by authenticated users"
  on public.live_streams for select to authenticated using (true);

drop policy if exists "Prayer requests are viewable by authenticated users" on public.prayer_requests;
create policy "Prayer requests are viewable by authenticated users"
  on public.prayer_requests for select to authenticated using (true);

drop policy if exists "Users can insert own prayer requests" on public.prayer_requests;
create policy "Users can insert own prayer requests"
  on public.prayer_requests for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Community posts are viewable by authenticated users" on public.community_posts;
create policy "Community posts are viewable by authenticated users"
  on public.community_posts for select to authenticated using (true);

drop policy if exists "Users can insert own community posts" on public.community_posts;
create policy "Users can insert own community posts"
  on public.community_posts for insert to authenticated with check (auth.uid() = user_id);
