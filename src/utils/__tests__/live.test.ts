import {
  getReminderDate,
  groupLiveStreams,
  shouldRefreshLiveCredentials,
  validateLiveStudy,
} from '@/utils/live';
import type { LiveStream, LiveStreamStatus } from '@/types';

function stream(
  id: string,
  status: LiveStreamStatus,
  scheduledAt?: string,
): LiveStream {
  return {
    id,
    title: `Study ${id}`,
    hostId: 'host',
    hostName: 'Host',
    status,
    roomName: `room-${id}`,
    viewerCount: 0,
    scheduledAt,
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    isHost: false,
    reminderSet: false,
    recordingRequested: false,
    recordingStatus: undefined,
  };
}

describe('live study domain rules', () => {
  it('requires a valid title and future schedule', () => {
    expect(() =>
      validateLiveStudy({ title: 'No', startNow: true }),
    ).toThrow('between 3 and 120');
    expect(() =>
      validateLiveStudy({
        title: 'John 3',
        startNow: false,
        scheduledAt: '2020-01-01T00:00:00.000Z',
      }),
    ).toThrow('future date');
  });

  it('accepts a valid immediate or scheduled study', () => {
    expect(() =>
      validateLiveStudy({ title: 'John 3', startNow: true }),
    ).not.toThrow();
    expect(() =>
      validateLiveStudy({
        title: 'John 3',
        startNow: false,
        scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).not.toThrow();
  });

  it('schedules reminders ten minutes before the study', () => {
    const start = '2026-06-08T12:00:00.000Z';
    expect(getReminderDate(start, Date.parse('2026-06-08T10:00:00.000Z')).toISOString())
      .toBe('2026-06-08T11:50:00.000Z');
    expect(() =>
      getReminderDate(start, Date.parse('2026-06-08T11:55:00.000Z')),
    ).toThrow('too soon');
  });

  it('groups live, upcoming, and ten recent studies', () => {
    const streams = [
      stream('later', 'scheduled', '2026-06-10T10:00:00.000Z'),
      stream('now', 'live'),
      stream('sooner', 'scheduled', '2026-06-09T10:00:00.000Z'),
      ...Array.from({ length: 12 }, (_, index) => stream(`ended-${index}`, 'ended')),
    ];
    const grouped = groupLiveStreams(streams);
    expect(grouped.live.map((item) => item.id)).toEqual(['now']);
    expect(grouped.upcoming.map((item) => item.id)).toEqual(['sooner', 'later']);
    expect(grouped.recent).toHaveLength(10);
  });

  it('refreshes room credentials after a meaningful background period', () => {
    const now = Date.parse('2026-06-12T12:00:00.000Z');
    expect(shouldRefreshLiveCredentials(null, now)).toBe(false);
    expect(shouldRefreshLiveCredentials(now - 60_000, now)).toBe(false);
    expect(shouldRefreshLiveCredentials(now - 5 * 60_000, now)).toBe(true);
  });
});
