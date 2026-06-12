create or replace function public.add_activity_event(
  recipient_id uuid,
  activity_actor_id uuid,
  activity_kind text,
  activity_title text,
  activity_body text,
  activity_url text,
  activity_entity_type text,
  activity_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if recipient_id is null or recipient_id = activity_actor_id then
    return;
  end if;

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
  values (
    recipient_id,
    activity_actor_id,
    activity_kind,
    activity_title,
    activity_body,
    activity_url,
    activity_entity_type,
    activity_entity_id
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.add_activity_event(
  uuid, uuid, text, text, text, text, text, uuid
) from public, anon, authenticated;
