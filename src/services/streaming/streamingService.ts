import type {
  LiveMessage,
  LiveBibleWorkspace,
  LiveRecording,
  LiveStageRequest,
  LiveStageStatus,
  LiveStream,
  LiveStreamStatus,
} from '@/types';
import type { BibleTranslation } from '@/types/bible';
import { getSupabaseClient } from '@/services/supabase/client';
import { getFunctionErrorMessage } from '@/services/supabase/functionError';
import { validateLiveStudy } from '@/utils/live';

async function requireUser() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('Your session has expired. Sign in again.');
  }
  return { supabase, user: data.user };
}

async function profileNames(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  ids: string[],
) {
  if (!ids.length) {
    return new Map<string, string>();
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', [...new Set(ids)]);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      profile.display_name?.trim() || 'Community member',
    ]),
  );
}

export async function fetchLiveStreams(): Promise<LiveStream[]> {
  const { supabase, user } = await requireUser();
  const { data: rows, error } = await supabase
    .from('live_streams')
    .select(
      'id, title, description, host_id, room_name, status, viewer_count, scheduled_at, created_at, updated_at, recording_requested',
    )
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  if (!rows?.length) {
    return [];
  }

  const [names, reminders, recordings] = await Promise.all([
    profileNames(supabase, rows.map((row) => row.host_id)),
    supabase.from('live_reminders').select('stream_id').eq('user_id', user.id),
    supabase
      .from('live_recording_statuses')
      .select('stream_id, status')
      .in('stream_id', rows.map((row) => row.id)),
  ]);
  if (reminders.error) {
    throw new Error(reminders.error.message);
  }
  if (recordings.error) {
    throw new Error(recordings.error.message);
  }
  const remindedIds = new Set((reminders.data ?? []).map((item) => item.stream_id));
  const recordingStatuses = new Map(
    (recordings.data ?? []).map((item) => [item.stream_id, item.status]),
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    hostId: row.host_id,
    hostName: names.get(row.host_id) ?? 'Host',
    roomName: row.room_name,
    status: row.status as LiveStreamStatus,
    viewerCount: row.viewer_count ?? 0,
    scheduledAt: row.scheduled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isHost: row.host_id === user.id,
    reminderSet: remindedIds.has(row.id),
    recordingRequested: Boolean(row.recording_requested),
    recordingStatus: recordingStatuses.get(row.id) as LiveStream['recordingStatus'],
  }));
}

export async function fetchStreamById(id: string): Promise<LiveStream | null> {
  const { supabase, user } = await requireUser();
  const { data: row, error } = await supabase
    .from('live_streams')
    .select(
      'id, title, description, host_id, room_name, status, viewer_count, scheduled_at, created_at, updated_at, recording_requested',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!row) {
    return null;
  }

  const [names, reminder, recording] = await Promise.all([
    profileNames(supabase, [row.host_id]),
    supabase
      .from('live_reminders')
      .select('stream_id')
      .eq('stream_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('live_recording_statuses')
      .select('status')
      .eq('stream_id', id)
      .maybeSingle(),
  ]);
  if (reminder.error) {
    throw new Error(reminder.error.message);
  }
  if (recording.error) {
    throw new Error(recording.error.message);
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    hostId: row.host_id,
    hostName: names.get(row.host_id) ?? 'Host',
    roomName: row.room_name,
    status: row.status as LiveStreamStatus,
    viewerCount: row.viewer_count ?? 0,
    scheduledAt: row.scheduled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isHost: row.host_id === user.id,
    reminderSet: Boolean(reminder.data),
    recordingRequested: Boolean(row.recording_requested),
    recordingStatus: recording.data?.status as LiveStream['recordingStatus'],
  };
}

export async function createLiveStream(input: {
  title: string;
  description?: string;
  scheduledAt?: string;
  startNow: boolean;
  recordingRequested?: boolean;
}): Promise<string> {
  const { supabase, user } = await requireUser();
  validateLiveStudy(input);
  const title = input.title.trim();
  const description = input.description?.trim();

  const roomName = `focusword-${user.id}-${Date.now()}`;
  const { data, error } = await supabase
    .from('live_streams')
    .insert({
      title,
      description: description || null,
      host_id: user.id,
      room_name: roomName,
      status: input.startNow ? 'live' : 'scheduled',
      scheduled_at: input.startNow ? null : input.scheduledAt,
      recording_requested: Boolean(input.recordingRequested),
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create the live study.');
  }
  if (input.startNow && input.recordingRequested) {
    void manageLiveRecording(data.id, 'start').catch(() => undefined);
  }
  return data.id;
}

export async function updateStreamStatus(
  streamId: string,
  status: LiveStreamStatus,
): Promise<void> {
  if (status === 'ended') {
    const stream = await fetchStreamById(streamId);
    await performLiveStageAction(streamId, 'end');
    if (stream?.recordingRequested) {
      void manageLiveRecording(streamId, 'stop').catch(() => undefined);
    }
    return;
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('live_streams')
    .update({ status })
    .eq('id', streamId);
  if (error) {
    throw new Error(error.message);
  }
  const stream = await fetchStreamById(streamId);
  if (stream?.recordingRequested) {
    void manageLiveRecording(streamId, status === 'live' ? 'start' : 'stop')
      .catch(() => undefined);
  }
}

async function manageLiveRecording(
  streamId: string,
  action: 'start' | 'stop',
): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.functions.invoke<{ error?: string }>(
    'livekit-recording',
    { body: { streamId, action } },
  );
  if (error || data?.error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        data?.error,
        'Could not update recording.',
      ),
    );
  }
}

