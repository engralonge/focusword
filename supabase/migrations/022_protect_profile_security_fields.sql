-- Prevent clients from promoting themselves or clearing their own sanctions.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and auth.uid() is not null
    and not public.is_admin() then
    raise exception 'Only administrators can change account roles';
  end if;

  if (
    new.account_status is distinct from old.account_status
    or new.suspended_until is distinct from old.suspended_until
  )
    and auth.uid() is not null
    and not public.is_moderator() then
    raise exception 'Only moderators can change account sanctions';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
before update on public.profiles
for each row execute function public.protect_profile_security_fields();
