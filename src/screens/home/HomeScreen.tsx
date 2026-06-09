import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthProvider';
import { fetchReadingProgress } from '@/services/bible/bibleService';
import { fetchLiveStreams } from '@/services/streaming/streamingService';
import type { MainTabParamList } from '@/navigation/types';
import type { LiveStream } from '@/types';
import type { ReadingProgress } from '@/types/bible';
import { palette } from '@/constants/colors';

const DAILY_VERSES = [
  {
    text: "It is of the Lord's mercies that we are not consumed, because his compassions fail not.",
    reference: 'Lamentations 3:22',
  },
  {
    text: 'Be still, and know that I am God.',
    reference: 'Psalm 46:10',
  },
  {
    text: 'But seek first God’s Kingdom and his righteousness.',
    reference: 'Matthew 6:33',
  },
] as const;

type QuickActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <Pressable
      className="flex-1 min-w-[140px] rounded-2xl border border-brand/20 bg-brand/[0.05] px-4 py-4 active:bg-brand/10"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="w-10 h-10 rounded-xl bg-brand/12 items-center justify-center mb-3">
        <Ionicons name={icon} size={20} color={palette.brandLight} />
      </View>
      <Text className="font-semibold">{label}</Text>
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const { session } = useAuth();
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [liveStudies, setLiveStudies] = useState<LiveStream[]>([]);

  const load = useCallback(async () => {
    const [readingResult, liveResult] = await Promise.allSettled([
      fetchReadingProgress(),
      fetchLiveStreams(),
    ]);
    if (readingResult.status === 'fulfilled') {
      setProgress(readingResult.value);
    }
    if (liveResult.status === 'fulfilled') {
      setLiveStudies(liveResult.value.filter((stream) => stream.status === 'live').slice(0, 2));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);
  const verse = DAILY_VERSES[new Date().getDate() % DAILY_VERSES.length];
  const firstName = session?.user.displayName?.trim().split(/\s+/)[0] || 'Friend';

  return (
    <ScreenContainer contentClassName="px-5">
      <View className="pt-4 pb-5 flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text variant="label">{greeting}</Text>
          <Text variant="title" className="mt-1">{firstName}</Text>
        </View>
        <View className="w-11 h-11 rounded-full border border-brand/35 bg-brand/10 items-center justify-center">
          <Text className="text-brand-light font-semibold">
            {firstName[0]?.toUpperCase()}
          </Text>
        </View>
      </View>

      <Card className="rounded-3xl border-brand/25 bg-brand/[0.06] p-6 overflow-hidden">
        <View className="absolute top-0 right-0 w-32 h-32 rounded-full bg-brand/[0.06] -mr-10 -mt-10" />
        <Ionicons name="book-outline" size={22} color={palette.brand} />
        <Text variant="label" className="mt-5">Today in the Word</Text>
        <Text className="mt-3 text-[22px] leading-8 text-scripture font-light">
          "{verse.text}"
        </Text>
        <Text className="mt-4 text-brand-light font-medium">{verse.reference}</Text>
      </Card>

      {progress ? (
        <Pressable
          className="mt-5 rounded-2xl border border-border bg-surface-elevated/90 p-5 active:opacity-85"
          onPress={() =>
            navigation.navigate('Bible', {
              screen: 'BibleReader',
              params: {
                book: progress.book,
                chapter: progress.chapter,
                verse: progress.verse,
                translation: progress.translation,
              },
            })
          }
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text variant="label">Your journey in the Word</Text>
              <Text variant="subtitle" className="mt-2">
                {progress.book} {progress.chapter}
              </Text>
              <Text variant="caption" className="mt-1">{progress.translation}</Text>
            </View>
            <View className="w-11 h-11 rounded-full border border-brand/25 bg-brand/10 items-center justify-center">
              <Ionicons name="arrow-forward" size={20} color={palette.brandLight} />
            </View>
          </View>
        </Pressable>
      ) : null}

      <View className="mt-7 mb-3 flex-row items-center justify-between">
        <Text variant="label">Gather and grow</Text>
        <View className="h-px flex-1 ml-4 bg-brand/10" />
      </View>
      <View className="flex-row flex-wrap gap-3">
        <QuickAction
          icon="book-outline"
          label="Read Bible"
          onPress={() => navigation.navigate('Bible', { screen: 'BibleMain' })}
        />
        <QuickAction
          icon="radio-outline"
          label="Live studies"
          onPress={() => navigation.navigate('Live', { screen: 'LiveHome' })}
        />
        <QuickAction
          icon="heart-outline"
          label="Prayer board"
          onPress={() => navigation.navigate('Prayer', { screen: 'PrayerMain' })}
        />
        <QuickAction
          icon="people-outline"
          label="Community"
          onPress={() => navigation.navigate('Community', { screen: 'CommunityMain' })}
        />
      </View>

      <View className="mt-7 mb-3 flex-row items-center justify-between">
        <Text variant="label">Live studies</Text>
        <Pressable onPress={() => navigation.navigate('Live', { screen: 'LiveHome' })}>
          <Text className="text-brand-muted text-sm font-medium">See all</Text>
        </Pressable>
      </View>
      {liveStudies.length ? (
        liveStudies.map((stream) => (
          <Pressable
            key={stream.id}
            className="mb-3 rounded-2xl border border-live/25 bg-live/[0.06] px-4 py-4"
            onPress={() =>
              navigation.navigate('Live', {
                screen: 'LiveStream',
                params: { streamId: stream.id },
              })
            }
          >
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-2 h-2 rounded-full bg-live" />
              <Text className="text-live text-xs font-semibold uppercase">Live now</Text>
            </View>
            <Text variant="subtitle">{stream.title}</Text>
            <Text variant="caption" className="mt-1">Hosted by {stream.hostName}</Text>
          </Pressable>
        ))
      ) : (
        <Card className="border-brand/12 bg-brand/[0.04]">
          <Text variant="subtitle">A peaceful space to gather</Text>
          <Text variant="caption" className="mt-2 leading-5">
            Host a study or return when someone in the community goes live.
          </Text>
        </Card>
      )}
    </ScreenContainer>
  );
}
