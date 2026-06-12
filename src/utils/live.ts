import type { LiveStream } from '@/types';

export const LIVE_TITLE_MIN_LENGTH = 3;
export const LIVE_TITLE_MAX_LENGTH = 120;
export const LIVE_DESCRIPTION_MAX_LENGTH = 2000;
export const LIVE_REMINDER_LEAD_MS = 10 * 60 * 1000;
export const LIVE_CREDENTIAL_REFRESH_AFTER_MS = 5 * 60 * 1000;

export function validateLiveStudy(input: {
  title: string;
  description?: string;
  startNow: boolean;
  scheduledAt?: string;
}): void {
  const titleLength = input.title.trim().length;
  if (titleLength < LIVE_TITLE_MIN_LENGTH || titleLength > LIVE_TITLE_MAX_LENGTH) {
    throw new Error('Live study titles must be between 3 and 120 characters.');
  }
  if ((input.description?.trim().length ?? 0) > LIVE_DESCRIPTION_MAX_LENGTH) {
    throw new Error('Descriptions cannot exceed 2,000 characters.');
  }
  if (!input.startNow) {
    if (!input.scheduledAt) {
      throw new Error('Choose a date and time for the live study.');
    }
    const timestamp = new Date(input.scheduledAt).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      throw new Error('Choose a future date and time.');
    }
  }
}

export function getReminderDate(scheduledAt: string, now = Date.now()): Date {
  const start = new Date(scheduledAt).getTime();
  if (!Number.isFinite(start)) {
    throw new Error('This live study has an invalid scheduled time.');
  }
  const reminder = new Date(start - LIVE_REMINDER_LEAD_MS);
  if (reminder.getTime() <= now) {
    throw new Error('This live study starts too soon for a reminder.');
  }
  return reminder;
}

export function groupLiveStreams(streams: LiveStream[]) {
  return {
    live: streams.filter((stream) => stream.status === 'live'),
    upcoming: streams
      .filter((stream) => stream.status === 'scheduled')
      .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')),
    recent: streams.filter((stream) => stream.status === 'ended').slice(0, 10),
  };
}

export function shouldRefreshLiveCredentials(
  backgroundedAt: number | null,
  now = Date.now(),
): boolean {
  return (
    backgroundedAt !== null &&
    now - backgroundedAt >= LIVE_CREDENTIAL_REFRESH_AFTER_MS
  );
}
