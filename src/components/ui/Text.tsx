import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/utils/cn';

type Variant = 'title' | 'subtitle' | 'body' | 'caption' | 'label';

type Props = RNTextProps & {
  variant?: Variant;
  className?: string;
};

const variantClasses: Record<Variant, string> = {
  title: 'text-2xl font-bold text-foreground-light dark:text-foreground',
  subtitle: 'text-lg font-semibold text-foreground-light dark:text-foreground',
  body: 'text-base text-foreground-light dark:text-foreground',
  caption: 'text-sm text-muted',
  label: 'text-xs font-medium uppercase tracking-wide text-muted',
};

export function Text({ variant = 'body', className, ...props }: Props) {
  return <RNText className={cn(variantClasses[variant], className)} {...props} />;
}