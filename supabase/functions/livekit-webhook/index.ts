import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { WebhookReceiver } from 'npm:livekit-server-sdk@2';

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return response('Method not allowed', 405);
  }

  const apiKey = Deno.env.get('LIVEKIT_API_KEY');
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !apiSecret || !supabaseUrl || !serviceRoleKey) {
    return response('Webhook is not configured', 503);
  }

  let event;
  try {
    const rawBody = await request.text();
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    event = await receiver.receive(rawBody, request.headers.get('Authorization') ?? undefined);
  } catch {
    return response('Invalid webhook signature', 401);
  }

  const egressInfo = 'egressInfo' in event ? event.egressInfo : undefined;
  const roomName = event.room?.name ?? egressInfo?.roomName;
  if (!roomName) {
    return response('ok');
  }

  if (
    ![
      'room_started',
      'room_finished',
      'participant_joined',
      'participant_left',
      'participant_connection_aborted',
      'egress_started',
      'egress_updated',
      'egress_ended',
    ].includes(event.event)
  ) {
    return response('ok');
  }

  const viewerCount =
    event.event === 'room_finished'
      ? 0
      : Math.max(0, Number(event.room?.numParticipants ?? 0));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  if (event.event.startsWith('egress_') && egressInfo?.egressId) {
    const status =
      event.event === 'egress_ended'
        ? egressInfo.error
          ? 'failed'
          : 'ready'
        : event.event === 'egress_started'
          ? 'recording'
          : 'processing';
    const update: Record<string, unknown> = {
      status,
      error_message: egressInfo.error || null,
    };
    if (status === 'ready') update.ready_at = new Date().toISOString();
    const { error: recordingError } = await supabase
      .from('live_recordings')
      .update(update)
      .eq('egress_id', egressInfo.egressId);
    return recordingError ? response('Recording update failed', 500) : response('ok');
  }

  const { data: stream, error: streamError } = await supabase
    .from('live_streams')
    .update({ viewer_count: viewerCount })
    .eq('room_name', roomName)
    .select('id')
    .maybeSingle();
  if (streamError) {
    return response('Database update failed', 500);
  }

  const participantId = event.participant?.identity;
  const participantSid = event.participant?.sid;
  if (
    stream &&
    participantId &&
    participantSid &&
    ['participant_joined', 'participant_left', 'participant_connection_aborted'].includes(
      event.event,
    )
  ) {
    const { error: attendanceError } = await supabase.rpc('record_live_attendance', {
      requested_stream_id: stream.id,
      requested_user_id: participantId,
      requested_participant_sid: participantSid,
      requested_action: event.event === 'participant_joined' ? 'joined' : 'left',
    });
    if (attendanceError) {
      return response('Attendance update failed', 500);
    }
  }

  return response('ok');
});
