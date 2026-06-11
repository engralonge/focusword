import type {
  CommunityComment,
  CommunityPost,
  PrayerRequest,
  PrayerUpdate,
} from '@/types';
import { getSupabaseClient } from '@/services/supabase/client';

type ProfileSummaryMap = Map<string, { name: string; avatarUrl?: string }>;

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

async function getProfileNames(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  userIds: string[],
): Promise<ProfileSummaryMap> {
  if (userIds.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', [...new Set(userIds)]);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      {
        name: profile.display_name?.trim() || 'Community member',
        avatarUrl: profile.avatar_url ?? undefined,
      },
    ]),
  );
}

export async function fetchCommunityPosts(): Promise<CommunityPost[]> {
  const { supabase, user } = await requireUser();
  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('id, user_id, body, created_at, updated_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  if (!posts?.length) {
    return [];
  }

  const postIds = posts.map((post) => post.id);
  const [profiles, reactionsResult, commentsResult] = await Promise.all([
    getProfileNames(supabase, posts.map((post) => post.user_id)),
    supabase
      .from('community_reactions')
      .select('post_id, user_id')
      .in('post_id', postIds)
      .eq('kind', 'like'),
    supabase
      .from('community_comments')
      .select('post_id')
      .in('post_id', postIds)
      .eq('status', 'published'),
  ]);
  if (reactionsResult.error) {
    throw new Error(reactionsResult.error.message);
  }
  if (commentsResult.error) {
    throw new Error(commentsResult.error.message);
  }

  return posts.map((post) => {
    const reactions = reactionsResult.data?.filter((item) => item.post_id === post.id) ?? [];
    return {
      id: post.id,
      userId: post.user_id,
      authorName: profiles.get(post.user_id)?.name ?? 'Community member',
      authorAvatarUrl: profiles.get(post.user_id)?.avatarUrl,
      body: post.body,
      reactionCount: reactions.length,
      reactedByMe: reactions.some((item) => item.user_id === user.id),
      commentCount:
        commentsResult.data?.filter((item) => item.post_id === post.id).length ?? 0,
      isOwner: post.user_id === user.id,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
    };
  });
}

