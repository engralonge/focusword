-- Admin-only platform health, people management, and audited operational actions.

alter table public.app_error_events
  add column if not exists status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (
    action in (
      'role_changed',
      'notification_retried',
      'error_acknowledged',
      'error_resolved',
      'live_stream_ended'
    )
  ),
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy "Administrators view operations audit"
  on public.admin_audit_log for select
  to authenticated using (public.is_admin());

create index if not exists app_error_events_status_created_idx
  on public.app_error_events (status, created_at desc);
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'members', (select count(*) from public.profiles),
      'newMembers7d', (
        select count(*) from public.profiles
        where created_at >= now() - interval '7 days'
      ),
      'liveNow', (
        select count(*) from public.live_streams where status = 'live'
      ),
      'scheduledStudies', (
        select count(*) from public.live_streams where status = 'scheduled'
      ),
      'openReports', (
        select count(*) from public.content_reports
        where status in ('open', 'reviewing')
      ),
      'activeSanctions', (
        select count(*) from public.user_sanctions
        where active and (kind = 'ban' or ends_at > now())
      ),
      'openErrors', (
        select count(*) from public.app_error_events where status = 'open'
      ),
      'failedPushes', (
        select count(*) from public.notification_deliveries
        where status in ('failed', 'partial')
      ),
      'enabledDevices', (
        select count(*) from public.push_tokens where enabled
      ),
      'posts7d', (
        select count(*) from public.community_posts
        where created_at >= now() - interval '7 days'
      ),
      'prayers7d', (
        select count(*) from public.prayer_requests
        where created_at >= now() - interval '7 days'
      )
    ),
    'liveStreams', coalesce((
      select jsonb_agg(item order by item->>'createdAt' desc)
      from (
        select jsonb_build_object(
          'id', stream.id,
          'title', stream.title,
          'hostName', coalesce(nullif(trim(profile.display_name), ''), 'Community member'),
          'status', stream.status,
          'viewerCount', coalesce(stream.viewer_count, 0),
          'createdAt', stream.created_at
        ) as item
        from public.live_streams as stream
        left join public.profiles as profile on profile.id = stream.host_id
        where stream.status in ('live', 'scheduled')
        order by stream.created_at desc
        limit 20
      ) rows
    ), '[]'::jsonb),
    'errors', coalesce((
      select jsonb_agg(item order by item->>'createdAt' desc)
      from (
        select jsonb_build_object(
          'id', error_event.id,
          'message', error_event.message,
          'platform', error_event.platform,
          'environment', error_event.environment,
          'status', error_event.status,
          'context', error_event.context,
          'userName', coalesce(nullif(trim(profile.display_name), ''), 'Community member'),
          'createdAt', error_event.created_at
        ) as item
        from public.app_error_events as error_event
        left join public.profiles as profile on profile.id = error_event.user_id
        order by
          case error_event.status when 'open' then 0 when 'acknowledged' then 1 else 2 end,
          error_event.created_at desc
        limit 30
      ) rows
    ), '[]'::jsonb),
    'deliveries', coalesce((
      select jsonb_agg(item order by item->>'createdAt' desc)
      from (
        select jsonb_build_object(
          'id', delivery.id,
          'status', delivery.status,
          'attemptCount', delivery.attempt_count,
          'lastError', delivery.last_error,
          'title', activity.title,
          'userName', coalesce(nullif(trim(profile.display_name), ''), 'Community member'),
          'createdAt', delivery.created_at
        ) as item
        from public.notification_deliveries as delivery
        join public.activity_events as activity on activity.id = delivery.activity_event_id
        left join public.profiles as profile on profile.id = delivery.user_id
        where delivery.status in ('failed', 'partial', 'sending')
        order by delivery.created_at desc
        limit 30
      ) rows
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(item order by item->>'createdAt' desc)
      from (
        select jsonb_build_object(
          'id', audit.id,
          'action', audit.action,
          'targetType', audit.target_type,
          'details', audit.details,
          'adminName', coalesce(nullif(trim(profile.display_name), ''), 'Administrator'),
          'createdAt', audit.created_at
        ) as item
        from public.admin_audit_log as audit
        left join public.profiles as profile on profile.id = audit.admin_id
        order by audit.created_at desc
        limit 30
      ) rows
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_search_users(
  requested_query text default '',
  requested_limit integer default 40
)
returns table (
  id uuid,
  display_name text,
  email text,
  role text,
  account_status text,
  suspended_until timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  return query
  select
    profile.id,
    coalesce(nullif(trim(profile.display_name), ''), 'Community member'),
    auth_user.email::text,
    profile.role,
    profile.account_status,
    profile.suspended_until,
    profile.created_at
  from public.profiles as profile
  join auth.users as auth_user on auth_user.id = profile.id
  where trim(coalesce(requested_query, '')) = ''
    or profile.display_name ilike '%' || trim(requested_query) || '%'
    or auth_user.email ilike '%' || trim(requested_query) || '%'
  order by profile.created_at desc
  limit least(greatest(requested_limit, 1), 100);
end;
$$;

create or replace function public.admin_set_user_role(
  requested_user_id uuid,
  requested_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_role text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if requested_role not in ('member', 'moderator', 'admin') then
    raise exception 'Unsupported account role';
  end if;
  if requested_user_id = auth.uid() and requested_role <> 'admin' then
    raise exception 'You cannot remove your own administrator access';
  end if;

  select role into previous_role
  from public.profiles
  where id = requested_user_id
  for update;
  if previous_role is null then
    raise exception 'Account not found';
  end if;

  update public.profiles
  set role = requested_role
  where id = requested_user_id;

  if previous_role is distinct from requested_role then
    insert into public.admin_audit_log (
      admin_id, action, target_type, target_id, details
    )
    values (
      auth.uid(),
      'role_changed',
      'user',
      requested_user_id,
      jsonb_build_object('from', previous_role, 'to', requested_role)
    );
  end if;
end;
$$;

create or replace function public.admin_retry_notification(requested_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  update public.notification_deliveries
  set
    status = 'pending',
    last_error = null,
    sent_at = null
  where id = requested_delivery_id
    and status in ('failed', 'partial', 'sending');
  if not found then
    raise exception 'Retryable notification delivery not found';
  end if;

  insert into public.admin_audit_log (
    admin_id, action, target_type, target_id
  )
  values (
    auth.uid(), 'notification_retried', 'notification_delivery', requested_delivery_id
  );
end;
$$;

create or replace function public.admin_review_error(
  requested_error_id uuid,
  requested_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if requested_status not in ('acknowledged', 'resolved') then
    raise exception 'Unsupported error status';
  end if;

  update public.app_error_events
  set
    status = requested_status,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = requested_error_id;
  if not found then
    raise exception 'Error event not found';
  end if;

  insert into public.admin_audit_log (
    admin_id, action, target_type, target_id
  )
  values (
    auth.uid(),
    case requested_status
      when 'resolved' then 'error_resolved'
      else 'error_acknowledged'
    end,
    'app_error',
    requested_error_id
  );
end;
$$;

create or replace function public.admin_end_live_stream(requested_stream_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stream_title text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  update public.live_streams
  set status = 'ended', viewer_count = 0, updated_at = now()
  where id = requested_stream_id and status in ('live', 'scheduled')
  returning title into stream_title;
  if stream_title is null then
    raise exception 'Active live study not found';
  end if;

  update public.live_stage_requests
  set status = 'removed', updated_at = now()
  where stream_id = requested_stream_id
    and status in ('pending', 'invited', 'approved');

  insert into public.admin_audit_log (
    admin_id, action, target_type, target_id, details
  )
  values (
    auth.uid(),
    'live_stream_ended',
    'live_stream',
    requested_stream_id,
    jsonb_build_object('title', stream_title)
  );
end;
$$;

revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
revoke all on function public.admin_search_users(text, integer) from public, anon;
grant execute on function public.admin_search_users(text, integer) to authenticated;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
revoke all on function public.admin_retry_notification(uuid) from public, anon;
grant execute on function public.admin_retry_notification(uuid) to authenticated;
revoke all on function public.admin_review_error(uuid, text) from public, anon;
grant execute on function public.admin_review_error(uuid, text) to authenticated;
revoke all on function public.admin_end_live_stream(uuid) from public, anon;
grant execute on function public.admin_end_live_stream(uuid) to authenticated;
