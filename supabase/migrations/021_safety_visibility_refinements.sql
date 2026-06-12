-- Keep blocked actors out of activity feeds and enforce active accounts there too.

create policy "Active accounts use activity"
  on public.activity_events as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());

create policy "Blocked activity actors are hidden"
  on public.activity_events as restrictive for select to authenticated
  using (
    actor_id is null
    or actor_id = auth.uid()
    or public.is_moderator()
    or not public.has_block_relationship(auth.uid(), actor_id)
  );

create policy "Active accounts use live reminders"
  on public.live_reminders as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());

create policy "Active accounts use live stage requests"
  on public.live_stage_requests as restrictive for all to authenticated
  using (public.is_account_active())
  with check (public.is_account_active());
