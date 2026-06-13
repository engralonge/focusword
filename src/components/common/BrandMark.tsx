import { Image, View, type ViewProps } from 'react-native';
import { cn } from '@/utils/cn';

type Props = ViewProps & {
  size?: number;
  framed?: boolean;
  className?: string;
  imageClassName?: string;
};

const emblem = require('../../../assets/brand/citizens-bible-community-emblem.png');

export function BrandMark({
  size = 40,
  framed = false,
  className,
  imageClassName,
  ...props
}: Props) {
  return (
    <View
      className={cn(
        'items-center justify-center overflow-hidden',
        framed && 'rounded-xl border border-brand/30 bg-[#001430]',
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <Image
        source={emblem}
        resizeMode="contain"
        className={imageClassName}
        style={{
          width: framed ? size * 0.82 : size,
          height: framed ? size * 0.82 : size,
        }}
        accessibilityLabel="Citizens Bible Community logo"
      />
    </View>
  );
}
