alter table public.live_messages
  add column if not exists author_name text;

update public.live_messages as message
set author_name = coalesce(
  nullif(trim(profile.display_name), ''),
  'Member'
)
from public.profiles as profile
where profile.id = message.user_id
  and message.author_name is null;

update public.live_messages
set author_name = 'Member'
where author_name is null;

alter table public.live_messages
  alter column author_name set not null;

create or replace function public.set_live_message_author_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(nullif(trim(display_name), ''), 'Member')
  into new.author_name
  from public.profiles
  where id = new.user_id;

  new.author_name := coalesce(new.author_name, 'Member');
  return new;
end;
$$;

drop trigger if exists set_live_message_author_name on public.live_messages;
create trigger set_live_message_author_name
before insert on public.live_messages
for each row
execute function public.set_live_message_author_name();

create index if not exists live_stage_requests_stream_user_status_idx
  on public.live_stage_requests (stream_id, user_id, status);
