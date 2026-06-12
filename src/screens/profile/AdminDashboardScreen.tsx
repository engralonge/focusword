import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { palette } from '@/constants/colors';
import { useTheme } from '@/context/ThemeProvider';
import { useAuth } from '@/context/AuthProvider';
import {
  fetchAdminDashboard,
  forceEndLiveStream,
  retryNotificationDelivery,
  reviewAppError,
  searchAdminUsers,
  setAdminUserRole,
} from '@/services/admin/adminService';
import type {
  AdminDashboard,
  AdminErrorEvent,
  AdminLiveStream,
  AdminNotificationDelivery,
  AdminUser,
} from '@/types';

type ViewMode = 'overview' | 'people' | 'operations';

const initialDashboard: AdminDashboard = {
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

const metricItems: Array<{
  key: keyof AdminDashboard['metrics'];
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'members', label: 'Members', icon: 'people-outline' },
  { key: 'newMembers7d', label: 'New this week', icon: 'person-add-outline' },
  { key: 'liveNow', label: 'Live now', icon: 'radio-outline' },
  { key: 'scheduledStudies', label: 'Scheduled', icon: 'calendar-outline' },
  { key: 'openReports', label: 'Open reports', icon: 'flag-outline' },
  { key: 'activeSanctions', label: 'Sanctions', icon: 'ban-outline' },
  { key: 'openErrors', label: 'Open errors', icon: 'bug-outline' },
  { key: 'failedPushes', label: 'Failed pushes', icon: 'notifications-off-outline' },
  { key: 'enabledDevices', label: 'Push devices', icon: 'phone-portrait-outline' },
  { key: 'posts7d', label: 'Posts this week', icon: 'chatbubbles-outline' },
  { key: 'prayers7d', label: 'Prayers this week', icon: 'heart-outline' },
];

function formatAction(action: string) {
  return action.replaceAll('_', ' ');
}

function StatusTag({ label, danger = false }: { label: string; danger?: boolean }) {
  return (
    <View
      className={
        danger ? 'rounded-md bg-red-500/10 px-2 py-1' : 'rounded-md bg-brand/10 px-2 py-1'
      }
    >
      <Text
        className={
          danger ? 'text-xs capitalize text-red-400' : 'text-xs capitalize text-brand-light'
        }
      >
        {label}
      </Text>
    </View>
  );
}

