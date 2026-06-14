-- Member comments, encouragement, and moderation for prayer requests.

create table if not exists public.prayer_comments (
  id uuid primary key default gen_random_uuid(),
  prayer_id uuid not null references public.prayer_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'published'
    check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists prayer_comments_set_updated_at on public.prayer_comments;
create trigger prayer_comments_set_updated_at
before update on public.prayer_comments
for each row execute function public.set_updated_at();

alter table public.prayer_comments enable row level security;

create policy "Published prayer comments are viewable"
  on public.prayer_comments for select
  to authenticated
  using (
    (status = 'published' and exists (
      select 1
      from public.prayer_requests
      where prayer_requests.id = prayer_comments.prayer_id
        and prayer_requests.status in ('published', 'answered')
    ))
    or user_id = auth.uid()
    or public.is_moderator()
  );

create policy "Users can create prayer comments"
  on public.prayer_comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'published'
    and exists (
      select 1
      from public.prayer_requests
      where prayer_requests.id = prayer_comments.prayer_id
        and prayer_requests.status in ('published', 'answered')
    )
  );

create policy "Users can update own prayer comments"
  on public.prayer_comments for update
  to authenticated
  using (user_id = auth.uid() or public.is_moderator())
  with check (user_id = auth.uid() or public.is_moderator());

create policy "Users can delete own prayer comments"
  on public.prayer_comments for delete
  to authenticated
  using (user_id = auth.uid() or public.is_moderator());

create policy "Active accounts use prayer comments"
  on public.prayer_comments as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());

create policy "Blocked prayer comments are hidden"
  on public.prayer_comments as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), user_id)
  );

create index if not exists prayer_comments_prayer_created_idx
  on public.prayer_comments (prayer_id, created_at);

alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;
alter table public.content_reports
  add constraint content_reports_target_type_check check (
    target_type in (
      'user',
      'community_post',
      'community_comment',
      'prayer_request',
      'prayer_comment',
      'prayer_update',
      'live_stream',
      'live_message'
    )
  );

alter table public.activity_events
  drop constraint if exists activity_events_kind_check;
alter table public.activity_events
  add constraint activity_events_kind_check check (
    kind in (
      'comment',
      'reaction',
      'prayer_comment',
      'prayer_support',
      'stage_invitation',
      'stage_update',
      'points',
      'live_reminder'
    )
  );

create or replace function public.activity_from_prayer_comment()
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
    'prayer_comment',
    'New encouragement on your prayer',
    left(new.body, 180),
    'focusword://prayer',
    'prayer_comment',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists prayer_comments_create_activity on public.prayer_comments;
create trigger prayer_comments_create_activity
after insert on public.prayer_comments
for each row execute function public.activity_from_prayer_comment();

