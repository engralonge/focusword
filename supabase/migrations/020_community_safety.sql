-- Member reporting, blocking, sanctions, moderator review, and audit history.

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'banned')),
  add column if not exists suspended_until timestamptz;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (
    target_type in (
      'user',
      'community_post',
      'community_comment',
      'prayer_request',
      'prayer_update',
      'live_stream',
      'live_message'
    )
  ),
  target_id uuid not null,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (
    reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'misinformation', 'other')
  ),
  details text check (details is null or char_length(details) <= 1000),
  content_excerpt text check (
    content_excerpt is null or char_length(content_excerpt) <= 500
  ),
  target_display_name text not null check (
    char_length(target_display_name) between 1 and 80
  ),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text check (
    resolution_note is null or char_length(resolution_note) <= 1000
  ),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create table if not exists public.user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('suspension', 'ban')),
  reason text not null check (char_length(reason) between 3 and 1000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  check (
    (kind = 'ban' and ends_at is null)
    or (kind = 'suspension' and ends_at is not null and ends_at > starts_at)
  )
);

create table if not exists public.moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (
    action in (
      'report_reviewing',
      'report_dismissed',
      'content_hidden',
      'content_removed',
      'user_suspended',
      'user_banned',
      'sanction_revoked'
    )
  ),
  report_id uuid references public.content_reports (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  target_type text,
  target_id uuid,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;
alter table public.user_sanctions enable row level security;
alter table public.moderation_audit_log enable row level security;

create or replace function public.is_account_active(requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = requested_user_id
      and (
        account_status = 'active'
        or (
          account_status = 'suspended'
          and suspended_until is not null
          and suspended_until <= now()
        )
      )
  );
$$;

create or replace function public.has_block_relationship(left_user_id uuid, right_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_id = left_user_id and blocked_id = right_user_id)
       or (blocker_id = right_user_id and blocked_id = left_user_id)
  );
$$;

revoke all on function public.is_account_active(uuid) from public, anon;
grant execute on function public.is_account_active(uuid) to authenticated;
revoke all on function public.has_block_relationship(uuid, uuid) from public, anon;
grant execute on function public.has_block_relationship(uuid, uuid) to authenticated;

create policy "Users view own blocks"
  on public.user_blocks for select
  to authenticated using (blocker_id = auth.uid());
create policy "Users create own blocks"
  on public.user_blocks for insert
  to authenticated with check (
    blocker_id = auth.uid()
    and blocked_id <> auth.uid()
    and public.is_account_active()
  );
create policy "Users remove own blocks"
  on public.user_blocks for delete
  to authenticated using (blocker_id = auth.uid());

create policy "Users view own reports"
  on public.content_reports for select
  to authenticated using (reporter_id = auth.uid() or public.is_moderator());
create policy "Moderators view sanctions"
  on public.user_sanctions for select
  to authenticated using (public.is_moderator() or user_id = auth.uid());
