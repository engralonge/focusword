import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessToken } from 'npm:livekit-server-sdk@2';
import { enforceRateLimit, rateLimitMessage } from '../_shared/rateLimit.ts';

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

function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown>,
) {
  console[level](JSON.stringify({ event, ...fields }));
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'Authentication required' }, 401);
  }
  const quota = await enforceRateLimit(request, 'livekit_token');
  if (quota.response) {
    return json(
      { error: rateLimitMessage(quota.response, 'Too many room join attempts. Try again shortly.') },
      quota.response.status,
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const livekitUrl = Deno.env.get('LIVEKIT_URL');
  const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY');
  const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET');
  if (!supabaseUrl || !anonKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) {
    logEvent('error', 'livekit_token_not_configured', { requestId });
    return json({ error: 'Live streaming is not configured' }, 503);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid session' }, 401);
  }

  let streamId = '';
  try {
    const body = await request.json() as { streamId?: string };
    streamId = body.streamId?.trim() ?? '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!streamId) {
    return json({ error: 'Stream ID is required' }, 400);
  }

  const { data: stream, error: streamError } = await supabase
    .from('live_streams')
    .select('id, host_id, room_name, status')
    .eq('id', streamId)
    .single();
  if (streamError || !stream) {
    return json({ error: 'Live study not found' }, 404);
  }
  if (stream.status === 'ended') {
    return json({ error: 'This live study has ended' }, 409);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userData.user.id)
    .maybeSingle();
  const isHost = stream.host_id === userData.user.id;
  const { data: stageRequest } = await supabase
    .from('live_stage_requests')
    .select('status')
    .eq('stream_id', stream.id)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  const stageStatus = stageRequest?.status ?? null;
  const canPublish = isHost || stageStatus === 'approved';
  if (stream.status !== 'live' && !isHost) {
    return json({ error: 'This live study has not started yet' }, 409);
  }
  const displayName =
    profile?.display_name?.trim() || userData.user.email?.split('@')[0] || 'Member';

  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity: userData.user.id,
    name: displayName,
    ttl: '6h',
  });
  token.addGrant({
    room: stream.room_name,
    roomJoin: true,
    roomAdmin: isHost,
    canPublish,
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
  });

  logEvent('info', 'livekit_token_issued', {
    requestId,
    streamId,
    userId: userData.user.id,
    isHost,
    canPublish,
    stageStatus,
  });
  return json({
    serverUrl: livekitUrl,
    token: await token.toJwt(),
    isHost,
    canPublish,
    stageStatus,
    requestId,
  });
});
