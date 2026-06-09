import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/utils/cn';

type Variant = 'title' | 'subtitle' | 'body' | 'caption' | 'label';

type Props = RNTextProps & {
  variant?: Variant;
  className?: string;
};

const variantClasses: Record<Variant, string> = {
  title: 'text-[28px] leading-9 font-light tracking-sacred text-foreground',
  subtitle: 'text-lg font-semibold tracking-sacred text-foreground',
  body: 'text-base leading-6 text-foreground/95',
  caption: 'text-sm text-muted',
  label: 'text-[10px] font-semibold uppercase tracking-brand text-brand-muted',
};

export function Text({ variant = 'body', className, ...props }: Props) {
  return <RNText className={cn(variantClasses[variant], className)} {...props} />;
}
