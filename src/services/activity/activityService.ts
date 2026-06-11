import { getSupabaseClient } from '@/services/supabase/client';
import type { ActivityEvent, ActivityEventKind } from '@/types';

async function requireUser() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('Your session has expired. Sign in again.');
  }
  return { supabase, user: data.user };
}

export async function fetchActivityEvents(limit = 50): Promise<ActivityEvent[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('activity_events')
    .select('id, actor_id, kind, title, body, url, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const actorIds = [
    ...new Set(
      rows
        .map((row) => row.actor_id)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ];
  const actors = new Map<string, { name: string; avatarUrl?: string }>();
  if (actorIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', actorIds);
    if (profileError) throw new Error(profileError.message);
    for (const profile of profiles ?? []) {
      actors.set(profile.id, {
        name: profile.display_name?.trim() || 'Community member',
        avatarUrl: profile.avatar_url ?? undefined,
      });
    }
  }

  return rows.map((row) => {
    const actor = row.actor_id ? actors.get(row.actor_id) : undefined;
    return {
      id: row.id,
      kind: row.kind as ActivityEventKind,
      title: row.title,
      body: row.body ?? undefined,
      url: row.url ?? undefined,
      actorName: actor?.name,
      actorAvatarUrl: actor?.avatarUrl,
      read: Boolean(row.read_at),
      createdAt: row.created_at,
    };
  });
}

export async function fetchUnreadActivityCount(): Promise<number> {
  const { supabase, user } = await requireUser();
  const { count, error } = await supabase
    .from('activity_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markActivityRead(id?: string): Promise<void> {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from('activity_events')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
  if (id) query = query.eq('id', id);
  const { error } = await query;
  if (error) throw new Error(error.message);
}
