import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { LiveBadge } from '@/components/live/LiveBadge';
import type { LiveStream } from '@/types';
import { palette } from '@/constants/colors';

type Props = {
  stream: LiveStream;
  onPress: () => void;
};

export function LiveStreamCard({ stream, onPress }: Props) {
  const scheduleLabel = stream.scheduledAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(stream.scheduledAt))
    : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${stream.title}, ${stream.status}`}
    >
      <Card className="mb-3">
        <View className="flex-row items-start justify-between">
          <LiveBadge status={stream.status} />
          {stream.status === 'live' ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="eye-outline" size={14} color={palette.muted} />
              <Text variant="caption">{stream.viewerCount}</Text>
            </View>
          ) : null}
        </View>
        <Text variant="subtitle" className="mt-2">{stream.title}</Text>
        <Text variant="caption" className="mt-1">Hosted by {stream.hostName}</Text>
        {scheduleLabel ? (
          <View className="flex-row items-center gap-2 mt-2">
            <Ionicons name="calendar-outline" size={15} color={palette.muted} />
            <Text variant="caption">{scheduleLabel}</Text>
          </View>
        ) : null}
        {stream.description ? (
          <Text variant="body" numberOfLines={2} className="mt-2">
            {stream.description}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
