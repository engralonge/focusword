import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { RoomServiceClient } from 'npm:livekit-server-sdk@2';
import { TrackSource } from 'npm:@livekit/protocol';
import { enforceRateLimit, rateLimitMessage } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type StageAction =
  | 'request'
  | 'cancel'
  | 'invite'
  | 'accept_invite'
  | 'decline_invite'
  | 'approve'
  | 'decline'
  | 'remove'
  | 'mute'
  | 'camera_off'
  | 'mute_all';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isStageAction(value: unknown): value is StageAction {
  return [
    'request',
    'cancel',
    'invite',
    'accept_invite',
    'decline_invite',
    'approve',
    'decline',
    'remove',
    'mute',
    'camera_off',
    'mute_all',
  ].includes(String(value));
}

async function resolveDisplayName(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.display_name?.trim()) {
    return profile.display_name.trim().slice(0, 80);
  }

  const { data } = await admin.auth.admin.getUserById(userId);
  const metadataName =
    data.user?.user_metadata?.display_name ??
    data.user?.user_metadata?.full_name ??
    data.user?.user_metadata?.name;
  return String(metadataName || data.user?.email?.split('@')[0] || 'Member')
    .trim()
    .slice(0, 80);
}

async function updatePublishPermission(
  roomService: RoomServiceClient,
  roomName: string,
  userId: string,
  canPublish: boolean,
): Promise<boolean> {
  try {
    await roomService.updateParticipant(roomName, userId, {
      permission: {
        canSubscribe: true,
        canPublish,
        canPublishData: true,
        canUpdateOwnMetadata: true,
      },
    });
    return true;
  } catch (error) {
    // The database status and next room token remain authoritative if disconnected.
    console.warn('Could not update the connected LiveKit participant', error);
    return false;
  }
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
  const roomService = new RoomServiceClient(
    livekitUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'),
    livekitApiKey,
    livekitApiSecret,
  );

  if (
    action === 'request' ||
    action === 'cancel' ||
    action === 'accept_invite' ||
    action === 'decline_invite'
  ) {
    if (isHost) {
      return json({ error: 'The host is already on stage' }, 409);
    }

    const { data: currentRequest } = await admin
      .from('live_stage_requests')
      .select('id, status')
      .eq('stream_id', streamId)
      .eq('user_id', userId)
      .maybeSingle();
    if (
      (action === 'accept_invite' || action === 'decline_invite') &&
      currentRequest?.status !== 'invited'
    ) {
      return json({ error: 'This stage invitation is no longer active' }, 409);
    }
    if (action === 'accept_invite') {
      const { count, error: countError } = await admin
        .from('live_stage_requests')
        .select('id', { count: 'exact', head: true })
        .eq('stream_id', streamId)
        .eq('status', 'approved')
        .neq('user_id', userId);
      if (countError) {
        return json({ error: countError.message }, 500);
      }
      if ((count ?? 0) >= 3) {
        return json({ error: 'The guest stage is currently full' }, 409);
      }
    }

    const displayName = await resolveDisplayName(admin, userId);
    const status =
      action === 'request'
        ? 'pending'
        : action === 'accept_invite'
          ? 'approved'
          : action === 'decline_invite'
            ? 'declined'
            : 'cancelled';
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
    if (action === 'accept_invite') {
      const participantUpdated = await updatePublishPermission(
        roomService,
        stream.room_name,
        userId,
        true,
      );
      return json({ status, participantUpdated });
    }
    return json({ status });
  }

  if (!isHost) {
    return json({ error: 'Only the host can manage the stage' }, 403);
  }
  if (action === 'mute_all') {
    try {
      const participants = await roomService.listParticipants(stream.room_name);
      const microphoneTracks = participants
        .filter((participant) => participant.identity !== stream.host_id)
        .flatMap((participant) =>
          participant.tracks
            .filter((track) => track.source === TrackSource.MICROPHONE && !track.muted)
            .map((track) => ({
              identity: participant.identity,
              sid: track.sid,
            })),
        );
      await Promise.all(
        microphoneTracks.map((track) =>
          roomService.mutePublishedTrack(
            stream.room_name,
            track.identity,
            track.sid,
            true,
          ),
        ),
      );
      return json({ mutedCount: microphoneTracks.length });
    } catch (error) {
      console.error('Could not mute the guest stage', error);
      return json({ error: 'Could not mute the guest stage' }, 502);
    }
  }

  if (!targetUserId || targetUserId === stream.host_id) {
    return json({ error: 'A valid guest is required' }, 400);
  }

  if (action === 'invite') {
    try {
      await roomService.getParticipant(stream.room_name, targetUserId);
    } catch {
      return json({ error: 'This audience member is no longer connected' }, 409);
    }
    const displayName = await resolveDisplayName(admin, targetUserId);
    const { error } = await admin.from('live_stage_requests').upsert(
      {
        stream_id: streamId,
        user_id: targetUserId,
        display_name: displayName,
        status: 'invited',
      },
      { onConflict: 'stream_id,user_id' },
    );
    if (error) {
      return json({ error: error.message }, 500);
    }
    return json({ status: 'invited' });
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

  if (action === 'mute' || action === 'camera_off') {
    try {
      const participant = await roomService.getParticipant(
        stream.room_name,
        targetUserId,
      );
      const source =
        action === 'mute' ? TrackSource.MICROPHONE : TrackSource.CAMERA;
      const track = participant.tracks.find(
        (item) => item.source === source,
      );
      if (!track || track.muted) {
        return json({ mutedCount: 0 });
      }
      await roomService.mutePublishedTrack(
        stream.room_name,
        targetUserId,
        track.sid,
        true,
      );
      return json({ mutedCount: 1 });
    } catch (error) {
      const device = action === 'mute' ? 'microphone' : 'camera';
      console.error(`Could not turn off participant ${device}`, error);
      return json({ error: `Could not turn off this participant's ${device}` }, 502);
    }
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

  const participantUpdated = await updatePublishPermission(
    roomService,
    stream.room_name,
    targetUserId,
    action === 'approve',
  );

  return json({ status: nextStatus, participantUpdated });
});
