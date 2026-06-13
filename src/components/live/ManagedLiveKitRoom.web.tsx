import { type ComponentProps } from 'react';
import { LiveKitRoom } from '@livekit/react-native';

type Props = ComponentProps<typeof LiveKitRoom> & {
  manageAudioSession?: boolean;
};

export function ManagedLiveKitRoom({
  manageAudioSession: _manageAudioSession,
  ...props
}: Props) {
  return <LiveKitRoom {...props} />;
}
