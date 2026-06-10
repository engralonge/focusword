import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  useParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { Text } from '@/components/ui/Text';
import { palette } from '@/constants/colors';
import type { LiveRoomParticipant } from '@/types';

type Props = {
  serverUrl: string;
  token: string;
  isHost: boolean;
  canPublish: boolean;
  onParticipantCount: (count: number) => void;
  onParticipantsChange: (participants: LiveRoomParticipant[]) => void;
  onError: (message: string) => void;
};

function RoomContent({
  isHost,
  canPublish,
  onParticipantCount,
  onParticipantsChange,
  onError,
}: Pick<
  Props,
  'isHost' | 'canPublish' | 'onParticipantCount' | 'onParticipantsChange' | 'onError'
>) {
  const room = useRoomContext();
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const [cameraEnabled, setCameraEnabled] = useState(isHost);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(isHost);

  useEffect(() => {
    onParticipantCount(participants.length);
    onParticipantsChange(
      participants.map((participant) => ({
        userId: participant.identity,
        displayName: participant.name || 'Community member',
        isMicrophoneEnabled: participant.isMicrophoneEnabled,
        isCameraEnabled: participant.isCameraEnabled,
        isSpeaking: participant.isSpeaking,
      })),
    );
    setCameraEnabled(room.localParticipant.isCameraEnabled);
    setMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled);
  }, [
    onParticipantCount,
    onParticipantsChange,
    participants,
    room.localParticipant,
  ]);

  useEffect(() => {
    if (canPublish) {
      return;
    }
    setCameraEnabled(false);
    setMicrophoneEnabled(false);
    void room.localParticipant.setCameraEnabled(false);
    void room.localParticipant.setMicrophoneEnabled(false);
  }, [canPublish, room.localParticipant]);

  const toggleCamera = async () => {
    try {
      const next = !cameraEnabled;
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(next);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not change the camera.');
    }
  };

  const toggleMicrophone = async () => {
    try {
      const next = !microphoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicrophoneEnabled(next);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not change the microphone.');
    }
  };

  const visibleTracks = cameraTracks.slice(0, 4);
  const isGrid = visibleTracks.length > 1;

  return (
    <View
      className={`bg-black rounded-lg overflow-hidden ${
        isGrid ? 'h-[420px] flex-row flex-wrap' : 'aspect-video'
      }`}
    >
      {visibleTracks.length ? (
        visibleTracks.map((track) => (
          <View
            key={`${track.participant.identity}:${track.source}`}
            style={{
              width: isGrid ? '50%' : '100%',
              height: isGrid ? '50%' : '100%',
            }}
            className="border border-black"
          >
            <VideoTrack trackRef={track} style={{ flex: 1 }} objectFit="cover" />
            <View className="absolute left-2 bottom-2 max-w-[80%] rounded-full bg-black/70 px-3 py-1">
              <Text variant="caption" numberOfLines={1} className="text-white">
                {track.participant.name || 'Guest'}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="videocam-off-outline" size={34} color={palette.muted} />
          <Text variant="caption" className="text-center mt-2">
            {canPublish ? 'Your camera is off.' : 'Waiting for someone to turn on video.'}
          </Text>
        </View>
      )}
      {canPublish ? (
        <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-3">
          <Pressable
            className="w-12 h-12 rounded-full bg-black/70 items-center justify-center"
            onPress={() => void toggleMicrophone()}
            accessibilityRole="button"
            accessibilityLabel={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            <Ionicons
              name={microphoneEnabled ? 'mic' : 'mic-off'}
              size={22}
              color="white"
            />
          </Pressable>
          <Pressable
            className="w-12 h-12 rounded-full bg-black/70 items-center justify-center"
            onPress={() => void toggleCamera()}
            accessibilityRole="button"
            accessibilityLabel={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            <Ionicons
              name={cameraEnabled ? 'videocam' : 'videocam-off'}
              size={22}
              color="white"
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function LiveRoomView(props: Props) {
  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  return (
    <LiveKitRoom
      serverUrl={props.serverUrl}
      token={props.token}
      connect
      audio={props.isHost}
      video={props.isHost}
      onError={(error) => props.onError(error.message)}
      onMediaDeviceFailure={() => props.onError('Camera or microphone access failed.')}
    >
      <RoomContent
        isHost={props.isHost}
        canPublish={props.canPublish}
        onParticipantCount={props.onParticipantCount}
        onParticipantsChange={props.onParticipantsChange}
        onError={props.onError}
      />
    </LiveKitRoom>
  );
}
