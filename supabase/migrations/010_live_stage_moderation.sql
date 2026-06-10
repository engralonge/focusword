-- Host invitations and explicit audience acceptance for the live guest stage.

alter table public.live_stage_requests
  drop constraint if exists live_stage_requests_status_check;
alter table public.live_stage_requests
  add constraint live_stage_requests_status_check
  check (
    status in (
      'pending',
      'invited',
      'approved',
      'declined',
      'removed',
      'cancelled'
    )
  );
