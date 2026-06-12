import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import type { NotificationPreferences } from '@/types';
import {
  ensureNotificationPermission,
  fetchNotificationPreferences,
  getNotificationPermissionStatus,
  registerPushNotifications,
  updateNotificationPreferences,
} from '@/services/notifications/notificationService';
import { palette } from '@/constants/colors';

const preferenceRows: Array<{
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    key: 'live',
    title: 'Live studies',
    description: 'Invitations, stage updates, and reminders for studies you follow.',
    icon: 'radio-outline',
  },
  {
    key: 'community',
    title: 'Community activity',
    description: 'Responses and reactions to your reflections.',
    icon: 'chatbubbles-outline',
  },
  {
    key: 'prayer',
    title: 'Prayer support',
    description: 'Know when someone stands with you in prayer.',
    icon: 'heart-outline',
  },
  {
    key: 'points',
    title: 'Community points',
    description: 'Updates when verified participation earns points.',
    icon: 'sparkles-outline',
  },
];

export function NotificationSettingsScreen() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = useState<
    'granted' | 'denied' | 'undetermined' | 'unavailable'
  >('undetermined');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextPreferences, nextPermission] = await Promise.all([
        fetchNotificationPreferences(),
        getNotificationPermissionStatus(),
      ]);
      setPreferences(nextPreferences);
      setPermission(nextPermission);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load notification settings.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSaving(true);
    setError(null);
    try {
      await updateNotificationPreferences(next);
    } catch (nextError) {
      setPreferences(preferences);
      setError(nextError instanceof Error ? nextError.message : 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const enable = async () => {
    setSaving(true);
    setError(null);
    try {
      await ensureNotificationPermission();
      await registerPushNotifications();
      setPermission('granted');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not enable notifications.');
      setPermission(await getNotificationPermissionStatus());
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer contentClassName="px-5">
      <Card className="mt-3 mb-5 border-brand/20 bg-brand/[0.05]">
        <View className="flex-row items-center gap-3">
          <Ionicons name="notifications-outline" size={24} color={palette.brandLight} />
          <View className="flex-1">
            <Text variant="subtitle">Push notifications</Text>
            <Text variant="caption" className="mt-1">
              Choose which community moments may reach this device.
            </Text>
          </View>
        </View>
      </Card>
      {permission !== 'granted' ? (
        <View className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <Text className="font-semibold">
            {permission === 'denied' ? 'Notifications are blocked' : 'Notifications are not enabled'}
          </Text>
          <Text variant="caption" className="mt-1">
            {permission === 'denied'
              ? 'Open system settings to allow notifications for this app.'
              : 'Enable permission to receive community updates when the app is closed.'}
          </Text>
          <Button
            title={permission === 'denied' ? 'Open settings' : 'Enable notifications'}
            variant="secondary"
            className="mt-3"
            disabled={saving || permission === 'unavailable'}
            onPress={() =>
              permission === 'denied'
                ? void Linking.openSettings()
                : void enable()
            }
          />
        </View>
      ) : null}
      {error ? <Text className="mb-4 text-center text-red-500">{error}</Text> : null}
      {!preferences ? <Text variant="caption">Loading preferences...</Text> : null}
      {preferences ? (
        <View className="rounded-2xl border border-border overflow-hidden bg-surface-elevated/80">
          {preferenceRows.map((row, index) => (
            <View
              key={row.key}
              className={`flex-row items-center gap-3 px-4 py-4 ${
                index < preferenceRows.length - 1 ? 'border-b border-border-subtle' : ''
              }`}
            >
              <View className="w-10 h-10 rounded-xl bg-brand/10 items-center justify-center">
                <Ionicons name={row.icon} size={20} color={palette.brand} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold">{row.title}</Text>
                <Text variant="caption" className="mt-1 leading-5">{row.description}</Text>
              </View>
              <Switch
                value={preferences[row.key]}
                disabled={saving}
                onValueChange={() => void toggle(row.key)}
                trackColor={{ false: palette.muted, true: palette.brand }}
              />
            </View>
          ))}
        </View>
      ) : null}
    </ScreenContainer>
  );
}
