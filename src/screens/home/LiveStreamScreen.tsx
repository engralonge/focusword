import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { LiveBadge } from '@/components/live/LiveBadge';
import { LiveRoomView } from '@/components/live/LiveRoomView';
import { LiveBibleWorkspace } from '@/components/live/LiveBibleWorkspace';
import { Button } from '@/components/ui/Button';
import type { LiveStackParamList } from '@/navigation/types';
import type {
  LiveMessage,
  LiveRoomParticipant,
  LiveStageRequest,
  LiveStream,
} from '@/types';
import {
  deleteLiveStream,
  fetchLiveMessages,
  fetchLiveStageRequests,
  fetchStreamById,
  getLiveKitCredentials,
  performLiveStageAction,
  sendLiveMessage,
  subscribeToLiveMessages,
  subscribeToLiveStage,
  updateStreamStatus,
} from '@/services/streaming/streamingService';
import {
  cancelLiveReminder,
  scheduleLiveReminder,
} from '@/services/notifications/notificationService';
import { palette } from '@/constants/colors';

type Route = RouteProp<LiveStackParamList, 'LiveStream'>;
type Nav = NativeStackNavigationProp<LiveStackParamList, 'LiveStream'>;
type Credentials = Awaited<ReturnType<typeof getLiveKitCredentials>>;

