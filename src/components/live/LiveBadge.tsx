import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import type { LiveStreamStatus } from '@/types';

type Props = {
  status: LiveStreamStatus;
};

const labels: Record<LiveStreamStatus, string> = {
  live: 'LIVE',
  scheduled: 'UPCOMING',
  ended: 'ENDED',
};

const styles: Record<LiveStreamStatus, string> = {
  live: 'bg-red-600',
  scheduled: 'bg-brand/20 border border-brand',
  ended: 'bg-muted/30',
};

export function LiveBadge({ status }: Props) {
  return (
    <View className={`px-2 py-0.5 rounded-md ${styles[status]}`}>
      <Text
        variant="label"
        className={status === 'live' ? 'text-white' : 'text-brand'}
      >
        {labels[status]}
      </Text>
    </View>
  );
}