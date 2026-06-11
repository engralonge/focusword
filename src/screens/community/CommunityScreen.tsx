import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/common/EmptyState';
import { ComposerModal } from '@/components/common/ComposerModal';
import type { CommunityPost } from '@/types';
import type { CommunityStackParamList } from '@/navigation/types';
import {
  createCommunityPost,
  deleteCommunityPost,
  fetchCommunityPosts,
  togglePostReaction,
  updateCommunityPost,
} from '@/services/community/communityService';
import { palette } from '@/constants/colors';
import { fetchUnreadActivityCount } from '@/services/activity/activityService';
import { Avatar } from '@/components/common/Avatar';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'CommunityMain'>;

export function CommunityScreen() {
  const navigation = useNavigation<Nav>();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [unreadActivity, setUnreadActivity] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextPosts, nextUnread] = await Promise.all([
        fetchCommunityPosts(),
        fetchUnreadActivityCount(),
      ]);
      setPosts(nextPosts);
      setUnreadActivity(nextUnread);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load the community.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingPost(null);
    setDraft('');
    setComposerOpen(true);
  };

  const openEdit = (post: CommunityPost) => {
    setEditingPost(post);
    setDraft(post.body);
    setComposerOpen(true);
  };

  const savePost = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingPost) {
        await updateCommunityPost(editingPost.id, draft);
      } else {
        await createCommunityPost(draft);
      }
      setComposerOpen(false);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save the post.');
    } finally {
      setSaving(false);
    }
  };

  const removePost = (post: CommunityPost) => {
    Alert.alert('Delete post?', 'This also removes its comments and reactions.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteCommunityPost(post.id)
            .then(load)
            .catch((nextError: unknown) => {
              setError(nextError instanceof Error ? nextError.message : 'Could not delete the post.');
            });
        },
      },
    ]);
  };

  const react = async (post: CommunityPost) => {
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              reactedByMe: !item.reactedByMe,
              reactionCount: item.reactionCount + (item.reactedByMe ? -1 : 1),
            }
          : item,
      ),
    );
    try {
      await togglePostReaction(post.id, post.reactedByMe);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update reaction.');
      await load();
    }
  };

  return (
    <>
      <ScreenContainer contentClassName="px-5">
        <Header title="Activity center" subtitle="Stay connected to community life" />
        <Pressable
          className="mb-5 flex-row items-center rounded-2xl border border-brand/25 bg-brand/[0.06] px-4 py-4"
          accessibilityRole="button"
          onPress={() => navigation.navigate('ActivityInbox')}
        >
          <View className="w-11 h-11 rounded-xl bg-brand/12 items-center justify-center">
            <Ionicons name="notifications-outline" size={22} color={palette.brandLight} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-semibold">Your activity</Text>
            <Text variant="caption" className="mt-1">
              Replies, invitations, prayer, and points
            </Text>
          </View>
          {unreadActivity ? (
            <View className="min-w-7 h-7 rounded-full bg-live px-2 items-center justify-center">
              <Text className="text-xs font-semibold text-white">{unreadActivity}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={palette.muted} />
          )}
        </Pressable>
        <Card className="mb-6 rounded-3xl border-brand/20 bg-brand/[0.05] p-5">
          <View className="flex-row items-center gap-3">
            <View className="w-11 h-11 rounded-xl bg-brand/12 items-center justify-center">
              <Ionicons name="people-outline" size={22} color={palette.brandLight} />
            </View>
            <View className="flex-1">
              <Text variant="subtitle">Family of faith</Text>
              <Text variant="caption" className="mt-1 leading-5">
                Recent encouragement from the community.
              </Text>
            </View>
          </View>
        </Card>
        {error ? (
          <Pressable className="mb-3" onPress={() => void load()}>
            <Text className="text-red-500 text-center">{error} Tap to retry.</Text>
          </Pressable>
        ) : null}
        {loading ? <Text variant="caption">Loading discussions...</Text> : null}
        {!loading && posts.length === 0 ? (
          <EmptyState title="Start the conversation" message="Share a reflection or study question." />
        ) : null}
        {posts.map((post) => (
          <Card key={post.id} className="mb-3 border-brand/15 bg-surface-elevated/80 p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Avatar
                  displayName={post.authorName}
                  avatarUrl={post.authorAvatarUrl}
                  size="sm"
                />
                <Text variant="subtitle">{post.authorName}</Text>
              </View>
              {post.isOwner ? (
                <View className="flex-row">
                  <Pressable
                    className="w-10 h-10 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel="Edit post"
                    onPress={() => openEdit(post)}
                  >
                    <Ionicons name="create-outline" size={20} color={palette.muted} />
                  </Pressable>
                  <Pressable
                    className="w-10 h-10 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel="Delete post"
                    onPress={() => removePost(post)}
                  >
                    <Ionicons name="trash-outline" size={20} color={palette.danger} />
                  </Pressable>
                </View>
              ) : null}
            </View>
            <Text variant="body" className="mt-3 leading-7">{post.body}</Text>
            <View className="mt-4 pt-3 border-t border-border-subtle flex-row gap-5">
              <Pressable
                className="flex-row items-center gap-1"
                accessibilityRole="button"
                accessibilityLabel={post.reactedByMe ? 'Remove like' : 'Like post'}
                onPress={() => void react(post)}
              >
                <Ionicons
                  name={post.reactedByMe ? 'heart' : 'heart-outline'}
                  size={20}
                  color={post.reactedByMe ? palette.danger : palette.muted}
                />
                <Text variant="caption">{post.reactionCount}</Text>
              </Pressable>
              <Pressable
                className="flex-row items-center gap-1"
                accessibilityRole="button"
                accessibilityLabel="Open comments"
                onPress={() => navigation.navigate('CommunityPost', { post })}
              >
                <Ionicons name="chatbubble-outline" size={19} color={palette.muted} />
                <Text variant="caption">{post.commentCount}</Text>
              </Pressable>
            </View>
          </Card>
        ))}
        <View className="h-20" />
      </ScreenContainer>
      <Pressable
        className="absolute bottom-8 right-5 w-14 h-14 rounded-2xl bg-brand items-center justify-center shadow-lg border border-brand-light/30"
        accessibilityRole="button"
        accessibilityLabel="Create community post"
        onPress={openCreate}
      >
        <Ionicons name="add" size={28} color={palette.backgroundDark} />
      </Pressable>
      <ComposerModal
        visible={composerOpen}
        title={editingPost ? 'Edit post' : 'New post'}
        value={draft}
        placeholder="Share a reflection or ask a study question..."
        submitTitle={editingPost ? 'Save changes' : 'Publish post'}
        maxLength={5000}
        loading={saving}
        error={composerOpen ? error : null}
        onChangeText={setDraft}
        onClose={() => setComposerOpen(false)}
        onSubmit={() => void savePost()}
      />
    </>
  );
}
