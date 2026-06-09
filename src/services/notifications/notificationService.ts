import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { LiveStream } from '@/types';
import { removeReminder, saveReminder } from '@/services/streaming/streamingService';
import { getReminderDate } from '@/utils/live';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensurePermission(): Promise<void> {
  if (Platform.OS === 'android') {
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

export async function scheduleLiveReminder(stream: LiveStream): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Live study reminders are available in the iOS and Android apps.');
  }
  if (!stream.scheduledAt) {
    throw new Error('This live study does not have a scheduled time.');
  }
  const reminderAt = getReminderDate(stream.scheduledAt);

  await ensurePermission();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${stream.title} starts soon`,
      body: `Join ${stream.hostName} on FocusWord in 10 minutes.`,
      data: { url: `focusword://live/${stream.id}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderAt,
      channelId: Platform.OS === 'android' ? 'live-study-reminders' : undefined,
    },
  });
  await saveReminder(stream.id, notificationId);
}

export async function cancelLiveReminder(streamId: string): Promise<void> {
  const notificationId = await removeReminder(streamId);
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
}
