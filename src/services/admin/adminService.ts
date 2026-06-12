import { getSupabaseClient } from '@/services/supabase/client';
import type {
  AdminDashboard,
  AdminErrorEvent,
  AdminLiveStream,
  AdminNotificationDelivery,
  AdminUser,
} from '@/types';

async function requireAdminClient() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Your session has expired. Sign in again.');
  return supabase;
}

const emptyDashboard: AdminDashboard = {
  metrics: {
    members: 0,
    newMembers7d: 0,
    liveNow: 0,
    scheduledStudies: 0,
    openReports: 0,
    activeSanctions: 0,
    openErrors: 0,
    failedPushes: 0,
    enabledDevices: 0,
    posts7d: 0,
    prayers7d: 0,
  },
  liveStreams: [],
  errors: [],
  deliveries: [],
  audit: [],
};

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const supabase = await requireAdminClient();
  const { data, error } = await supabase.rpc('admin_dashboard');
  if (error) throw new Error(error.message);
  return data ? data as AdminDashboard : emptyDashboard;
}

export async function searchAdminUsers(query = ''): Promise<AdminUser[]> {
  const supabase = await requireAdminClient();
  const { data, error } = await supabase.rpc('admin_search_users', {
    requested_query: query.trim(),
    requested_limit: 40,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((user: {
    id: string;
    display_name: string;
    email: string;
    role: string;
    account_status: string;
    suspended_until: string | null;
    created_at: string;
  }) => ({
    id: user.id,
    displayName: user.display_name,
    email: user.email,
    role: user.role as AdminUser['role'],
    accountStatus: user.account_status as AdminUser['accountStatus'],
    suspendedUntil: user.suspended_until ?? undefined,
    createdAt: user.created_at,
  }));
}

export async function setAdminUserRole(
  userId: string,
  role: AdminUser['role'],
): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase.rpc('admin_set_user_role', {
    requested_user_id: userId,
    requested_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function retryNotificationDelivery(
  delivery: AdminNotificationDelivery,
): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase.rpc('admin_retry_notification', {
    requested_delivery_id: delivery.id,
  });
  if (error) throw new Error(error.message);
}

export async function reviewAppError(
  errorEvent: AdminErrorEvent,
  status: 'acknowledged' | 'resolved',
): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase.rpc('admin_review_error', {
    requested_error_id: errorEvent.id,
    requested_status: status,
  });
  if (error) throw new Error(error.message);
}

export async function forceEndLiveStream(stream: AdminLiveStream): Promise<void> {
  const supabase = await requireAdminClient();
  const { error } = await supabase.rpc('admin_end_live_stream', {
    requested_stream_id: stream.id,
  });
  if (error) throw new Error(error.message);
}
