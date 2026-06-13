import { Image, View, type ViewProps } from 'react-native';
import { cn } from '@/utils/cn';

type Props = ViewProps & {
  size?: number;
  framed?: boolean;
  className?: string;
};

const brandMark = require('../../../assets/brand/citizens-bible-community-in-app.jpg');

export function BrandMark({
  size = 40,
  framed = false,
  className,
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
        source={brandMark}
        resizeMode="contain"
        style={{
          width: framed ? size * 0.94 : size,
          height: framed ? size * 0.94 : size,
          borderRadius: framed ? Math.max(8, size * 0.18) : 0,
        }}
        accessibilityLabel="Citizens Bible Community logo"
      />
    </View>
  );
}
