import { getSupabaseClient } from '@/services/supabase/client';
import type {
  CommunityPointEvent,
  CommunityPointKind,
  CommunityPointOverview,
} from '@/types';

export const COMMUNITY_POINT_DETAILS: Record<
  CommunityPointKind,
  { label: string; description: string; reward: string }
> = {
  focus_completion: {
    label: 'Focused study',
    description: 'Completed at least 15 minutes in Focus Mode',
    reward: '1 point per minute, up to 30',
  },
  community_post: {
    label: 'Community reflection',
    description: 'Shared a thoughtful reflection with the community',
    reward: '5 points, twice daily',
  },
  community_comment: {
    label: 'Encouraging reply',
    description: 'Added a meaningful response to a discussion',
    reward: '3 points, five times daily',
  },
  prayer_support: {
    label: 'Prayer support',
    description: 'Prayed for another community member',
    reward: '5 points, five times daily',
  },
  testimony: {
    label: 'Testimony shared',
    description: 'Marked a prayer journey with a testimony',
    reward: '15 points, once daily',
  },
  live_host: {
    label: 'Study hosted',
    description: 'Hosted a live Bible study for at least 10 minutes',
    reward: '20 points, twice daily',
  },
  live_attendance: {
    label: 'Live study attended',
    description: 'Stayed present in a live Bible study for at least 15 minutes',
    reward: '15 points, three times daily',
  },
  live_stage: {
    label: 'Live contribution',
    description: 'Connected to an approved guest stage during a live study',
    reward: '10 points, three times daily',
  },
};

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function mapEvent(row: Record<string, unknown>): CommunityPointEvent {
  return {
    id: String(row.id),
    kind: row.kind as CommunityPointKind,
    points: Number(row.points),
    createdAt: String(row.created_at),
  };
}

export async function fetchCommunityPointOverview(): Promise<CommunityPointOverview> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Your session has expired. Sign in again.');
  }

  const [summaryResult, activityResult] = await Promise.all([
    supabase.rpc('get_my_community_point_summary', {
      requested_timezone: getTimeZone(),
    }),
    supabase
      .from('community_point_events')
      .select('id, kind, points, created_at')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  if (summaryResult.error) {
    throw new Error(summaryResult.error.message);
  }
  if (activityResult.error) {
    throw new Error(activityResult.error.message);
  }

  const summary = Array.isArray(summaryResult.data)
    ? summaryResult.data[0]
    : summaryResult.data;
  return {
    totalPoints: Number(summary?.total_points ?? 0),
    todayPoints: Number(summary?.today_points ?? 0),
    currentStreak: Number(summary?.current_streak ?? 0),
    completedActions: Number(summary?.completed_actions ?? 0),
    recentActivity: (activityResult.data ?? []).map((row) =>
      mapEvent(row as Record<string, unknown>),
    ),
  };
}
