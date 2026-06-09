import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Header } from '@/components/common/Header';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/common/EmptyState';
import { LiveStreamCard } from '@/components/live/LiveStreamCard';
import type { HomeStackParamList } from '@/navigation/types';
import type { LiveStream } from '@/types';
import { fetchLiveStreams } from '@/services/streaming/streamingService';
import { config } from '@/constants/config';
import { palette } from '@/constants/colors';
import { groupLiveStreams } from '@/utils/live';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'LiveHome'>;

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
      <ScreenContainer contentClassName="px-4">
        <Header title={config.appName} subtitle="Study Scripture together in real time" />
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
            <Text variant="label" className="mb-2">Live now</Text>
            {liveNow.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} onPress={() => openStream(stream)} />
            ))}
          </>
        ) : null}
        {upcoming.length ? (
          <>
            <Text variant="label" className="mt-5 mb-2">Upcoming</Text>
            {upcoming.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} onPress={() => openStream(stream)} />
            ))}
          </>
        ) : null}
        {recent.length ? (
          <>
            <Text variant="label" className="mt-5 mb-2">Recent</Text>
            {recent.map((stream) => (
              <LiveStreamCard key={stream.id} stream={stream} onPress={() => openStream(stream)} />
            ))}
          </>
        ) : null}
        <View className="h-20" />
      </ScreenContainer>
      <Pressable
        className="absolute bottom-8 right-4 w-14 h-14 rounded-full bg-brand items-center justify-center shadow-lg"
        accessibilityRole="button"
        accessibilityLabel="Host a live Bible study"
        onPress={() => navigation.navigate('CreateStream')}
      >
        <Ionicons name="add" size={28} color={palette.backgroundDark} />
      </Pressable>
    </>
  );
}
