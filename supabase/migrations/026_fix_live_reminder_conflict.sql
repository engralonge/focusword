-- Match live-reminder deduplication to the activity_events unique constraint.

create or replace function public.enqueue_due_live_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.activity_events (
    user_id,
    actor_id,
    kind,
    title,
    body,
    url,
    entity_type,
    entity_id
  )
  select
    reminder.user_id,
    stream.host_id,
    'live_reminder',
    stream.title || ' starts soon',
    'Join the live Bible study in about 10 minutes.',
    'focusword://live/' || stream.id::text,
    'live_reminder',
    stream.id
  from public.live_reminders as reminder
  join public.live_streams as stream on stream.id = reminder.stream_id
  where stream.status = 'scheduled'
    and stream.scheduled_at > now()
    and stream.scheduled_at <= now() + interval '11 minutes'
    and stream.scheduled_at >= now() + interval '9 minutes'
  on conflict (user_id, actor_id, kind, entity_type, entity_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.enqueue_due_live_reminders()
  from public, anon, authenticated;
