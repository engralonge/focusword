import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  useParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/react-native';
import { permissions } from '@livekit/react-native-webrtc';
import { Track } from 'livekit-client';
import { Text } from '@/components/ui/Text';
import { palette } from '@/constants/colors';
import type { LiveRoomParticipant } from '@/types';

type MediaPermission = 'camera' | 'microphone';
type MediaPermissionState = {
  camera: boolean;
  microphone: boolean;
};

type Props = {
  serverUrl: string;
  token: string;
  isHost: boolean;
  canPublish: boolean;
  compact?: boolean;
  onParticipantCount: (count: number) => void;
  onParticipantsChange: (participants: LiveRoomParticipant[]) => void;
  onLeave: () => void;
  onError: (message: string) => void;
};

const permissionLabels: Record<MediaPermission, string> = {
  camera: 'Camera',
  microphone: 'Microphone',
};

async function requestMediaPermission(kind: MediaPermission) {
  if (Platform.OS === 'android') {
    const permission =
      kind === 'camera'
        ? PermissionsAndroid.PERMISSIONS.CAMERA
        : PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;

    if (await PermissionsAndroid.check(permission)) {
      return true;
    }

    const result = await PermissionsAndroid.request(permission, {
      title: `${permissionLabels[kind]} access`,
      message: `Citizens Bible Community needs ${kind} access when you join the live stage.`,
      buttonPositive: 'Continue',
      buttonNegative: 'Not now',
    });

    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      Alert.alert(
        `${permissionLabels[kind]} access is blocked`,
        `Open Android settings and allow ${kind} access for Citizens Bible Community.`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Open settings',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
    }

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  return Boolean(await permissions.request({ name: kind }));
}

function RoomContent({
  isHost,
  canPublish,
  compact,
  initialPermissions,
  onParticipantCount,
  onParticipantsChange,
  onLeave,
  onError,
}: Pick<
  Props,
  | 'isHost'
  | 'canPublish'
  | 'compact'
  | 'onParticipantCount'
  | 'onParticipantsChange'
  | 'onLeave'
  | 'onError'
> & {
  initialPermissions: MediaPermissionState;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const [cameraEnabled, setCameraEnabled] = useState(
    isHost && initialPermissions.camera,
  );
  const [microphoneEnabled, setMicrophoneEnabled] = useState(
    isHost && initialPermissions.microphone,
  );

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
      if (next && !(await requestMediaPermission('camera'))) {
        onError('Camera permission was denied. Allow camera access to turn on video.');
        return;
      }
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(room.localParticipant.isCameraEnabled);
    } catch (error) {
      onError(
        error instanceof Error && error.message
          ? `Could not turn on the camera: ${error.message}`
          : 'Could not turn on the camera. Check Android camera access and try again.',
      );
    }
  };

  const toggleMicrophone = async () => {
    try {
      const next = !microphoneEnabled;
      if (next && !(await requestMediaPermission('microphone'))) {
        onError(
          'Microphone permission was denied. Allow microphone access to unmute.',
        );
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled);
    } catch (error) {
      onError(
        error instanceof Error && error.message
          ? `Could not unmute the microphone: ${error.message}`
          : 'Could not unmute the microphone. Check Android microphone access and try again.',
      );
    }
  };

  const leaveRoom = async () => {
    try {
      await room.localParticipant.setCameraEnabled(false);
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.disconnect();
      onLeave();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not leave the room.');
    }
  };

  const visibleTracks = cameraTracks
    .filter((track, index, tracks) =>
      tracks.findIndex(
        (item) =>
          item.participant.identity === track.participant.identity &&
          item.source === track.source,
      ) === index,
    )
    .slice(0, 4);
  const isGrid = visibleTracks.length > 1;

  return (
    <View
      className={`bg-black rounded-lg overflow-hidden ${
        isGrid
          ? `${compact ? 'h-[180px]' : 'h-[420px]'} flex-row flex-wrap`
          : compact
            ? 'h-[180px]'
            : 'aspect-video'
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
          <Pressable
            className="w-12 h-12 rounded-full bg-red-700 items-center justify-center"
            onPress={() => void leaveRoom()}
            accessibilityRole="button"
            accessibilityLabel="Leave live study"
          >
            <Ionicons name="call" size={22} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          className="absolute bottom-3 self-center w-12 h-12 rounded-full bg-red-700 items-center justify-center"
          onPress={() => void leaveRoom()}
          accessibilityRole="button"
          accessibilityLabel="Leave live study"
        >
          <Ionicons name="call" size={22} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
        </Pressable>
      )}
    </View>
  );
}

export function LiveRoomView(props: Props) {
  const [initialPermissions, setInitialPermissions] =
    useState<MediaPermissionState>({
      camera: false,
      microphone: false,
    });
  const [permissionsReady, setPermissionsReady] = useState(
    !props.isHost || !props.canPublish,
  );

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const prepareHostMedia = async () => {
      if (!props.isHost || !props.canPublish) {
        if (active) {
          setInitialPermissions({ camera: false, microphone: false });
          setPermissionsReady(true);
        }
        return;
      }

      setPermissionsReady(false);
      const microphone = await requestMediaPermission('microphone');
      const camera = await requestMediaPermission('camera');

      if (!active) return;
      setInitialPermissions({ camera, microphone });
      setPermissionsReady(true);

      if (!microphone || !camera) {
        const denied = [
          !microphone ? 'microphone' : null,
          !camera ? 'camera' : null,
        ].filter(Boolean);
        props.onError(
          `${denied.join(' and ')} permission denied. You can listen now and enable access from the controls.`,
        );
      }
    };

    void prepareHostMedia();
    return () => {
      active = false;
    };
  }, [props.canPublish, props.isHost, props.onError]);

  if (!permissionsReady) {
    return (
      <View className="aspect-video bg-black rounded-lg items-center justify-center px-6">
        <Ionicons name="shield-checkmark-outline" size={32} color={palette.brandMuted} />
        <Text variant="caption" className="text-center mt-3">
          Preparing camera and microphone access...
        </Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={props.serverUrl}
      token={props.token}
      connect
      audio={props.isHost && initialPermissions.microphone}
      video={props.isHost && initialPermissions.camera}
      onError={(error) => props.onError(error.message)}
      onMediaDeviceFailure={(failure) =>
        props.onError(
          failure
            ? `A media device failed: ${failure}. Check Android camera and microphone access.`
            : 'Camera or microphone access failed. Check Android app permissions.',
        )
      }
    >
      <RoomContent
        isHost={props.isHost}
        canPublish={props.canPublish}
        compact={props.compact}
        initialPermissions={initialPermissions}
        onParticipantCount={props.onParticipantCount}
        onParticipantsChange={props.onParticipantsChange}
        onLeave={props.onLeave}
        onError={props.onError}
      />
    </LiveKitRoom>
  );
}
