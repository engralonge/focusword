import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { BrandMark } from '@/components/common/BrandMark';

type Props = {
  serverUrl: string;
  token: string;
  onError?: (message: string) => void;
};

export function LiveRoomPreview(_props: Props) {
  return (
    <View className="aspect-video bg-surface items-center justify-center">
      <BrandMark size={64} />
      <Text variant="caption" className="mt-2">Live preview is available in the mobile app.</Text>
    </View>
  );
}