export async function fetchReadyRecordings(limit = 10): Promise<LiveRecording[]> {
  const { supabase } = await requireUser();
  const { data: recordings, error } = await supabase
    .from('live_recordings')
    .select('id, stream_id, playback_url, duration_seconds, ready_at')
    .eq('status', 'ready')
    .not('playback_url', 'is', null)
    .order('ready_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!recordings?.length) return [];

  const { data: streams, error: streamError } = await supabase
    .from('live_streams')
    .select('id, title, host_id')
    .in('id', recordings.map((item) => item.stream_id));
  if (streamError) throw new Error(streamError.message);
  const names = await profileNames(supabase, (streams ?? []).map((stream) => stream.host_id));
  const streamMap = new Map((streams ?? []).map((stream) => [stream.id, stream]));

  return recordings.flatMap((recording) => {
    const stream = streamMap.get(recording.stream_id);
    if (!stream || !recording.playback_url || !recording.ready_at) return [];
    return [{
      id: recording.id,
      streamId: recording.stream_id,
      title: stream.title,
      hostName: names.get(stream.host_id) ?? 'Host',
      playbackUrl: recording.playback_url,
      durationSeconds: recording.duration_seconds ?? undefined,
      readyAt: recording.ready_at,
    }];
  });
}

export async function fetchRecordingById(id: string): Promise<LiveRecording | null> {
  const recordings = await fetchReadyRecordings(100);
  return recordings.find((recording) => recording.id === id) ?? null;
}

export async function deleteLiveStream(streamId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('live_streams').delete().eq('id', streamId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getLiveKitCredentials(streamId: string): Promise<{
  serverUrl: string;
  token: string;
  isHost: boolean;
  canPublish: boolean;
  stageStatus: LiveStageStatus | null;
}> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.functions.invoke<{
    serverUrl?: string;
    token?: string;
    isHost?: boolean;
    canPublish?: boolean;
    stageStatus?: LiveStageStatus | null;
    error?: string;
  }>('livekit-token', { body: { streamId } });
  if (error || !data?.serverUrl || !data.token) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        data?.error,
        'Could not join the live room. Check your connection and try again.',
      ),
    );
  }
  return {
    serverUrl: data.serverUrl,
    token: data.token,
    isHost: Boolean(data.isHost),
    canPublish: Boolean(data.canPublish),
    stageStatus: data.stageStatus ?? null,
  };
}

