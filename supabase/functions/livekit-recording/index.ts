import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from 'npm:livekit-server-sdk@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const livekitUrl = Deno.env.get('LIVEKIT_URL');
  const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY');
  const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET');
  const bucket = Deno.env.get('RECORDING_S3_BUCKET');
  const region = Deno.env.get('RECORDING_S3_REGION');
  const accessKey = Deno.env.get('RECORDING_S3_ACCESS_KEY');
  const secret = Deno.env.get('RECORDING_S3_SECRET');
  const endpoint = Deno.env.get('RECORDING_S3_ENDPOINT');
  const publicBaseUrl = Deno.env.get('RECORDING_PUBLIC_BASE_URL');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Recording service is not configured' }, 503);
  }

  const auth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: userData } = await auth.auth.getUser();
  if (!userData.user) return json({ error: 'Invalid session' }, 401);

  let streamId = '';
  let action = '';
  try {
    const body = await request.json() as { streamId?: string; action?: string };
    streamId = body.streamId?.trim() ?? '';
    action = body.action?.trim() ?? '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!streamId || !['start', 'stop'].includes(action)) {
    return json({ error: 'Stream ID and a valid action are required' }, 400);
  }

  const { data: stream } = await admin
    .from('live_streams')
    .select('id, host_id, room_name, status, recording_requested')
    .eq('id', streamId)
    .maybeSingle();
  if (!stream) return json({ error: 'Live study not found' }, 404);
  if (stream.host_id !== userData.user.id) {
    return json({ error: 'Only the host can manage recording' }, 403);
  }
  if (!stream.recording_requested) {
    return json({ error: 'Recording was not enabled for this study' }, 409);
  }
  if (
    !livekitUrl ||
    !livekitApiKey ||
    !livekitApiSecret ||
    !bucket ||
    !region ||
    !accessKey ||
    !secret ||
    !publicBaseUrl
  ) {
    await admin
      .from('live_recordings')
      .update({
        status: 'failed',
        error_message: 'Recording storage has not been configured.',
      })
      .eq('stream_id', streamId);
    return json({ error: 'Recording storage has not been configured' }, 503);
  }

  const egress = new EgressClient(
    livekitUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'),
    livekitApiKey,
    livekitApiSecret,
  );
  const { data: recording } = await admin
    .from('live_recordings')
    .select('id, egress_id, status')
    .eq('stream_id', streamId)
    .maybeSingle();
  if (!recording) return json({ error: 'Recording request not found' }, 404);

  if (action === 'stop') {
    if (!recording.egress_id) return json({ status: recording.status });
    await egress.stopEgress(recording.egress_id);
    await admin
      .from('live_recordings')
      .update({ status: 'processing' })
      .eq('id', recording.id);
    return json({ status: 'processing' });
  }

  if (stream.status !== 'live') {
    return json({ error: 'The study must be live before recording starts' }, 409);
  }
  if (recording.egress_id && ['recording', 'processing', 'ready'].includes(recording.status)) {
    return json({ status: recording.status });
  }

  const filepath = `citizens-bible-community/${stream.id}/${Date.now()}.mp4`;
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    output: {
      case: 's3',
      value: new S3Upload({
        bucket,
        region,
        accessKey,
        secret,
        endpoint,
        forcePathStyle: Boolean(endpoint),
      }),
    },
  });
  const info = await egress.startRoomCompositeEgress(stream.room_name, {
    layout: 'grid',
    file: output,
  });
  const playbackUrl = `${publicBaseUrl.replace(/\/$/, '')}/${filepath}`;
  await admin
    .from('live_recordings')
    .update({
      status: 'recording',
      egress_id: info.egressId,
      playback_url: playbackUrl,
      error_message: null,
    })
    .eq('id', recording.id);
  return json({ status: 'recording' });
});
