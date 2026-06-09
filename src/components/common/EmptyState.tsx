import { View } from 'react-native';
import { Text } from '@/components/ui/Text';

type Props = {
  title: string;
  message?: string;
};

export function EmptyState({ title, message }: Props) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <Text variant="subtitle" className="text-center">{title}</Text>
      {message ? (
        <Text variant="caption" className="mt-2 text-center">{message}</Text>
      ) : null}
    </View>
  );
}