import { getSupabaseClient } from '@/services/supabase/client';
import type { FocusPreference, FocusSession } from '@/types';

const CONSENT_VERSION = '2026-06';

async function requireUser() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('Your session has expired. Sign in again.');
  }
  return { supabase, user: data.user };
}

function mapSession(row: Record<string, unknown>): FocusSession {
  return {
    id: String(row.id),
    plannedSeconds: Number(row.planned_seconds),
    focusedSeconds: Number(row.focused_seconds),
    interruptionCount: Number(row.interruption_count),
    startedAt: String(row.started_at),
    endedAt: typeof row.ended_at === 'string' ? row.ended_at : undefined,
    completed: Boolean(row.completed),
  };
}

export async function fetchFocusOverview(): Promise<{
  preference: FocusPreference | null;
  activeSession: FocusSession | null;
  recentSessions: FocusSession[];
}> {
  const { supabase, user } = await requireUser();
  const [preferenceResult, activeResult, recentResult] = await Promise.all([
    supabase
      .from('focus_preferences')
      .select('consented_at, consent_version')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .maybeSingle(),
    supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', user.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(20),
  ]);
  const error =
    preferenceResult.error ?? activeResult.error ?? recentResult.error;
  if (error) {
    throw new Error(error.message);
  }
  return {
    preference: preferenceResult.data
      ? {
          consentedAt: preferenceResult.data.consented_at,
          consentVersion: preferenceResult.data.consent_version,
        }
      : null,
    activeSession: activeResult.data
      ? mapSession(activeResult.data as Record<string, unknown>)
      : null,
    recentSessions: (recentResult.data ?? []).map((row) =>
      mapSession(row as Record<string, unknown>),
    ),
  };
}

export async function acceptFocusConsent(): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('focus_preferences').upsert({
    user_id: user.id,
    consented_at: new Date().toISOString(),
    consent_version: CONSENT_VERSION,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function startFocusSession(
  plannedMinutes: number,
): Promise<FocusSession> {
  const { supabase, user } = await requireUser();
  const plannedSeconds = plannedMinutes * 60;
  const { data, error } = await supabase
    .from('focus_sessions')
    .insert({
      user_id: user.id,
      planned_seconds: plannedSeconds,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not start Focus Mode.');
  }
  return mapSession(data as Record<string, unknown>);
}

export async function updateFocusProgress(
  sessionId: string,
  focusedSeconds: number,
  interruptionCount: number,
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from('focus_sessions')
    .update({
      focused_seconds: focusedSeconds,
      interruption_count: interruptionCount,
    })
    .eq('id', sessionId)
    .is('ended_at', null);
  if (error) {
    throw new Error(error.message);
  }
}

export async function finishFocusSession(
  session: FocusSession,
  focusedSeconds: number,
  interruptionCount: number,
  completed: boolean,
): Promise<void> {
  const { supabase } = await requireUser();
  const endedAt = new Date();
  const { error } = await supabase
    .from('focus_sessions')
    .update({
      ended_at: endedAt.toISOString(),
      focused_seconds: Math.min(session.plannedSeconds, focusedSeconds),
      interruption_count: interruptionCount,
      completed,
    })
    .eq('id', session.id)
    .is('ended_at', null);
  if (error) {
    throw new Error(error.message);
  }
}
