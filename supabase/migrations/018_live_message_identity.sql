create or replace function public.resolve_member_display_name(member_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    nullif(trim(profile.display_name), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(auth_user.email, '@', 1), ''),
    'Member'
  )
  from auth.users as auth_user
  left join public.profiles as profile on profile.id = auth_user.id
  where auth_user.id = member_id;
$$;

revoke all on function public.resolve_member_display_name(uuid)
from public, anon, authenticated;

create or replace function public.set_live_message_author_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_name := coalesce(
    public.resolve_member_display_name(new.user_id),
    'Member'
  );
  return new;
end;
$$;

update public.live_messages
set author_name = coalesce(
  public.resolve_member_display_name(user_id),
  'Member'
)
where author_name = 'Member'
   or nullif(trim(author_name), '') is null;
