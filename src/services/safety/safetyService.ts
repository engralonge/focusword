import type {
  BlockedUser,
  ModerationAuditEvent,
  ModerationReport,
  ReportReason,
  ReportTargetType,
  UserSanction,
} from '@/types';
import { getSupabaseClient } from '@/services/supabase/client';

async function requireUser() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Your session has expired. Sign in again.');
  return { supabase, user: data.user };
}

export async function reportContent(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  details?: string,
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('report_content', {
    requested_target_type: targetType,
    requested_target_id: targetId,
    requested_reason: reason,
    requested_details: details?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function blockUser(userId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  if (userId === user.id) throw new Error('You cannot block your own account.');
  const { error } = await supabase.from('user_blocks').upsert({
    blocker_id: user.id,
    blocked_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function unblockUser(userId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId);
  if (error) throw new Error(error.message);
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { supabase, user } = await requireUser();
  const { data: blocks, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!blocks?.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', blocks.map((block) => block.blocked_id));
  if (profileError) throw new Error(profileError.message);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return blocks.map((block) => {
    const profile = profileMap.get(block.blocked_id);
    return {
      userId: block.blocked_id,
      displayName: profile?.display_name?.trim() || 'Community member',
      avatarUrl: profile?.avatar_url ?? undefined,
      blockedAt: block.created_at,
    };
  });
}

export async function fetchModerationReports(): Promise<ModerationReport[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('content_reports')
    .select(
      'id, target_type, target_id, target_user_id, target_display_name, reason, details, content_excerpt, status, resolution_note, created_at',
    )
    .in('status', ['open', 'reviewing'])
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((report) => ({
    id: report.id,
    targetType: report.target_type as ReportTargetType,
    targetId: report.target_id,
    targetUserId: report.target_user_id,
    targetDisplayName: report.target_display_name,
    reason: report.reason as ReportReason,
    details: report.details ?? undefined,
    contentExcerpt: report.content_excerpt ?? undefined,
    status: report.status as ModerationReport['status'],
    resolutionNote: report.resolution_note ?? undefined,
    createdAt: report.created_at,
  }));
}

export async function moderateReport(
  reportId: string,
  action: 'reviewing' | 'dismiss' | 'hide' | 'remove',
  note?: string,
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('moderate_report', {
    requested_report_id: reportId,
    requested_action: action,
    requested_note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function applyUserSanction(
  report: ModerationReport,
  kind: 'suspension' | 'ban',
  reason: string,
  durationHours?: number,
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('apply_user_sanction', {
    requested_user_id: report.targetUserId,
    requested_kind: kind,
    requested_reason: reason.trim(),
    requested_duration_hours: durationHours ?? null,
    requested_report_id: report.id,
  });
  if (error) throw new Error(error.message);
}

export async function fetchModerationAudit(): Promise<ModerationAuditEvent[]> {
  const { supabase } = await requireUser();
  const { data: events, error } = await supabase
    .from('moderation_audit_log')
    .select('id, action, target_user_id, note, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const userIds = [...new Set((events ?? []).flatMap((event) => event.target_user_id ?? []))];
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  return (events ?? []).map((event) => ({
    id: event.id,
    action: event.action,
    targetDisplayName: event.target_user_id
      ? names.get(event.target_user_id) ?? 'Community member'
      : undefined,
    note: event.note ?? undefined,
    createdAt: event.created_at,
  }));
}

export async function fetchActiveSanctions(): Promise<UserSanction[]> {
  const { supabase } = await requireUser();
  const { data: sanctions, error } = await supabase
    .from('user_sanctions')
    .select('id, user_id, kind, reason, ends_at, starts_at')
    .eq('active', true)
    .or(`kind.eq.ban,ends_at.gt.${new Date().toISOString()}`)
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!sanctions?.length) return [];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', sanctions.map((sanction) => sanction.user_id));
  if (profileError) throw new Error(profileError.message);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  return sanctions.map((sanction) => ({
    id: sanction.id,
    userId: sanction.user_id,
    displayName: names.get(sanction.user_id)?.trim() || 'Community member',
    kind: sanction.kind as UserSanction['kind'],
    reason: sanction.reason,
    endsAt: sanction.ends_at ?? undefined,
    createdAt: sanction.starts_at,
  }));
}

export async function revokeUserSanction(userId: string, reason?: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('revoke_user_sanction', {
    requested_user_id: userId,
    requested_reason: reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
}
