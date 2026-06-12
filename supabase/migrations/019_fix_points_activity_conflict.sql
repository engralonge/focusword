create or replace function public.activity_from_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
  values (
    new.user_id,
    null,
    'points',
    'Community points earned',
    '+' || new.points::text || ' points for ' || replace(new.kind, '_', ' '),
    'focusword://profile/points',
    'community_points',
    new.id
  )
  on conflict do nothing;
  return new;
end;
$$;
