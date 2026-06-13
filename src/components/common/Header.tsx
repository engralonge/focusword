import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { BrandMark } from '@/components/common/BrandMark';

type Props = {
  title: string;
  subtitle?: string;
};

export function Header({ title, subtitle }: Props) {
  return (
    <View className="pt-3 pb-5 flex-row items-start gap-3">
      <BrandMark size={42} framed />
      <View className="flex-1 pt-0.5">
        <Text variant="title">{title}</Text>
        {subtitle ? <Text variant="caption" className="mt-1.5 leading-5">{subtitle}</Text> : null}
      </View>
    </View>
  );
}