export async function fetchLiveStageRequests(
  streamId: string,
): Promise<LiveStageRequest[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('live_stage_requests')
    .select('id, stream_id, user_id, display_name, status, created_at, updated_at')
    .eq('stream_id', streamId)
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    streamId: row.stream_id,
    userId: row.user_id,
    displayName: row.display_name,
    status: row.status as LiveStageStatus,
    isCurrentUser: row.user_id === user.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function performLiveStageAction(
  streamId: string,
  action:
    | 'request'
    | 'cancel'
    | 'invite'
    | 'accept_invite'
    | 'decline_invite'
    | 'leave'
    | 'approve'
    | 'decline'
    | 'remove'
    | 'mute'
    | 'camera_off'
    | 'mute_all'
    | 'end',
  targetUserId?: string,
): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.functions.invoke<{ error?: string }>(
    'livekit-stage',
    { body: { streamId, action, targetUserId } },
  );
  if (error || data?.error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        data?.error,
        'Could not update the live stage. Check your connection and try again.',
      ),
    );
  }
}

export function subscribeToLiveStream(
  streamId: string,
  onChange: () => void,
): (() => void) | undefined {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return undefined;
  }
  const channel = supabase
    .channel(`live-stream:${streamId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `id=eq.${streamId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToLiveStage(
  streamId: string,
  onChange: () => void,
): (() => void) | undefined {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return undefined;
  }
  const channel = supabase
    .channel(`live-stage:${streamId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_stage_requests',
        filter: `stream_id=eq.${streamId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

function mapLiveBibleWorkspace(row: Record<string, unknown>): LiveBibleWorkspace {
  return {
    streamId: String(row.stream_id),
    book: String(row.book),
    chapter: Number(row.chapter),
    translation: row.translation as BibleTranslation,
    activeVerse:
      typeof row.active_verse === 'number' ? row.active_verse : undefined,
    isVisible: Boolean(row.is_visible),
    summary: typeof row.summary === 'string' ? row.summary : undefined,
    summaryReference:
      typeof row.summary_reference === 'string' ? row.summary_reference : undefined,
    updatedAt: String(row.updated_at),
  };
}

export async function fetchLiveBibleWorkspace(
  streamId: string,
): Promise<LiveBibleWorkspace | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('live_bible_workspaces')
    .select(
      'stream_id, book, chapter, translation, active_verse, is_visible, summary, summary_reference, updated_at',
    )
    .eq('stream_id', streamId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapLiveBibleWorkspace(data as Record<string, unknown>) : null;
}

export async function saveLiveBibleWorkspace(
  workspace: Omit<LiveBibleWorkspace, 'updatedAt'>,
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('live_bible_workspaces').upsert({
    stream_id: workspace.streamId,
    book: workspace.book,
    chapter: workspace.chapter,
    translation: workspace.translation,
    active_verse: workspace.activeVerse ?? null,
    is_visible: workspace.isVisible,
    summary: workspace.summary ?? null,
    summary_reference: workspace.summaryReference ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export function subscribeToLiveBibleWorkspace(
  streamId: string,
  onChange: () => void,
): (() => void) | undefined {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return undefined;
  }
  const channel = supabase
    .channel(`live-bible:${streamId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_bible_workspaces',
        filter: `stream_id=eq.${streamId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function fetchLiveMessages(streamId: string): Promise<LiveMessage[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('live_messages')
    .select('id, stream_id, user_id, author_name, body, created_at')
    .eq('stream_id', streamId)
    .eq('status', 'published')
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    streamId: row.stream_id,
    userId: row.user_id,
    authorName: row.author_name?.trim() || 'Member',
    body: row.body,
    isOwner: row.user_id === user.id,
    createdAt: row.created_at,
  }));
}

export async function sendLiveMessage(streamId: string, body: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 1000) {
    throw new Error('Messages must be between 1 and 1,000 characters.');
  }
  const { error } = await supabase.from('live_messages').insert({
    stream_id: streamId,
    user_id: user.id,
    body: trimmed,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export function subscribeToLiveMessages(
  streamId: string,
  onChange: () => void,
): (() => void) | undefined {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return undefined;
  }
  const channel = supabase
    .channel(`live-messages:${streamId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_messages',
        filter: `stream_id=eq.${streamId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function saveReminder(
  streamId: string,
  notificationId?: string,
): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('live_reminders').upsert({
    stream_id: streamId,
    user_id: user.id,
    notification_id: notificationId ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function removeReminder(streamId: string): Promise<string | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('live_reminders')
    .delete()
    .eq('stream_id', streamId)
    .eq('user_id', user.id)
    .select('notification_id')
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data?.notification_id ?? null;
}
