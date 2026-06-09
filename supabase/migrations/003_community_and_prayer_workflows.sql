-- Community ownership, moderation, comments, reactions, and prayer support.

alter table public.profiles
  add column if not exists bio text,
  add column if not exists role text not null default 'member'
    check (role in ('member', 'moderator', 'admin'));

alter table public.community_posts
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists status text not null default 'published'
    check (status in ('published', 'hidden', 'removed'));

alter table public.prayer_requests
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists status text not null default 'published'
    check (status in ('published', 'answered', 'hidden', 'removed'));

drop trigger if exists community_posts_set_updated_at on public.community_posts;
create trigger community_posts_set_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at();

drop trigger if exists prayer_requests_set_updated_at on public.prayer_requests;
create trigger prayer_requests_set_updated_at
before update on public.prayer_requests
for each row execute function public.set_updated_at();

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_reactions (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'like' check (kind in ('like', 'amen')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create table if not exists public.prayer_support (
  prayer_id uuid not null references public.prayer_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prayer_id, user_id)
);

drop trigger if exists community_comments_set_updated_at on public.community_comments;
create trigger community_comments_set_updated_at
before update on public.community_comments
for each row execute function public.set_updated_at();

alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.prayer_support enable row level security;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('moderator', 'admin')
  );
$$;

drop policy if exists "Community posts are viewable by authenticated users" on public.community_posts;
create policy "Published community posts are viewable"
  on public.community_posts for select
  to authenticated
  using (status = 'published' or user_id = auth.uid() or public.is_moderator());

drop policy if exists "Users can insert own community posts" on public.community_posts;
create policy "Users can create community posts"
  on public.community_posts for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'published');

create policy "Users can update own community posts"
  on public.community_posts for update
  to authenticated
  using (user_id = auth.uid() or public.is_moderator())
  with check (user_id = auth.uid() or public.is_moderator());

create policy "Users can delete own community posts"
  on public.community_posts for delete
  to authenticated
  using (user_id = auth.uid() or public.is_moderator());

drop policy if exists "Prayer requests are viewable by authenticated users" on public.prayer_requests;
create policy "Published prayer requests are viewable"
  on public.prayer_requests for select
  to authenticated
  using (
    status in ('published', 'answered')
    or user_id = auth.uid()
    or public.is_moderator()
  );

drop policy if exists "Users can insert own prayer requests" on public.prayer_requests;
create policy "Users can create prayer requests"
  on public.prayer_requests for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'published');

create policy "Users can update own prayer requests"
  on public.prayer_requests for update
  to authenticated
  using (user_id = auth.uid() or public.is_moderator())
  with check (user_id = auth.uid() or public.is_moderator());

create policy "Users can delete own prayer requests"
  on public.prayer_requests for delete
  to authenticated
  using (user_id = auth.uid() or public.is_moderator());

create policy "Published comments are viewable"
  on public.community_comments for select
  to authenticated
  using (status = 'published' or user_id = auth.uid() or public.is_moderator());

create policy "Users can create comments"
  on public.community_comments for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'published');

create policy "Users can update own comments"
  on public.community_comments for update
  to authenticated
  using (user_id = auth.uid() or public.is_moderator())
  with check (user_id = auth.uid() or public.is_moderator());

create policy "Users can delete own comments"
  on public.community_comments for delete
  to authenticated
  using (user_id = auth.uid() or public.is_moderator());

create policy "Reactions are viewable"
  on public.community_reactions for select
  to authenticated using (true);
create policy "Users can add own reactions"
  on public.community_reactions for insert
  to authenticated with check (user_id = auth.uid());
create policy "Users can remove own reactions"
  on public.community_reactions for delete
  to authenticated using (user_id = auth.uid());

create policy "Prayer support is viewable"
  on public.prayer_support for select
  to authenticated using (true);
create policy "Users can add own prayer support"
  on public.prayer_support for insert
  to authenticated with check (user_id = auth.uid());
create policy "Users can remove own prayer support"
  on public.prayer_support for delete
  to authenticated using (user_id = auth.uid());

create index if not exists community_comments_post_created_idx
  on public.community_comments (post_id, created_at);
create index if not exists community_reactions_post_idx
  on public.community_reactions (post_id);
create index if not exists prayer_support_prayer_idx
  on public.prayer_support (prayer_id);
