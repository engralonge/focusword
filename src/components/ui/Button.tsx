import { Pressable, type PressableProps } from 'react-native';
import { Text } from '@/components/ui/Text';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = PressableProps & {
  title: string;
  variant?: Variant;
  className?: string;
};

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand active:opacity-80',
  secondary: 'bg-surface border border-brand/30 active:opacity-80',
  ghost: 'bg-transparent active:opacity-70',
  danger: 'bg-red-600 active:opacity-80',
};

const textClasses: Record<Variant, string> = {
  primary: 'text-background font-semibold',
  secondary: 'text-brand font-semibold',
  ghost: 'text-brand font-medium',
  danger: 'text-white font-semibold',
};

export function Button({
  title,
  variant = 'primary',
  className,
  disabled,
  ...props
}: Props) {
  return (
    <Pressable
      className={cn(
        'rounded-xl px-5 py-3 items-center justify-center',
        variantClasses[variant],
        disabled && 'opacity-50',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      <Text className={textClasses[variant]}>{title}</Text>
    </Pressable>
  );
}