export function LiveStreamScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [stageRequests, setStageRequests] = useState<LiveStageRequest[]>([]);
  const [roomParticipants, setRoomParticipants] = useState<LiveRoomParticipant[]>([]);
  const [draft, setDraft] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      setMessages(await fetchLiveMessages(params.streamId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load live chat.');
    }
  }, [params.streamId]);

  const loadStage = useCallback(async () => {
    try {
      setStageRequests(await fetchLiveStageRequests(params.streamId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load the live stage.');
    }
  }, [params.streamId]);

  const refreshCredentials = useCallback(async () => {
    try {
      setCredentials(await getLiveKitCredentials(params.streamId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not refresh the live room.');
    }
  }, [params.streamId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStream = await fetchStreamById(params.streamId);
      if (!nextStream) {
        throw new Error('This live study is no longer available.');
      }
      setStream(nextStream);
      if (nextStream.status === 'live') {
        const [nextCredentials] = await Promise.all([
          getLiveKitCredentials(nextStream.id),
          loadMessages(),
          loadStage(),
        ]);
        setCredentials(nextCredentials);
      } else {
        setCredentials(null);
        await Promise.all([loadMessages(), loadStage()]);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load the live study.');
    } finally {
      setLoading(false);
    }
  }, [loadMessages, loadStage, params.streamId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => subscribeToLiveMessages(params.streamId, () => void loadMessages()),
    [loadMessages, params.streamId],
  );

  useEffect(
    () =>
      subscribeToLiveStage(params.streamId, () => {
        void loadStage();
        if (!stream?.isHost && stream?.status === 'live') {
          void refreshCredentials();
        }
      }),
    [loadStage, params.streamId, refreshCredentials, stream?.isHost, stream?.status],
  );

  const changeStage = async (
    action:
      | 'request'
      | 'cancel'
      | 'invite'
      | 'accept_invite'
      | 'decline_invite'
      | 'approve'
      | 'decline'
      | 'remove'
      | 'mute'
      | 'mute_all',
    targetUserId?: string,
  ) => {
    setWorking(true);
    setError(null);
    try {
      await performLiveStageAction(params.streamId, action, targetUserId);
      await loadStage();
      if (!stream?.isHost) {
        await refreshCredentials();
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update the stage.');
    } finally {
      setWorking(false);
    }
  };

  const updateStatus = async (status: 'live' | 'ended') => {
    setWorking(true);
    setError(null);
    try {
      await updateStreamStatus(params.streamId, status);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update the study.');
    } finally {
      setWorking(false);
    }
  };

  const toggleReminder = async () => {
    if (!stream) return;
    setWorking(true);
    setError(null);
    try {
      if (stream.reminderSet) {
        await cancelLiveReminder(stream.id);
      } else {
        await scheduleLiveReminder(stream);
      }
      setStream({ ...stream, reminderSet: !stream.reminderSet });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update the reminder.');
    } finally {
      setWorking(false);
    }
  };

  const postMessage = async () => {
    setWorking(true);
    setError(null);
    try {
      await sendLiveMessage(params.streamId, draft);
      setDraft('');
      await loadMessages();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not send the message.');
    } finally {
      setWorking(false);
    }
  };

  const remove = () => {
    Alert.alert('Delete live study?', 'The study and its chat history will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteLiveStream(params.streamId)
            .then(() => navigation.goBack())
            .catch((nextError: unknown) => {
              setError(nextError instanceof Error ? nextError.message : 'Could not delete the study.');
            });
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <Text variant="body" className="px-4 mt-4">Loading live study...</Text>
      </ScreenContainer>
    );
  }

  if (!stream) {
    return (
      <ScreenContainer contentClassName="px-4">
        <Text className="text-red-500 mt-4">{error ?? 'Live study not found.'}</Text>
        <Button title="Go back" variant="secondary" className="mt-5" onPress={navigation.goBack} />
      </ScreenContainer>
    );
  }

  const scheduleLabel = stream.scheduledAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(new Date(stream.scheduledAt))
    : null;
  const ownStageRequest = stageRequests.find((request) => request.isCurrentUser);
  const pendingStageRequests = stageRequests.filter((request) => request.status === 'pending');
  const approvedGuests = stageRequests.filter((request) => request.status === 'approved');
  const invitedGuests = stageRequests.filter((request) => request.status === 'invited');
  const audienceMembers = roomParticipants.filter((participant) => {
    if (participant.userId === stream.hostId) return false;
    const request = stageRequests.find((item) => item.userId === participant.userId);
    return !request || ['declined', 'removed', 'cancelled'].includes(request.status);
  });

  return (
    <ScreenContainer contentClassName="px-4">
      <Card className="mt-2">
        <View className="flex-row items-start justify-between">
          <LiveBadge status={stream.status} />
          {stream.isHost ? (
            <Pressable
              className="w-10 h-10 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Delete live study"
              onPress={remove}
            >
              <Ionicons name="trash-outline" size={20} color={palette.danger} />
            </Pressable>
          ) : null}
        </View>
        <Text variant="title" className="mt-3">{stream.title}</Text>
        <Text variant="caption" className="mt-1">Hosted by {stream.hostName}</Text>
        {stream.description ? <Text className="mt-3">{stream.description}</Text> : null}
        {scheduleLabel ? (
          <View className="flex-row items-center gap-2 mt-3">
            <Ionicons name="calendar-outline" size={17} color={palette.muted} />
            <Text variant="caption">{scheduleLabel}</Text>
          </View>
        ) : null}
        {stream.status === 'live' ? (
          <Text variant="caption" className="mt-2">
            {Math.max(participantCount, stream.viewerCount)} connected
          </Text>
        ) : null}
      </Card>

      {error ? <Text className="text-red-500 text-center mt-4">{error}</Text> : null}

      {stream.status === 'live' && credentials ? (
        <View className="mt-5">
          <LiveRoomView
            key={credentials.token}
            serverUrl={credentials.serverUrl}
            token={credentials.token}
            isHost={credentials.isHost}
            canPublish={credentials.canPublish}
            onParticipantCount={setParticipantCount}
            onParticipantsChange={setRoomParticipants}
            onError={setError}
          />
          <LiveBibleWorkspace
            streamId={stream.id}
            isHost={stream.isHost}
            onError={setError}
          />
          {stream.isHost ? (
            <Card className="mt-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text variant="subtitle">Guest stage</Text>
                  <Text variant="caption" className="mt-1">
                    Speaking queue and room controls
                  </Text>
                </View>
                <Text variant="caption">{approvedGuests.length}/3 guests</Text>
              </View>
              {approvedGuests.some((request) => {
                const participant = roomParticipants.find(
                  (item) => item.userId === request.userId,
                );
                return participant?.isMicrophoneEnabled;
              }) ? (
                <Button
                  title={working ? 'Muting...' : 'Mute all guests'}
                  variant="secondary"
                  className="mt-4"
                  disabled={working}
                  onPress={() => void changeStage('mute_all')}
                />
              ) : null}
              <Text variant="label" className="mt-5">Speaking queue</Text>
              {pendingStageRequests.length === 0 ? (
                <Text variant="caption" className="mt-3">
                  No one is waiting to speak.
                </Text>
              ) : (
                pendingStageRequests.map((request) => (
                  <View
                    key={request.id}
                    className="mt-3 pt-3 border-t border-white/10 flex-row items-center gap-2"
                  >
                    <View className="flex-1">
                      <Text variant="label">{request.displayName}</Text>
                      <Text variant="caption">Wants to join the conversation</Text>
                    </View>
                    <Pressable
                      className="w-10 h-10 rounded-full bg-red-500/15 items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel={`Decline ${request.displayName}`}
                      disabled={working}
                      onPress={() => void changeStage('decline', request.userId)}
                    >
                      <Ionicons name="close" size={22} color={palette.danger} />
                    </Pressable>
                    <Pressable
                      className="w-10 h-10 rounded-full bg-brand/20 items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel={`Approve ${request.displayName}`}
                      disabled={working || approvedGuests.length >= 3}
                      onPress={() => void changeStage('approve', request.userId)}
                    >
                      <Ionicons name="checkmark" size={22} color={palette.brandLight} />
                    </Pressable>
                  </View>
                ))
              )}
              {invitedGuests.length ? (
                <>
                  <Text variant="label" className="mt-5">Invited</Text>
                  {invitedGuests.map((request) => (
                    <View
                      key={request.id}
                      className="mt-3 pt-3 border-t border-white/10 flex-row items-center"
                    >
                      <View className="flex-1">
                        <Text variant="label">{request.displayName}</Text>
                        <Text variant="caption">Waiting for their response</Text>
                      </View>
                      <Ionicons name="time-outline" size={20} color={palette.brandMuted} />
                    </View>
                  ))}
                </>
              ) : null}
              {approvedGuests.length ? (
                <Text variant="label" className="mt-5">On stage</Text>
              ) : null}
              {approvedGuests.map((request) => (
                (() => {
                  const participant = roomParticipants.find(
                    (item) => item.userId === request.userId,
                  );
                  return (
                    <View
                      key={request.id}
                      className="mt-3 pt-3 border-t border-white/10 flex-row items-center gap-2"
                    >
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text variant="label">{request.displayName}</Text>
                          {participant?.isSpeaking ? (
                            <View className="w-2 h-2 rounded-full bg-green-500" />
                          ) : null}
                        </View>
                        <Text variant="caption">
                          {!participant
                            ? 'Reconnecting'
                            : participant.isMicrophoneEnabled
                              ? 'Microphone live'
                              : 'Microphone muted'}
                        </Text>
                      </View>
                      <Pressable
                        className="w-10 h-10 rounded-full bg-brand/10 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel={`Mute ${request.displayName}`}
                        disabled={working || !participant?.isMicrophoneEnabled}
                        onPress={() => void changeStage('mute', request.userId)}
                      >
                        <Ionicons
                          name={participant?.isMicrophoneEnabled ? 'mic' : 'mic-off'}
                          size={20}
                          color={
                            participant?.isMicrophoneEnabled
                              ? palette.brandLight
                              : palette.muted
                          }
                        />
                      </Pressable>
                      <Pressable
                        className="w-10 h-10 rounded-full bg-red-500/15 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel={`Return ${request.displayName} to audience`}
                        disabled={working}
                        onPress={() => void changeStage('remove', request.userId)}
                      >
                        <Ionicons name="arrow-down" size={20} color={palette.danger} />
                      </Pressable>
                    </View>
                  );
                })()
              ))}
              <Text variant="label" className="mt-5">Connected audience</Text>
              {audienceMembers.length === 0 ? (
                <Text variant="caption" className="mt-3">
                  No available audience members to invite.
                </Text>
              ) : (
                audienceMembers.map((participant) => (
                  <View
                    key={participant.userId}
                    className="mt-3 pt-3 border-t border-white/10 flex-row items-center"
                  >
                    <View className="flex-1">
                      <Text variant="label">{participant.displayName}</Text>
                      <Text variant="caption">Listening in the audience</Text>
                    </View>
                    <Button
                      title="Invite"
                      variant="secondary"
                      className="min-h-[40px] px-4 py-2"
                      disabled={working || approvedGuests.length >= 3}
                      onPress={() => void changeStage('invite', participant.userId)}
                    />
                  </View>
                ))
              )}
            </Card>
          ) : (
            <Card className="mt-4">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-brand/15 items-center justify-center">
                  <Ionicons
                    name={credentials.canPublish ? 'mic' : 'hand-left-outline'}
                    size={20}
                    color={palette.brandLight}
                  />
                </View>
                <View className="flex-1">
                  <Text variant="label">
                    {credentials.canPublish
                      ? 'You are on stage'
                      : ownStageRequest?.status === 'invited'
                        ? 'The host invited you'
                      : ownStageRequest?.status === 'pending'
                        ? 'Request sent'
                        : 'Join the conversation'}
                  </Text>
                  <Text variant="caption" className="mt-1">
                    {credentials.canPublish
                      ? 'Use the microphone and camera controls above.'
                      : ownStageRequest?.status === 'invited'
                        ? 'Accept when you are ready to join with camera and microphone controls.'
                      : ownStageRequest?.status === 'pending'
                        ? 'The host will bring you up when ready.'
                        : 'Ask the host to turn on your microphone and camera access.'}
                  </Text>
                </View>
              </View>
              {ownStageRequest?.status === 'invited' && !credentials.canPublish ? (
                <View className="mt-4 flex-row gap-2">
                  <Button
                    title="Not now"
                    variant="secondary"
                    className="flex-1"
                    disabled={working}
                    onPress={() => void changeStage('decline_invite')}
                  />
                  <Button
                    title={working ? 'Joining...' : 'Accept invitation'}
                    className="flex-1"
                    disabled={working}
                    onPress={() => void changeStage('accept_invite')}
                  />
                </View>
              ) : !credentials.canPublish ? (
                <Button
                  title={
                    working
                      ? 'Updating...'
                      : ownStageRequest?.status === 'pending'
                        ? 'Cancel request'
                        : 'Request to join'
                  }
                  variant={ownStageRequest?.status === 'pending' ? 'secondary' : 'primary'}
                  className="mt-4"
                  disabled={working}
                  onPress={() =>
                    void changeStage(
                      ownStageRequest?.status === 'pending' ? 'cancel' : 'request',
                    )
                  }
                />
              ) : null}
            </Card>
          )}
          {stream.isHost ? (
            <Button
              title={working ? 'Ending...' : 'End study'}
              variant="danger"
              className="mt-4"
              disabled={working}
              onPress={() => void updateStatus('ended')}
            />
          ) : null}
        </View>
      ) : null}

      {stream.status === 'scheduled' ? (
        stream.isHost ? (
          <Button
            title={working ? 'Starting...' : 'Start live study'}
            className="mt-5"
            disabled={working}
            onPress={() => void updateStatus('live')}
          />
        ) : (
          <Button
            title={
              working
                ? 'Updating...'
                : stream.reminderSet
                  ? 'Cancel reminder'
                  : 'Remind me'
            }
            variant="secondary"
            className="mt-5"
            disabled={working}
            onPress={() => void toggleReminder()}
          />
        )
      ) : null}

      {stream.status === 'ended' ? (
        <View className="mt-5 py-5 border-y border-black/5 dark:border-white/10">
          <Text variant="subtitle">Study ended</Text>
          <Text variant="caption" className="mt-1">The conversation remains available below.</Text>
        </View>
      ) : null}

      <Text variant="label" className="mt-7 mb-2">Live chat</Text>
      {messages.length === 0 ? (
        <Text variant="caption" className="py-4">No messages yet.</Text>
      ) : (
        messages.map((message) => (
          <View
            key={message.id}
            className={`mb-3 max-w-[88%] rounded-lg px-3 py-2 ${
              message.isOwner
                ? 'self-end bg-brand/20'
                : 'self-start bg-surface-light dark:bg-surface'
            }`}
          >
            <Text variant="label">{message.authorName}</Text>
            <Text className="mt-1">{message.body}</Text>
            <Text variant="caption" className="mt-1">
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        ))
      )}
      {stream.status === 'live' ? (
        <View className="mt-3 flex-row items-end gap-2">
          <TextInput
            className="flex-1 min-h-12 max-h-32 bg-surface-light dark:bg-surface rounded-lg px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
            placeholder="Write to the group..."
            placeholderTextColor={palette.muted}
            value={draft}
            onChangeText={setDraft}
            maxLength={1000}
            multiline
            accessibilityLabel="Live chat message"
          />
          <Pressable
            className="w-12 h-12 rounded-lg bg-brand items-center justify-center disabled:opacity-50"
            accessibilityRole="button"
            accessibilityLabel="Send live chat message"
            disabled={working || !draft.trim()}
            onPress={() => void postMessage()}
          >
            <Ionicons name="send" size={20} color={palette.backgroundDark} />
          </Pressable>
        </View>
      ) : null}
      <View className="h-8" />
    </ScreenContainer>
  );
}
