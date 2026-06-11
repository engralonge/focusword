import {
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/utils/cn';

type Props = ViewProps & {
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
  scrollViewProps?: ScrollViewProps;
};

export function ScreenContainer({
  scroll = true,
  className,
  contentClassName,
  scrollViewProps,
  children,
  ...props
}: Props) {
  const body = scroll ? (
    <ScrollView
      className={cn('flex-1', contentClassName)}
      contentContainerClassName="pb-10"
      showsVerticalScrollIndicator={false}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cn('flex-1', contentClassName)} {...props}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      className={cn('flex-1 bg-background', className)}
      edges={['top']}
    >
      {body}
    </SafeAreaView>
  );
}
