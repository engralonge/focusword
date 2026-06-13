import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import {
  AudioSession,
  RoomContext,
} from '@livekit/react-native';
import {
  MediaDeviceFailure,
  Room,
  RoomEvent,
  type RoomConnectOptions,
  type RoomOptions,
} from 'livekit-client';

type Props = PropsWithChildren<{
  serverUrl: string;
  token: string;
  connect?: boolean;
  audio?: boolean;
  video?: boolean;
  manageAudioSession?: boolean;
  options?: RoomOptions;
  connectOptions?: RoomConnectOptions;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onMediaDeviceFailure?: (failure?: MediaDeviceFailure) => void;
}>;

let roomTransition = Promise.resolve();
let activeRoom: Room | null = null;
let activeRoomUsesAudio = false;

// WebRTC can abort natively if a new room connects while the prior room is still tearing down.
function enqueueRoomTransition(task: () => Promise<void>) {
  const transition = roomTransition.then(task, task);
  roomTransition = transition.catch(() => undefined);
  return transition;
}

async function disconnectActiveRoom() {
  if (!activeRoom) return;

  const room = activeRoom;
  const shouldStopAudio = activeRoomUsesAudio;
  activeRoom = null;
  activeRoomUsesAudio = false;

  try {
    await room.disconnect();
  } finally {
    if (shouldStopAudio) {
      await AudioSession.stopAudioSession();
    }
  }
}

export function ManagedLiveKitRoom({
  serverUrl,
  token,
  connect = true,
  audio = false,
  video = false,
  manageAudioSession = false,
  options,
  connectOptions,
  onConnected,
  onDisconnected,
  onError,
  onMediaDeviceFailure,
  children,
}: Props) {
  const [room] = useState(() => new Room(options));
  const audioRef = useRef(audio);
  const videoRef = useRef(video);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);
  const onMediaDeviceFailureRef = useRef(onMediaDeviceFailure);

  audioRef.current = audio;
  videoRef.current = video;
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;
  onErrorRef.current = onError;
  onMediaDeviceFailureRef.current = onMediaDeviceFailure;

  useEffect(() => {
    const handleSignalConnected = () => {
      void Promise.all([
        room.localParticipant.setMicrophoneEnabled(audioRef.current),
        room.localParticipant.setCameraEnabled(videoRef.current),
      ]).catch((error: unknown) => {
        onErrorRef.current?.(
          error instanceof Error
            ? error
            : new Error('Could not start the camera or microphone.'),
        );
      });
    };
    const handleConnected = () => onConnectedRef.current?.();
    const handleDisconnected = () => onDisconnectedRef.current?.();
    const handleMediaDeviceFailure = (error: Error) => {
      onMediaDeviceFailureRef.current?.(MediaDeviceFailure.getFailure(error));
    };

    room
      .on(RoomEvent.SignalConnected, handleSignalConnected)
      .on(RoomEvent.Connected, handleConnected)
      .on(RoomEvent.Disconnected, handleDisconnected)
      .on(RoomEvent.MediaDevicesError, handleMediaDeviceFailure);

    return () => {
      room
        .off(RoomEvent.SignalConnected, handleSignalConnected)
        .off(RoomEvent.Connected, handleConnected)
        .off(RoomEvent.Disconnected, handleDisconnected)
        .off(RoomEvent.MediaDevicesError, handleMediaDeviceFailure);
    };
  }, [room]);

  useEffect(() => {
    let cancelled = false;

    if (connect) {
      void enqueueRoomTransition(async () => {
        try {
          await disconnectActiveRoom();
          if (cancelled) return;

          if (manageAudioSession) {
            await AudioSession.startAudioSession();
          }
          if (cancelled) {
            if (manageAudioSession) {
              await AudioSession.stopAudioSession();
            }
            return;
          }

          activeRoom = room;
          activeRoomUsesAudio = manageAudioSession;
          await room.connect(serverUrl, token, connectOptions);
        } catch (error) {
          if (activeRoom === room) {
            await disconnectActiveRoom();
          }
          if (!cancelled) {
            onErrorRef.current?.(
              error instanceof Error
                ? error
                : new Error('Could not connect to the live study.'),
            );
          }
        }
      });
    }

    return () => {
      cancelled = true;
      void enqueueRoomTransition(async () => {
        if (activeRoom === room) {
          await disconnectActiveRoom();
        } else {
          await room.disconnect();
        }
      });
    };
  }, [
    connect,
    connectOptions,
    manageAudioSession,
    room,
    serverUrl,
    token,
  ]);

  return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>;
}
