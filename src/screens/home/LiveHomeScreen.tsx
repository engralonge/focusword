import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Header } from '@/components/common/Header';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { LiveStreamCard } from '@/components/live/LiveStreamCard';
import type { LiveStackParamList } from '@/navigation/types';
import type { LiveStream } from '@/types';
import { fetchLiveStreams } from '@/services/streaming/streamingService';
import { palette } from '@/constants/colors';
import { groupLiveStreams } from '@/utils/live';

type Nav = NativeStackNavigationProp<LiveStackParamList, 'LiveHome'>;

export function LiveHomeScreen() {
  const navigation = useNavigation<Nav>();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStreams(await fetchLiveStreams());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load live studies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const { live: liveNow, upcoming, recent } = groupLiveStreams(streams);
  const openStream = (stream: LiveStream) =>
    navigation.navigate('LiveStream', { streamId: stream.id });

  return (
    <>
      <ScreenContainer contentClassName="px-5">
        <Header title="Live studies" subtitle="Gather around God's Word in real time" />
        <Card className="mb-6 rounded-3xl border-brand/20 bg-brand/[0.05] p-5">
          <View className="w-11 h-11 rounded-xl bg-brand/12 border border-brand/20 items-center justify-center mb-4">
            <Ionicons name="radio-outline" size={22} color={palette.brandLight} />
          </View>
          <Text variant="subtitle">Your Bible study</Text>
          <Text variant="caption" className="mt-2 leading-5">
            Read, discuss, and pray together with your community.
          </Text>
        </Card>
        {error ? (
          <Pressable onPress={() => void load()} accessibilityRole="button">
            <Text className="text-red-500 text-center mb-4">{error} Tap to retry.</Text>
          </Pressable>
        ) : null}
        {loading ? <Text variant="caption">Loading live studies...</Text> : null}
        {!loading && streams.length === 0 ? (
          <EmptyState
            title="No studies yet"
            message="Host the first live Bible study for your community."
          />
        ) : null}
        {liveNow.length ? (
          <>
            <Text variant="label" className="mb-3">Live now</Text>
            {liveNow.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} onPress={() => openStream(stream)} />
            ))}
          </>
        ) : null}
        {upcoming.length ? (
          <>
            <Text variant="label" className="mt-6 mb-3">Upcoming</Text>
            {upcoming.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} onPress={() => openStream(stream)} />
            ))}
          </>
        ) : null}
        {recent.length ? (
          <>
            <Text variant="label" className="mt-6 mb-3">Recent gatherings</Text>
            {recent.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} onPress={() => openStream(stream)} />
            ))}
          </>
        ) : null}
        <View className="h-20" />
      </ScreenContainer>
      <Pressable
        className="absolute bottom-8 right-5 w-14 h-14 rounded-2xl bg-brand items-center justify-center shadow-lg border border-brand-light/30"
        accessibilityRole="button"
        accessibilityLabel="Host a live Bible study"
        onPress={() => navigation.navigate('CreateStream')}
      >
        <Ionicons name="videocam-outline" size={25} color={palette.backgroundDark} />
      </Pressable>
    </>
  );
}
