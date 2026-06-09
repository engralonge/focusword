import { View } from 'react-native';
import { Text } from '@/components/ui/Text';

type Props = {
  title: string;
  subtitle?: string;
};

export function Header({ title, subtitle }: Props) {
  return (
    <View className="px-4 pt-2 pb-4">
      <Text variant="title">{title}</Text>
      {subtitle ? <Text variant="caption" className="mt-1">{subtitle}</Text> : null}
    </View>
  );
}