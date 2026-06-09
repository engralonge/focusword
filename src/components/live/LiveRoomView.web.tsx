import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { palette } from '@/constants/colors';

type Props = {
  serverUrl: string;
  token: string;
  isHost: boolean;
  onParticipantCount: (count: number) => void;
  onError: (message: string) => void;
};

export function LiveRoomView(_props: Props) {
  return (
    <View className="aspect-video rounded-lg bg-surface items-center justify-center px-6">
      <Ionicons name="phone-portrait-outline" size={36} color={palette.brand} />
      <Text variant="subtitle" className="mt-3 text-center">Open the mobile app to join</Text>
      <Text variant="caption" className="mt-2 text-center">
        Live video is available in the iOS and Android development and production builds.
      </Text>
    </View>
  );
}
