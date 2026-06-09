import { View, type ViewProps } from 'react-native';
import { cn } from '@/utils/cn';

type Props = ViewProps & {
  className?: string;
};

export function Card({ className, children, ...props }: Props) {
  return (
    <View
      className={cn(
        'rounded-2xl bg-surface-elevated/90 p-4 border border-brand/15',
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}