create policy "Moderators view audit history"
  on public.moderation_audit_log for select
  to authenticated using (public.is_moderator());

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
      select id, coalesce(bio, display_name)
      into target_owner, target_excerpt
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
    reporter_id,
    target_type,
    target_id,
    target_user_id,
    reason,
    details,
    content_excerpt,
    target_display_name
  )
  values (
    auth.uid(),
    requested_target_type,
    requested_target_id,
    target_owner,
    requested_reason,
    nullif(trim(requested_details), ''),
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

create or replace function public.apply_user_sanction(
  requested_user_id uuid,
  requested_kind text,
  requested_reason text,
  requested_duration_hours integer default null,
  requested_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sanction_id uuid;
  sanction_end timestamptz;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;
  if requested_user_id = auth.uid() then
    raise exception 'You cannot sanction your own account';
  end if;
  if requested_kind not in ('suspension', 'ban') then
    raise exception 'Unsupported sanction';
  end if;
  if char_length(trim(requested_reason)) not between 3 and 1000 then
    raise exception 'Provide a reason between 3 and 1,000 characters';
  end if;
  if requested_kind = 'suspension' then
    if requested_duration_hours is null or requested_duration_hours not between 1 and 8760 then
      raise exception 'Suspensions must be between 1 hour and 1 year';
    end if;
    sanction_end := now() + make_interval(hours => requested_duration_hours);
  end if;

  update public.user_sanctions
  set active = false, revoked_at = now(), revoked_by = auth.uid()
  where user_id = requested_user_id and active;

  insert into public.user_sanctions (
    user_id, kind, reason, ends_at, created_by
  )
  values (
    requested_user_id, requested_kind, trim(requested_reason), sanction_end, auth.uid()
  )
  returning id into sanction_id;

  update public.profiles
  set
    account_status = case requested_kind when 'ban' then 'banned' else 'suspended' end,
    suspended_until = sanction_end
  where id = requested_user_id;

  if requested_report_id is not null then
    update public.content_reports
    set
      status = 'resolved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      resolution_note = trim(requested_reason)
    where id = requested_report_id;
  end if;

  insert into public.moderation_audit_log (
    moderator_id, action, report_id, target_user_id, note
  )
  values (
    auth.uid(),
    case requested_kind when 'ban' then 'user_banned' else 'user_suspended' end,
    requested_report_id,
    requested_user_id,
    trim(requested_reason)
  );

  return sanction_id;
end;
$$;

create or replace function public.revoke_user_sanction(
  requested_user_id uuid,
  requested_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  update public.user_sanctions
  set active = false, revoked_at = now(), revoked_by = auth.uid()
  where user_id = requested_user_id and active;

  update public.profiles
  set account_status = 'active', suspended_until = null
  where id = requested_user_id;

  insert into public.moderation_audit_log (
    moderator_id, action, target_user_id, note
  )
  values (
    auth.uid(), 'sanction_revoked', requested_user_id, nullif(trim(requested_reason), '')
  );
end;
$$;

revoke all on function public.moderate_report(uuid, text, text) from public, anon;
grant execute on function public.moderate_report(uuid, text, text) to authenticated;
revoke all on function public.apply_user_sanction(uuid, text, text, integer, uuid)
  from public, anon;
grant execute on function public.apply_user_sanction(uuid, text, text, integer, uuid)
  to authenticated;
revoke all on function public.revoke_user_sanction(uuid, text) from public, anon;
grant execute on function public.revoke_user_sanction(uuid, text) to authenticated;

-- Restrictive policies are combined with existing ownership/publication policies.
create policy "Active accounts use community posts"
  on public.community_posts as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());
create policy "Blocked community posts are hidden"
  on public.community_posts as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), user_id)
  );

create policy "Active accounts use community comments"
  on public.community_comments as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());
create policy "Blocked community comments are hidden"
  on public.community_comments as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), user_id)
  );

create policy "Active accounts use prayer requests"
  on public.prayer_requests as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());
create policy "Blocked prayer requests are hidden"
  on public.prayer_requests as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), user_id)
  );

create policy "Active accounts use prayer updates"
  on public.prayer_updates as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());
create policy "Blocked prayer updates are hidden"
  on public.prayer_updates as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), user_id)
  );

create policy "Active accounts use live streams"
  on public.live_streams as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());
create policy "Blocked live hosts are hidden"
  on public.live_streams as restrictive for select to authenticated
  using (
    host_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), host_id)
  );

create policy "Active accounts use live messages"
  on public.live_messages as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());
create policy "Blocked live messages are hidden"
  on public.live_messages as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), user_id)
  );

create policy "Active accounts use community reactions"
  on public.community_reactions as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());
create policy "Blocked reactions are hidden"
  on public.community_reactions as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), user_id)
  );

create policy "Active accounts use prayer support"
  on public.prayer_support as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());
create policy "Blocked prayer support is hidden"
  on public.prayer_support as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), user_id)
  );

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id);
create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at);
create index if not exists content_reports_target_user_idx
  on public.content_reports (target_user_id, created_at desc);
create index if not exists user_sanctions_user_active_idx
  on public.user_sanctions (user_id, active);
create index if not exists moderation_audit_created_idx
  on public.moderation_audit_log (created_at desc);
