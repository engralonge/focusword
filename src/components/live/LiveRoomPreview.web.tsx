import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { palette } from '@/constants/colors';

type Props = {
  serverUrl: string;
  token: string;
  onError?: (message: string) => void;
};

export function LiveRoomPreview(_props: Props) {
  return (
    <View className="aspect-video bg-surface items-center justify-center">
      <Ionicons name="phone-portrait-outline" size={28} color={palette.brand} />
      <Text variant="caption" className="mt-2">Live preview is available in the mobile app.</Text>
    </View>
  );
}
