import { View } from 'react-native';
import { Text } from '@/components/ui/Text';

type Props = {
  title: string;
  subtitle?: string;
};

export function Header({ title, subtitle }: Props) {
  return (
    <View className="pt-3 pb-5">
      <View className="w-8 h-[2px] rounded-full bg-brand/70 mb-3" />
      <Text variant="title">{title}</Text>
      {subtitle ? <Text variant="caption" className="mt-1.5 leading-5">{subtitle}</Text> : null}
    </View>
  );
}
