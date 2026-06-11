import { Image, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { cn } from '@/utils/cn';

type Props = {
  displayName: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: { container: 'w-9 h-9', text: 'text-sm' },
  md: { container: 'w-11 h-11', text: 'text-base' },
  lg: { container: 'w-[88px] h-[88px]', text: 'text-2xl' },
} as const;

export function Avatar({
  displayName,
  avatarUrl,
  size = 'md',
  className,
}: Props) {
  const dimensions = sizes[size];
  return (
    <View
      className={cn(
        dimensions.container,
        'rounded-full overflow-hidden bg-surface-elevated border border-brand/35 items-center justify-center',
        className,
      )}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          className="w-full h-full"
          resizeMode="cover"
          accessibilityLabel={`${displayName}'s profile photo`}
        />
      ) : (
        <Text className={cn('font-semibold text-brand-light', dimensions.text)}>
          {(displayName.trim()[0] || 'G').toUpperCase()}
        </Text>
      )}
    </View>
  );
}