create or replace function public.notification_category(requested_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when requested_kind in ('stage_invitation', 'stage_update', 'live_reminder') then 'live'
    when requested_kind in ('comment', 'reaction') then 'community'
    when requested_kind in ('prayer_comment', 'prayer_support') then 'prayer'
    when requested_kind = 'points' then 'points'
    else null
  end;
$$;

create or replace function public.report_content(
  requested_target_type text,
  requested_target_id uuid,
  requested_reason text,
  requested_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_owner uuid;
  target_excerpt text;
  target_name text;
  report_id uuid;
begin
  if auth.uid() is null or not public.is_account_active() then
    raise exception 'Your account cannot submit reports';
  end if;
  if requested_reason not in (
    'spam', 'harassment', 'hate', 'sexual', 'violence', 'misinformation', 'other'
  ) then
    raise exception 'Choose a valid report reason';
  end if;
  if char_length(coalesce(requested_details, '')) > 1000 then
    raise exception 'Report details cannot exceed 1,000 characters';
  end if;

  case requested_target_type
    when 'user' then
      select id, coalesce(bio, display_name) into target_owner, target_excerpt
      from public.profiles where id = requested_target_id;
    when 'community_post' then
      select user_id, body into target_owner, target_excerpt
      from public.community_posts where id = requested_target_id;
    when 'community_comment' then
      select user_id, body into target_owner, target_excerpt
      from public.community_comments where id = requested_target_id;
    when 'prayer_request' then
      select user_id, content into target_owner, target_excerpt
      from public.prayer_requests where id = requested_target_id;
    when 'prayer_comment' then
      select user_id, body into target_owner, target_excerpt
      from public.prayer_comments where id = requested_target_id;
    when 'prayer_update' then
      select user_id, body into target_owner, target_excerpt
      from public.prayer_updates where id = requested_target_id;
    when 'live_stream' then
      select host_id, title || coalesce(E'\n' || description, '')
      into target_owner, target_excerpt
      from public.live_streams where id = requested_target_id;
    when 'live_message' then
      select user_id, body into target_owner, target_excerpt
      from public.live_messages where id = requested_target_id;
    else
      raise exception 'Unsupported report target';
  end case;

  if target_owner is null then
    raise exception 'The reported content is no longer available';
  end if;
  if target_owner = auth.uid() then
    raise exception 'You cannot report your own content';
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Community member')
  into target_name
  from public.profiles where id = target_owner;

  insert into public.content_reports (
    reporter_id, target_type, target_id, target_user_id, reason, details,
    content_excerpt, target_display_name
  )
  values (
    auth.uid(), requested_target_type, requested_target_id, target_owner,
    requested_reason, nullif(trim(requested_details), ''),
    left(target_excerpt, 500),
    left(coalesce(target_name, 'Community member'), 80)
  )
  on conflict (reporter_id, target_type, target_id) do update
  set
    reason = excluded.reason,
    details = excluded.details,
    status = 'open',
    reviewed_by = null,
    reviewed_at = null,
    resolution_note = null,
    created_at = now()
  returning id into report_id;

  return report_id;
end;
$$;

revoke all on function public.report_content(text, uuid, text, text) from public, anon;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

create or replace function public.moderate_report(
  requested_report_id uuid,
  requested_action text,
  requested_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_record public.content_reports%rowtype;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;
  if requested_action not in ('reviewing', 'dismiss', 'hide', 'remove') then
    raise exception 'Unsupported moderation action';
  end if;

  select * into report_record
  from public.content_reports
  where id = requested_report_id
  for update;
  if report_record.id is null then
    raise exception 'Report not found';
  end if;

  if requested_action in ('hide', 'remove') then
    case report_record.target_type
      when 'community_post' then
        update public.community_posts
        set status = case requested_action when 'hide' then 'hidden' else 'removed' end
        where id = report_record.target_id;
      when 'community_comment' then
        update public.community_comments
        set status = case requested_action when 'hide' then 'hidden' else 'removed' end
        where id = report_record.target_id;
      when 'prayer_request' then
        update public.prayer_requests
        set status = case requested_action when 'hide' then 'hidden' else 'removed' end
        where id = report_record.target_id;
      when 'prayer_comment' then
        update public.prayer_comments
        set status = case requested_action when 'hide' then 'hidden' else 'removed' end
        where id = report_record.target_id;
      when 'prayer_update' then
        update public.prayer_updates
        set status = case requested_action when 'hide' then 'hidden' else 'removed' end
        where id = report_record.target_id;
      when 'live_message' then
        update public.live_messages
        set status = case requested_action when 'hide' then 'hidden' else 'removed' end
        where id = report_record.target_id;
      when 'live_stream' then
        update public.live_streams set status = 'ended'
        where id = report_record.target_id;
      else
        raise exception 'This report does not contain removable content';
    end case;
  end if;

  update public.content_reports
  set
    status = case
      when requested_action = 'reviewing' then 'reviewing'
      when requested_action = 'dismiss' then 'dismissed'
      else 'resolved'
    end,
    reviewed_by = auth.uid(),
    reviewed_at = case when requested_action = 'reviewing' then null else now() end,
    resolution_note = nullif(trim(requested_note), '')
  where id = requested_report_id;

  insert into public.moderation_audit_log (
    moderator_id, action, report_id, target_user_id, target_type, target_id, note
  )
  values (
    auth.uid(),
    case requested_action
      when 'reviewing' then 'report_reviewing'
      when 'dismiss' then 'report_dismissed'
      when 'hide' then 'content_hidden'
      else 'content_removed'
    end,
    report_record.id,
    report_record.target_user_id,
    report_record.target_type,
    report_record.target_id,
    nullif(trim(requested_note), '')
  );
end;
$$;
