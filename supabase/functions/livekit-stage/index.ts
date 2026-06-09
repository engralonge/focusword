import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { RoomServiceClient } from 'npm:livekit-server-sdk@2';
import { enforceRateLimit, rateLimitMessage } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type StageAction = 'request' | 'cancel' | 'approve' | 'decline' | 'remove';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isStageAction(value: unknown): value is StageAction {
  return ['request', 'cancel', 'approve', 'decline', 'remove'].includes(String(value));
}

Deno.serve(async (request) => {
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
  const quota = await enforceRateLimit(request, 'livekit_stage');
  if (quota.response) {
    return json(
      { error: rateLimitMessage(quota.response, 'Too many stage changes. Try again shortly.') },
      quota.response.status,
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const livekitUrl = Deno.env.get('LIVEKIT_URL');
  const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY');
  const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET');
  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !livekitUrl ||
    !livekitApiKey ||
    !livekitApiSecret
  ) {
    return json({ error: 'Live stage is not configured' }, 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid session' }, 401);
  }

  let streamId = '';
  let action: StageAction | undefined;
  let targetUserId = '';
  try {
    const body = await request.json() as {
      streamId?: string;
      action?: unknown;
      targetUserId?: string;
    };
    streamId = body.streamId?.trim() ?? '';
    action = isStageAction(body.action) ? body.action : undefined;
    targetUserId = body.targetUserId?.trim() ?? '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!streamId || !action) {
    return json({ error: 'Stream ID and a valid action are required' }, 400);
  }

  const { data: stream, error: streamError } = await admin
    .from('live_streams')
    .select('id, host_id, room_name, status')
    .eq('id', streamId)
    .single();
  if (streamError || !stream) {
    return json({ error: 'Live study not found' }, 404);
  }
  if (stream.status !== 'live') {
    return json({ error: 'The live study is not currently live' }, 409);
  }

  const userId = userData.user.id;
  const isHost = stream.host_id === userId;
  if (action === 'request' || action === 'cancel') {
    if (isHost) {
      return json({ error: 'The host is already on stage' }, 409);
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    const displayName =
      profile?.display_name?.trim() || userData.user.email?.split('@')[0] || 'Member';
    const status = action === 'request' ? 'pending' : 'cancelled';
    const { error } = await admin.from('live_stage_requests').upsert(
      {
        stream_id: streamId,
        user_id: userId,
        display_name: displayName.slice(0, 80),
        status,
      },
      { onConflict: 'stream_id,user_id' },
    );
    if (error) {
      return json({ error: error.message }, 500);
    }
    return json({ status });
  }

  if (!isHost) {
    return json({ error: 'Only the host can manage the stage' }, 403);
  }
  if (!targetUserId || targetUserId === stream.host_id) {
    return json({ error: 'A valid guest is required' }, 400);
  }

  const { data: stageRequest, error: requestError } = await admin
    .from('live_stage_requests')
    .select('id, status')
    .eq('stream_id', streamId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (requestError || !stageRequest) {
    return json({ error: 'Stage request not found' }, 404);
  }

  if (action === 'approve') {
    const { count, error: countError } = await admin
      .from('live_stage_requests')
      .select('id', { count: 'exact', head: true })
      .eq('stream_id', streamId)
      .eq('status', 'approved')
      .neq('user_id', targetUserId);
    if (countError) {
      return json({ error: countError.message }, 500);
    }
    if ((count ?? 0) >= 3) {
      return json({ error: 'The stage already has the maximum of three guests' }, 409);
    }
  }

  const nextStatus =
    action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : 'removed';
  const { error: updateError } = await admin
    .from('live_stage_requests')
    .update({ status: nextStatus })
    .eq('id', stageRequest.id);
  if (updateError) {
    return json({ error: updateError.message }, 500);
  }

  const roomService = new RoomServiceClient(
    livekitUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'),
    livekitApiKey,
    livekitApiSecret,
  );
  try {
    await roomService.updateParticipant(stream.room_name, targetUserId, {
      permission: {
        canSubscribe: true,
        canPublish: action === 'approve',
        canPublishData: true,
        canUpdateOwnMetadata: true,
      },
    });
  } catch (error) {
    // The request state and next room token remain authoritative if the user disconnected.
    console.warn('Could not update the connected LiveKit participant', error);
  }

  return json({ status: nextStatus });
});
