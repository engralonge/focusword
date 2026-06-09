import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { palette } from '@/constants/colors';

type Props = {
  title: string;
  message?: string;
};

export function EmptyState({ title, message }: Props) {
  return (
    <View className="items-center justify-center py-12 px-6 rounded-3xl border border-brand/15 bg-brand/[0.04]">
      <View className="w-14 h-14 rounded-full border border-brand/30 bg-brand/10 items-center justify-center mb-5">
        <Ionicons name="sparkles-outline" size={24} color={palette.brand} />
      </View>
      <Text variant="subtitle" className="text-center">{title}</Text>
      {message ? (
        <Text variant="caption" className="mt-2 text-center">{message}</Text>
      ) : null}
    </View>
  );
}