export async function createCommunityPost(body: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 5000) {
    throw new Error('Posts must be between 1 and 5,000 characters.');
  }
  const { error } = await supabase.from('community_posts').insert({
    user_id: user.id,
    body: trimmed,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function updateCommunityPost(id: string, body: string): Promise<void> {
  const { supabase } = await requireUser();
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 5000) {
    throw new Error('Posts must be between 1 and 5,000 characters.');
  }
  const { error } = await supabase
    .from('community_posts')
    .update({ body: trimmed })
    .eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteCommunityPost(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('community_posts').delete().eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function togglePostReaction(id: string, active: boolean): Promise<void> {
  const { supabase, user } = await requireUser();
  const query = active
    ? supabase.from('community_reactions').delete().eq('post_id', id).eq('user_id', user.id)
    : supabase.from('community_reactions').insert({
        post_id: id,
        user_id: user.id,
        kind: 'like',
      });
  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchCommunityComments(postId: string): Promise<CommunityComment[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from('community_comments')
    .select('id, post_id, user_id, body, created_at, updated_at')
    .eq('post_id', postId)
    .eq('status', 'published')
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  const comments = data ?? [];
  const profiles = await getProfileNames(supabase, comments.map((comment) => comment.user_id));
  return comments.map((comment) => ({
    id: comment.id,
    postId: comment.post_id,
    userId: comment.user_id,
    authorName: profiles.get(comment.user_id)?.name ?? 'Community member',
    authorAvatarUrl: profiles.get(comment.user_id)?.avatarUrl,
    body: comment.body,
    isOwner: comment.user_id === user.id,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  }));
}

export async function createCommunityComment(postId: string, body: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 2000) {
    throw new Error('Comments must be between 1 and 2,000 characters.');
  }
  const { error } = await supabase.from('community_comments').insert({
    post_id: postId,
    user_id: user.id,
    body: trimmed,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteCommunityComment(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('community_comments').delete().eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchPrayerRequests(): Promise<PrayerRequest[]> {
  const { supabase, user } = await requireUser();
  const { data: prayers, error } = await supabase
    .from('prayer_requests')
    .select('id, user_id, content, is_anonymous, status, created_at, updated_at')
    .in('status', ['published', 'answered'])
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  if (!prayers?.length) {
    return [];
  }

  const [profiles, supportResult, updatesResult] = await Promise.all([
    getProfileNames(supabase, prayers.map((prayer) => prayer.user_id)),
    supabase
      .from('prayer_support')
      .select('prayer_id, user_id')
      .in('prayer_id', prayers.map((prayer) => prayer.id)),
    supabase
      .from('prayer_updates')
      .select('id, prayer_id, user_id, kind, body, created_at')
      .in('prayer_id', prayers.map((prayer) => prayer.id))
      .eq('status', 'published')
      .order('created_at', { ascending: true }),
  ]);
  if (supportResult.error) {
    throw new Error(supportResult.error.message);
  }
  if (updatesResult.error) {
    throw new Error(updatesResult.error.message);
  }

  return prayers.map((prayer) => {
    const support = supportResult.data?.filter((item) => item.prayer_id === prayer.id) ?? [];
    return {
      id: prayer.id,
      userId: prayer.user_id,
      authorName: prayer.is_anonymous
        ? 'Anonymous'
        : profiles.get(prayer.user_id)?.name ?? 'Community member',
      authorAvatarUrl: prayer.is_anonymous
        ? undefined
        : profiles.get(prayer.user_id)?.avatarUrl,
      content: prayer.content,
      isAnonymous: prayer.is_anonymous,
      status: prayer.status as PrayerRequest['status'],
      supportCount: support.length,
      supportedByMe: support.some((item) => item.user_id === user.id),
      isOwner: prayer.user_id === user.id,
      updates: (updatesResult.data ?? [])
        .filter((item) => item.prayer_id === prayer.id)
        .map((item) => ({
          id: item.id,
          prayerId: item.prayer_id,
          kind: item.kind as PrayerUpdate['kind'],
          body: item.body,
          isOwner: item.user_id === user.id,
          createdAt: item.created_at,
        })),
      createdAt: prayer.created_at,
      updatedAt: prayer.updated_at,
    };
  });
}

export async function createPrayerUpdate(
  prayerId: string,
  kind: PrayerUpdate['kind'],
  body: string,
): Promise<void> {
  const { supabase } = await requireUser();
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 3000) {
    throw new Error('Prayer updates must be between 1 and 3,000 characters.');
  }
  const { error } = await supabase.rpc('publish_prayer_update', {
    requested_prayer_id: prayerId,
    requested_kind: kind,
    requested_body: trimmed,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePrayerUpdate(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('prayer_updates').delete().eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function createPrayerRequest(
  content: string,
  isAnonymous: boolean,
): Promise<void> {
  const { supabase, user } = await requireUser();
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 3000) {
    throw new Error('Prayer requests must be between 1 and 3,000 characters.');
  }
  const { error } = await supabase.from('prayer_requests').insert({
    user_id: user.id,
    content: trimmed,
    is_anonymous: isAnonymous,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePrayerStatus(
  id: string,
  status: PrayerRequest['status'],
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('prayer_requests').update({ status }).eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePrayerRequest(id: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('prayer_requests').delete().eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function togglePrayerSupport(id: string, active: boolean): Promise<void> {
  const { supabase, user } = await requireUser();
  const query = active
    ? supabase.from('prayer_support').delete().eq('prayer_id', id).eq('user_id', user.id)
    : supabase.from('prayer_support').insert({ prayer_id: id, user_id: user.id });
  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}
