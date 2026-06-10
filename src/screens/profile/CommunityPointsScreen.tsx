import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import type { ProfileStackParamList } from '@/navigation/types';
import type { CommunityPointOverview } from '@/types';
import {
  COMMUNITY_POINT_DETAILS,
  fetchCommunityPointOverview,
} from '@/services/rewards/rewardService';
import { palette } from '@/constants/colors';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'CommunityPoints'>;

function formatActivityDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function CommunityPointsScreen() {
  const navigation = useNavigation<Nav>();
  const [overview, setOverview] = useState<CommunityPointOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await fetchCommunityPointOverview());
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Could not load community points.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScreenContainer contentClassName="px-5">
      <View className="pt-2 flex-row items-center">
        <Pressable
          className="w-11 h-11 -ml-2 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
        >
          <Ionicons name="chevron-back" size={25} color={palette.brandLight} />
        </Pressable>
        <Text variant="title" className="ml-1">Community points</Text>
      </View>

      <Text variant="caption" className="mt-2 leading-5">
        A record of faithful study and service. Points cannot be bought, transferred,
        redeemed, or exchanged for money or cryptocurrency.
      </Text>

      {error ? (
        <Card className="mt-5 border-red-500/30">
          <Text className="text-red-400">{error}</Text>
          <Button
            title="Try again"
            variant="secondary"
            className="mt-4"
            onPress={() => void load()}
          />
        </Card>
      ) : null}

      {loading ? <Text variant="caption" className="mt-6">Loading your activity...</Text> : null}

      {!loading && overview ? (
        <>
          <View className="mt-6 flex-row gap-3">
            <Card className="flex-1 items-center">
              <Ionicons name="sparkles-outline" size={20} color={palette.brand} />
              <Text className="mt-2 text-[28px] leading-9 font-light text-scripture">
                {overview.totalPoints}
              </Text>
              <Text variant="caption" className="mt-1 text-center">Total points</Text>
            </Card>
            <Card className="flex-1 items-center">
              <Ionicons name="flame-outline" size={20} color={palette.brand} />
              <Text className="mt-2 text-[28px] leading-9 font-light text-scripture">
                {overview.currentStreak}
              </Text>
              <Text variant="caption" className="mt-1 text-center">Day streak</Text>
            </Card>
          </View>

          <View className="mt-3 flex-row items-center justify-between rounded-2xl border border-brand/20 bg-brand/[0.05] px-4 py-4">
            <View>
              <Text variant="label">Today</Text>
              <Text className="mt-1 font-semibold">{overview.todayPoints} points</Text>
            </View>
            <Text variant="caption">{overview.completedActions} rewarded actions</Text>
          </View>

          <Text variant="label" className="mt-8 mb-3">Ways to grow</Text>
          <View className="rounded-2xl border border-border overflow-hidden bg-surface-elevated/80">
            {Object.entries(COMMUNITY_POINT_DETAILS).map(([kind, detail], index, items) => (
              <View
                key={kind}
                className={`flex-row items-center gap-3 px-4 py-4 ${
                  index < items.length - 1 ? 'border-b border-border-subtle' : ''
                }`}
              >
                <View className="w-9 h-9 rounded-xl bg-brand/10 items-center justify-center">
                  <Ionicons name="leaf-outline" size={18} color={palette.brand} />
                </View>
                <View className="flex-1">
                  <Text className="font-medium">{detail.label}</Text>
                  <Text variant="caption" className="mt-1 leading-5">
                    {detail.description}
                  </Text>
                  <Text className="mt-1 text-xs font-medium text-brand-muted">
                    {detail.reward}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Text variant="label" className="mt-8 mb-3">Recent activity</Text>
          {overview.recentActivity.length ? (
            overview.recentActivity.map((event) => {
              const detail = COMMUNITY_POINT_DETAILS[event.kind];
              return (
                <View
                  key={event.id}
                  className="mb-3 flex-row items-center rounded-2xl border border-border bg-surface-elevated/80 px-4 py-4"
                >
                  <View className="flex-1 pr-3">
                    <Text className="font-medium">{detail.label}</Text>
                    <Text variant="caption" className="mt-1">
                      {formatActivityDate(event.createdAt)}
                    </Text>
                  </View>
                  <Text className="font-semibold text-brand-light">+{event.points}</Text>
                </View>
              );
            })
          ) : (
            <Card className="border-brand/12 bg-brand/[0.04]">
              <Text variant="subtitle">Your journey starts here</Text>
              <Text variant="caption" className="mt-2 leading-5">
                Complete a Focus Mode study, encourage someone, or contribute to a live
                gathering to begin.
              </Text>
            </Card>
          )}
        </>
      ) : null}
      <View className="h-8" />
    </ScreenContainer>
  );
}
