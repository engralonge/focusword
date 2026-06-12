import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import type { BlockedUser } from '@/types';
import {
  fetchBlockedUsers,
  unblockUser,
} from '@/services/safety/safetyService';
import { palette } from '@/constants/colors';

export function BlockedUsersScreen() {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchBlockedUsers());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load blocked accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = (user: BlockedUser) => {
    Alert.alert(`Unblock ${user.displayName}?`, 'You may see each other’s content again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: () => {
          void unblockUser(user.userId)
            .then(load)
            .catch((nextError: unknown) => {
              setError(nextError instanceof Error ? nextError.message : 'Could not unblock account.');
            });
        },
      },
    ]);
  };

  return (
    <ScreenContainer contentClassName="px-5">
      <Card className="mt-3 mb-5 border-brand/20 bg-brand/[0.05]">
        <View className="flex-row items-center gap-3">
          <Ionicons name="shield-checkmark-outline" size={24} color={palette.brandLight} />
          <View className="flex-1">
            <Text variant="subtitle">Blocked accounts</Text>
            <Text variant="caption" className="mt-1">
              Their community, prayer, and live content stays hidden.
            </Text>
          </View>
        </View>
      </Card>
      {error ? (
        <Pressable onPress={() => void load()}>
          <Text className="mb-4 text-center text-red-500">{error} Tap to retry.</Text>
        </Pressable>
      ) : null}
      {loading ? <Text variant="caption">Loading blocked accounts...</Text> : null}
      {!loading && users.length === 0 ? (
        <EmptyState title="No blocked accounts" message="Accounts you block will appear here." />
      ) : null}
      {users.map((user) => (
        <View
          key={user.userId}
          className="flex-row items-center gap-3 border-b border-border-subtle py-4"
        >
          <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} size="sm" />
          <View className="flex-1">
            <Text className="font-semibold">{user.displayName}</Text>
            <Text variant="caption" className="mt-1">
              Blocked {new Date(user.blockedAt).toLocaleDateString()}
            </Text>
          </View>
          <Pressable
            className="min-h-10 rounded-lg border border-brand/30 px-4 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={`Unblock ${user.displayName}`}
            onPress={() => unblock(user)}
          >
            <Text className="text-brand-light text-sm font-semibold">Unblock</Text>
          </Pressable>
        </View>
      ))}
    </ScreenContainer>
  );
}
