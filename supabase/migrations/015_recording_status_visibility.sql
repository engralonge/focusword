-- Expose recording state without exposing private output details before a replay is ready.

create or replace view public.live_recording_statuses
with (security_invoker = false)
as
select stream_id, status
from public.live_recordings;

revoke all on public.live_recording_statuses from public, anon;
grant select on public.live_recording_statuses to authenticated;
