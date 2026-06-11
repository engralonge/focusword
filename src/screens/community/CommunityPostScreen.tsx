import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/common/EmptyState';
import type { CommunityComment } from '@/types';
import type { CommunityStackParamList } from '@/navigation/types';
import {
  createCommunityComment,
  deleteCommunityComment,
  fetchCommunityComments,
} from '@/services/community/communityService';
import { palette } from '@/constants/colors';
import { Avatar } from '@/components/common/Avatar';

type Route = RouteProp<CommunityStackParamList, 'CommunityPost'>;

export function CommunityPostScreen() {
  const { params } = useRoute<Route>();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setComments(await fetchCommunityComments(params.post.id));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load comments.');
    } finally {
      setLoading(false);
    }
  }, [params.post.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const addComment = async () => {
    setSaving(true);
    setError(null);
    try {
      await createCommunityComment(params.post.id, draft);
      setDraft('');
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not add comment.');
    } finally {
      setSaving(false);
    }
  };

  const removeComment = (comment: CommunityComment) => {
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteCommunityComment(comment.id).then(load);
        },
      },
    ]);
  };

  return (
    <ScreenContainer contentClassName="px-4">
      <Card className="mt-3 mb-5">
        <View className="flex-row items-center gap-3">
          <Avatar
            displayName={params.post.authorName}
            avatarUrl={params.post.authorAvatarUrl}
            size="sm"
          />
          <Text variant="subtitle">{params.post.authorName}</Text>
        </View>
        <Text className="mt-2">{params.post.body}</Text>
      </Card>
      <Text variant="label" className="mb-2">Comments</Text>
      {error ? <Text className="text-red-500 mb-3">{error}</Text> : null}
      {loading ? <Text variant="caption">Loading comments...</Text> : null}
      {!loading && comments.length === 0 ? (
        <EmptyState title="No comments yet" message="Add the first response." />
      ) : null}
      {comments.map((comment) => (
        <View key={comment.id} className="py-3 border-b border-black/5 dark:border-white/10">
          <View className="flex-row justify-between">
            <View className="flex-row items-center gap-3">
              <Avatar
                displayName={comment.authorName}
                avatarUrl={comment.authorAvatarUrl}
                size="sm"
              />
              <Text className="font-semibold">{comment.authorName}</Text>
            </View>
            {comment.isOwner ? (
              <Pressable
                className="w-9 h-9 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Delete comment"
                onPress={() => removeComment(comment)}
              >
                <Ionicons name="trash-outline" size={18} color={palette.danger} />
              </Pressable>
            ) : null}
          </View>
          <Text className="mt-1">{comment.body}</Text>
        </View>
      ))}
      <View className="mt-5 flex-row items-end gap-2">
        <TextInput
          className="flex-1 min-h-12 max-h-32 bg-surface-light dark:bg-surface rounded-xl px-4 py-3 text-foreground-light dark:text-foreground border border-black/10 dark:border-white/10"
          placeholder="Write a comment..."
          value={draft}
          onChangeText={setDraft}
          maxLength={2000}
          multiline
        />
        <Pressable
          className="w-12 h-12 rounded-xl bg-brand items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          disabled={saving || !draft.trim()}
          onPress={() => void addComment()}
        >
          <Ionicons name="send" size={20} color={palette.backgroundDark} />
        </Pressable>
      </View>
      <View className="h-8" />
    </ScreenContainer>
  );
}
