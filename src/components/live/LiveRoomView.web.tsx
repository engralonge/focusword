import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import type { LiveRoomParticipant } from '@/types';
import { BrandMark } from '@/components/common/BrandMark';

type Props = {
  serverUrl: string;
  token: string;
  hostId: string;
  isHost: boolean;
  canPublish: boolean;
  compact?: boolean;
  onParticipantCount: (count: number) => void;
  onParticipantsChange: (participants: LiveRoomParticipant[]) => void;
  onLeave: () => void;
  onReconnect: () => void;
  onConnected: () => void;
  onError: (message: string) => void;
};

export function LiveRoomView(_props: Props) {
  return (
    <View className="aspect-video rounded-lg bg-surface items-center justify-center px-6">
      <BrandMark size={72} />
      <Text variant="subtitle" className="mt-3 text-center">Open the mobile app to join</Text>
      <Text variant="caption" className="mt-2 text-center">
        Live video is available in the iOS and Android development and production builds.
      </Text>
    </View>
  );
}
