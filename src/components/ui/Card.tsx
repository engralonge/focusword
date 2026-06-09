import { View, type ViewProps } from 'react-native';
import { cn } from '@/utils/cn';

type Props = ViewProps & {
  className?: string;
};

export function Card({ className, children, ...props }: Props) {
  return (
    <View
      className={cn(
        'rounded-2xl bg-surface-light dark:bg-surface p-4 border border-black/5 dark:border-white/5',
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}