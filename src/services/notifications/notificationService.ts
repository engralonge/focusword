import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { LiveStream } from '@/types';
import type { NotificationPreferences } from '@/types';
import { removeReminder, saveReminder } from '@/services/streaming/streamingService';
import { getSupabaseClient } from '@/services/supabase/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermission(): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Push notifications are available in the iOS and Android apps.');
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('community-updates', {
      name: 'Community updates',
      description: 'Replies, prayer support, live invitations, and community progress.',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync('live-study-reminders', {
      name: 'Live study reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    throw new Error('Notification permission is required to set reminders.');
  }
}

export async function registerPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  await ensureNotificationPermission();
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error('The EAS project ID is missing from the app configuration.');
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('register_push_token', {
    requested_token: token,
    requested_platform: Platform.OS,
    requested_device_name: Device.modelName ?? Device.deviceName ?? null,
    requested_app_version: Constants.expoConfig?.version ?? null,
  });
  if (error) throw new Error(error.message);
  return token;
}

export async function unregisterPushNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') return;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('unregister_push_token', {
    requested_token: token,
  });
  if (error) throw new Error(error.message);
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Your session has expired. Sign in again.');
  const defaults: NotificationPreferences = {
    live: true,
    community: true,
    prayer: true,
    points: true,
  };
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('live, community, prayer, points')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  const { data: created, error: createError } = await supabase
    .from('notification_preferences')
    .insert({ user_id: userData.user.id })
    .select('live, community, prayer, points')
    .single();
  if (createError) throw new Error(createError.message);
  return created ?? defaults;
}

export async function updateNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Your session has expired. Sign in again.');
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: userData.user.id,
    ...preferences,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getNotificationPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined' | 'unavailable'
> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status === 'granted') return 'granted';
  if (permissions.status === 'denied') return 'denied';
  return 'undetermined';
}

export async function scheduleLiveReminder(stream: LiveStream): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Live study reminders are available in the iOS and Android apps.');
  }
  if (!stream.scheduledAt) {
    throw new Error('This live study does not have a scheduled time.');
  }
  if (new Date(stream.scheduledAt).getTime() <= Date.now() + 10 * 60 * 1000) {
    throw new Error('This live study starts too soon for a reminder.');
  }
  await registerPushNotifications();
  await saveReminder(stream.id);
}

export async function cancelLiveReminder(streamId: string): Promise<void> {
  const notificationId = await removeReminder(streamId);
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
}
