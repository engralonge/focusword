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
  primary: 'bg-brand border border-brand-light/25 active:opacity-85',
  secondary: 'bg-brand/10 border border-brand/30 active:bg-brand/15',
  ghost: 'bg-transparent active:opacity-70',
  danger: 'bg-red-700 active:opacity-80',
};

const textClasses: Record<Variant, string> = {
  primary: 'text-ink font-semibold tracking-wide',
  secondary: 'text-brand-light font-semibold',
  ghost: 'text-brand-light font-medium',
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
        'min-h-[48px] rounded-2xl px-5 py-3 items-center justify-center',
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