export function AdminDashboardScreen() {
  const { isDark } = useTheme();
  const { session } = useAuth();
  const [mode, setMode] = useState<ViewMode>('overview');
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setDashboard(await fetchAdminDashboard());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load administration.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadUsers = useCallback(async (search: string) => {
    setError(null);
    try {
      setUsers(await searchAdminUsers(search));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load accounts.');
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadDashboard(), loadUsers('')]);
  }, [loadDashboard, loadUsers]);

  const perform = async (id: string, operation: () => Promise<void>) => {
    setWorkingId(id);
    setError(null);
    try {
      await operation();
      await Promise.all([loadDashboard(true), loadUsers(query)]);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'The operation could not be completed.',
      );
    } finally {
      setWorkingId(null);
    }
  };

  const changeRole = (user: AdminUser) => {
    const roles: AdminUser['role'][] = ['member', 'moderator', 'admin'];
    Alert.alert(`Change ${user.displayName}'s role`, `Current role: ${user.role}`, [
      { text: 'Cancel', style: 'cancel' },
      ...roles
        .filter((role) => role !== user.role)
        .map((role) => ({
          text: `Make ${role}`,
          style: role === 'member' ? 'destructive' as const : 'default' as const,
          onPress: () => void perform(user.id, () => setAdminUserRole(user.id, role)),
        })),
    ]);
  };

  const endStream = (stream: AdminLiveStream) => {
    Alert.alert(
      `End "${stream.title}"?`,
      'The room will be marked ended and active stage requests will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End study',
          style: 'destructive',
          onPress: () => void perform(stream.id, () => forceEndLiveStream(stream)),
        },
      ],
    );
  };

  const reviewError = (
    event: AdminErrorEvent,
    status: 'acknowledged' | 'resolved',
  ) => {
    void perform(event.id, () => reviewAppError(event, status));
  };

  if (session?.user.role !== 'admin') {
    return (
      <ScreenContainer contentClassName="px-5">
        <EmptyState
          title="Administrator access required"
          message="This console is only available to platform administrators."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      contentClassName="px-4"
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            tintColor={palette.brand}
            onRefresh={() => void loadDashboard(true)}
          />
        ),
      }}
    >
      <View className="mt-3 flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand/12">
          <Ionicons name="speedometer-outline" size={23} color={palette.brand} />
        </View>
        <View className="flex-1">
          <Text variant="subtitle">Platform administration</Text>
          <Text variant="caption" className="mt-1">Health, people, and operational controls</Text>
        </View>
      </View>

      <View className="mt-5 flex-row rounded-lg border border-border bg-surface-elevated p-1">
        {([
          ['overview', 'Overview'],
          ['people', 'People'],
          ['operations', 'Operations'],
        ] as const).map(([value, label]) => (
          <Pressable
            key={value}
            className={`min-h-10 flex-1 items-center justify-center rounded-md px-2 ${
              mode === value ? 'bg-brand' : ''
            }`}
            onPress={() => setMode(value)}
          >
            <Text
              className={
                mode === value ? 'text-sm font-semibold text-ink' : 'text-sm text-muted'
              }
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Pressable className="py-4" onPress={() => void loadDashboard()}>
          <Text className="text-center text-red-400">{error} Tap to retry.</Text>
        </Pressable>
      ) : null}
      {loading ? <Text variant="caption" className="mt-5">Loading platform health...</Text> : null}

      {!loading && mode === 'overview' ? (
        <>
          <View className="mt-5 flex-row flex-wrap justify-between">
            {metricItems.map((metric) => (
              <View
                key={metric.key}
                className="mb-3 w-[48.5%] rounded-lg border border-border bg-surface-elevated p-4"
              >
                <View className="flex-row items-center justify-between">
                  <Ionicons name={metric.icon} size={18} color={palette.brand} />
                  <Text className="text-xl font-semibold">{dashboard.metrics[metric.key]}</Text>
                </View>
                <Text variant="caption" className="mt-3">{metric.label}</Text>
              </View>
            ))}
          </View>

          <Text variant="label" className="mb-2 mt-4">Active and scheduled studies</Text>
          {!dashboard.liveStreams.length ? (
            <Text variant="caption">No active or scheduled live studies.</Text>
          ) : null}
          {dashboard.liveStreams.map((stream) => (
            <View key={stream.id} className="border-b border-border-subtle py-4">
              <View className="flex-row items-start gap-3">
                <View className="flex-1">
                  <Text className="font-semibold">{stream.title}</Text>
                  <Text variant="caption" className="mt-1">
                    {stream.hostName} · {stream.viewerCount} connected
                  </Text>
                </View>
                <StatusTag label={stream.status} danger={stream.status === 'live'} />
              </View>
              <Button
                title={workingId === stream.id ? 'Ending...' : 'End study'}
                variant="danger"
                className="mt-3 min-h-10 self-start rounded-lg px-4 py-2"
                disabled={workingId === stream.id}
                onPress={() => endStream(stream)}
              />
            </View>
          ))}
        </>
      ) : null}

      {!loading && mode === 'people' ? (
        <>
          <View className="mt-5 flex-row gap-2">
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void loadUsers(query)}
              placeholder="Search name or email"
              placeholderTextColor={palette.muted}
              autoCapitalize="none"
              returnKeyType="search"
              className={`min-h-12 flex-1 rounded-lg border border-border px-4 ${
                isDark ? 'bg-surface-elevated text-white' : 'bg-white text-black'
              }`}
            />
            <Pressable
              className="h-12 w-12 items-center justify-center rounded-lg bg-brand"
              accessibilityLabel="Search accounts"
              onPress={() => void loadUsers(query)}
            >
              <Ionicons name="search" size={20} color={palette.backgroundDark} />
            </Pressable>
          </View>
          <Text variant="caption" className="mt-3">{users.length} accounts shown</Text>
          {users.map((user) => (
            <View key={user.id} className="border-b border-border-subtle py-4">
              <View className="flex-row items-start gap-3">
                <View className="flex-1">
                  <Text className="font-semibold">{user.displayName}</Text>
                  <Text variant="caption" className="mt-1">{user.email}</Text>
                  <Text variant="caption" className="mt-1">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View className="items-end gap-2">
                  <StatusTag label={user.role} />
                  {user.accountStatus !== 'active' ? (
                    <StatusTag label={user.accountStatus} danger />
                  ) : null}
                </View>
              </View>
              <Button
                title={workingId === user.id ? 'Updating...' : 'Change role'}
                variant="secondary"
                className="mt-3 min-h-10 self-start rounded-lg px-4 py-2"
                disabled={workingId === user.id}
                onPress={() => changeRole(user)}
              />
            </View>
          ))}
        </>
      ) : null}

      {!loading && mode === 'operations' ? (
        <>
          <Text variant="label" className="mb-2 mt-6">Application errors</Text>
          {!dashboard.errors.length ? (
            <Text variant="caption">No captured application errors.</Text>
          ) : null}
          {dashboard.errors.map((event) => (
            <View key={event.id} className="border-b border-border-subtle py-4">
              <View className="flex-row items-start gap-3">
                <View className="flex-1">
                  <Text className="font-semibold" numberOfLines={3}>{event.message}</Text>
                  <Text variant="caption" className="mt-2">
                    {event.userName} · {event.platform} · {event.environment}
                  </Text>
                  <Text variant="caption" className="mt-1">
                    {new Date(event.createdAt).toLocaleString()}
                  </Text>
                </View>
                <StatusTag label={event.status} danger={event.status === 'open'} />
              </View>
              {event.status !== 'resolved' ? (
                <View className="mt-3 flex-row gap-2">
                  {event.status === 'open' ? (
                    <Button
                      title="Acknowledge"
                      variant="secondary"
                      className="min-h-10 rounded-lg px-3 py-2"
                      disabled={workingId === event.id}
                      onPress={() => reviewError(event, 'acknowledged')}
                    />
                  ) : null}
                  <Button
                    title="Resolve"
                    variant="ghost"
                    className="min-h-10 rounded-lg px-3 py-2"
                    disabled={workingId === event.id}
                    onPress={() => reviewError(event, 'resolved')}
                  />
                </View>
              ) : null}
            </View>
          ))}

          <Text variant="label" className="mb-2 mt-7">Push delivery failures</Text>
          {!dashboard.deliveries.length ? (
            <Text variant="caption">No push deliveries need attention.</Text>
          ) : null}
          {dashboard.deliveries.map((delivery) => (
            <View key={delivery.id} className="border-b border-border-subtle py-4">
              <View className="flex-row items-start gap-3">
                <View className="flex-1">
                  <Text className="font-semibold">{delivery.title}</Text>
                  <Text variant="caption" className="mt-1">
                    {delivery.userName} · attempt {delivery.attemptCount}
                  </Text>
                  {delivery.lastError ? (
                    <Text className="mt-2 text-sm text-red-400" numberOfLines={4}>
                      {delivery.lastError}
                    </Text>
                  ) : null}
                </View>
                <StatusTag label={delivery.status} danger />
              </View>
              <Button
                title={workingId === delivery.id ? 'Queuing...' : 'Retry delivery'}
                variant="secondary"
                className="mt-3 min-h-10 self-start rounded-lg px-4 py-2"
                disabled={workingId === delivery.id}
                onPress={() =>
                  void perform(delivery.id, () => retryNotificationDelivery(delivery))
                }
              />
            </View>
          ))}

          <Text variant="label" className="mb-2 mt-7">Administrative audit</Text>
          {!dashboard.audit.length ? (
            <Text variant="caption">No administrative actions recorded yet.</Text>
          ) : null}
          {dashboard.audit.map((event) => (
            <View key={event.id} className="border-b border-border-subtle py-3">
              <Text className="font-medium capitalize">{formatAction(event.action)}</Text>
              <Text variant="caption" className="mt-1">
                {event.adminName} · {event.targetType.replaceAll('_', ' ')}
              </Text>
              <Text variant="caption" className="mt-1">
                {new Date(event.createdAt).toLocaleString()}
              </Text>
            </View>
          ))}
        </>
      ) : null}
      <View className="h-8" />
    </ScreenContainer>
  );
}
