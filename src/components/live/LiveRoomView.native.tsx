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

type Props = {
  serverUrl: string;
  token: string;
  isHost: boolean;
  onParticipantCount: (count: number) => void;
  onError: (message: string) => void;
};

function RoomContent({
  isHost,
  onParticipantCount,
  onError,
}: Pick<Props, 'isHost' | 'onParticipantCount' | 'onError'>) {
  const room = useRoomContext();
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const [cameraEnabled, setCameraEnabled] = useState(isHost);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(isHost);

  useEffect(() => {
    onParticipantCount(participants.length);
  }, [onParticipantCount, participants.length]);

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

  const primaryTrack = cameraTracks.find(
    (track) => track.participant.identity !== room.localParticipant.identity,
  ) ?? cameraTracks[0];

  return (
    <View className="aspect-video bg-black rounded-lg overflow-hidden">
      {primaryTrack ? (
        <VideoTrack trackRef={primaryTrack} style={{ flex: 1 }} objectFit="cover" />
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="videocam-off-outline" size={34} color={palette.muted} />
          <Text variant="caption" className="text-center mt-2">
            {isHost ? 'Your camera is off.' : 'Waiting for the host video.'}
          </Text>
        </View>
      )}
      {isHost ? (
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
        onParticipantCount={props.onParticipantCount}
        onError={props.onError}
      />
    </LiveKitRoom>
  );
}
