import { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/common/Avatar';
import type { ActivityEvent } from '@/types';
import {
  fetchActivityEvents,
  markActivityRead,
} from '@/services/activity/activityService';
import { palette } from '@/constants/colors';

const icons: Record<ActivityEvent['kind'], keyof typeof Ionicons.glyphMap> = {
  comment: 'chatbubble-outline',
  reaction: 'heart-outline',
  prayer_support: 'heart-circle-outline',
  stage_invitation: 'videocam-outline',
  stage_update: 'radio-outline',
  points: 'sparkles-outline',
  live_reminder: 'alarm-outline',
};

export function ActivityInboxScreen() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await fetchActivityEvents());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const openEvent = async (event: ActivityEvent) => {
    if (!event.read) {
      await markActivityRead(event.id);
      setEvents((current) =>
        current.map((item) => item.id === event.id ? { ...item, read: true } : item),
      );
    }
    if (event.url) await Linking.openURL(event.url);
  };

  const markAll = async () => {
    await markActivityRead();
    setEvents((current) => current.map((event) => ({ ...event, read: true })));
  };

  const unread = events.filter((event) => !event.read).length;

  return (
    <ScreenContainer contentClassName="px-5">
      <Header title="Activity" subtitle="Replies, invitations, prayer, and progress" />
      {unread ? (
        <Pressable
          className="mb-4 self-end"
          accessibilityRole="button"
          onPress={() => void markAll()}
        >
          <Text className="text-sm font-medium text-brand-light">Mark all read</Text>
        </Pressable>
      ) : null}
      {error ? (
        <Pressable onPress={() => void load()}>
          <Text className="mb-4 text-center text-red-400">{error} Tap to retry.</Text>
        </Pressable>
      ) : null}
      {loading ? <Text variant="caption">Loading activity...</Text> : null}
      {!loading && !events.length ? (
        <Card className="border-brand/12 bg-brand/[0.04]">
          <Text variant="subtitle">All quiet for now</Text>
          <Text variant="caption" className="mt-2 leading-5">
            Replies, prayer support, live invitations, and points will appear here.
          </Text>
        </Card>
      ) : null}
      {events.map((event) => (
        <Pressable
          key={event.id}
          className={`mb-3 flex-row gap-3 rounded-2xl border px-4 py-4 ${
            event.read
              ? 'border-border bg-surface-elevated/70'
              : 'border-brand/35 bg-brand/[0.07]'
          }`}
          accessibilityRole="button"
          onPress={() => void openEvent(event)}
        >
          {event.actorName ? (
            <Avatar
              displayName={event.actorName}
              avatarUrl={event.actorAvatarUrl}
              size="sm"
            />
          ) : (
            <View className="w-9 h-9 rounded-full bg-brand/12 items-center justify-center">
              <Ionicons name={icons[event.kind]} size={18} color={palette.brand} />
            </View>
          )}
          <View className="flex-1">
            <View className="flex-row items-start">
              <Text className="flex-1 font-semibold">{event.title}</Text>
              {!event.read ? <View className="mt-2 w-2 h-2 rounded-full bg-brand" /> : null}
            </View>
            {event.body ? <Text variant="caption" className="mt-1 leading-5">{event.body}</Text> : null}
            <Text variant="caption" className="mt-2">
              {new Date(event.createdAt).toLocaleString()}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}
