import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/common/EmptyState';
import { ComposerModal } from '@/components/common/ComposerModal';
import type { PrayerRequest, PrayerUpdate } from '@/types';
import {
  createPrayerUpdate,
  createPrayerRequest,
  deletePrayerUpdate,
  deletePrayerRequest,
  fetchPrayerRequests,
  togglePrayerSupport,
  updatePrayerStatus,
} from '@/services/community/communityService';
import { palette } from '@/constants/colors';
import { Avatar } from '@/components/common/Avatar';
import { SafetyActions } from '@/components/safety/SafetyActions';

export function PrayerScreen() {
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timelinePrayer, setTimelinePrayer] = useState<PrayerRequest | null>(null);
  const [timelineKind, setTimelineKind] = useState<PrayerUpdate['kind']>('update');
  const [timelineDraft, setTimelineDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPrayers(await fetchPrayerRequests());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load prayer requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createPrayer = async () => {
    setSaving(true);
    setError(null);
    try {
      await createPrayerRequest(draft, anonymous);
      setDraft('');
      setAnonymous(false);
      setComposerOpen(false);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not publish the request.');
    } finally {
      setSaving(false);
    }
  };

  const support = async (prayer: PrayerRequest) => {
    setPrayers((current) =>
      current.map((item) =>
        item.id === prayer.id
          ? {
              ...item,
              supportedByMe: !item.supportedByMe,
              supportCount: item.supportCount + (item.supportedByMe ? -1 : 1),
            }
          : item,
      ),
    );
    try {
      await togglePrayerSupport(prayer.id, prayer.supportedByMe);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update prayer support.');
      await load();
    }
  };

  const markAnswered = async (prayer: PrayerRequest) => {
    try {
      await updatePrayerStatus(
        prayer.id,
        prayer.status === 'answered' ? 'published' : 'answered',
      );
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update the request.');
    }
  };

  const removePrayer = (prayer: PrayerRequest) => {
    Alert.alert('Delete prayer request?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deletePrayerRequest(prayer.id)
            .then(load)
            .catch((nextError: unknown) => {
              setError(
                nextError instanceof Error ? nextError.message : 'Could not delete the request.',
              );
            });
        },
      },
    ]);
  };

  const openTimelineComposer = (prayer: PrayerRequest) => {
    setTimelinePrayer(prayer);
    setTimelineKind(prayer.status === 'answered' ? 'testimony' : 'update');
    setTimelineDraft('');
  };

  const publishTimelineEntry = async () => {
    if (!timelinePrayer) return;
    setSaving(true);
    setError(null);
    try {
      await createPrayerUpdate(timelinePrayer.id, timelineKind, timelineDraft);
      setTimelinePrayer(null);
      setTimelineDraft('');
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not publish the update.');
    } finally {
      setSaving(false);
    }
  };

  const removeTimelineEntry = (entry: PrayerUpdate) => {
    Alert.alert('Delete this prayer update?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deletePrayerUpdate(entry.id)
            .then(load)
            .catch((nextError: unknown) => {
              setError(
                nextError instanceof Error ? nextError.message : 'Could not delete the update.',
              );
            });
        },
      },
    ]);
  };

  return (
    <>
      <ScreenContainer contentClassName="px-5">
        <Header title="Prayer" subtitle="Your community is ready to stand with you in faith" />
        <Card className="mb-6 rounded-3xl border-brand/20 bg-brand/[0.05] p-5">
          <Ionicons name="heart-outline" size={24} color={palette.brandLight} />
          <Text className="mt-4 text-scripture text-lg leading-7 font-light">
            Every breath can be a quiet prayer.
          </Text>
          <Text variant="caption" className="mt-2">
            Share a burden, celebrate an answer, or pray with someone today.
          </Text>
        </Card>
        {error ? (
          <Pressable className="mb-3" onPress={() => void load()}>
            <Text className="text-red-500 text-center">{error} Tap to retry.</Text>
          </Pressable>
        ) : null}
        {loading ? <Text variant="caption">Loading prayer requests...</Text> : null}
        {!loading && prayers.length === 0 ? (
          <EmptyState title="No prayer requests yet" message="Share a request with the community." />
        ) : null}
        {prayers.map((prayer) => (
          <Card key={prayer.id} className="mb-3 border-brand/15 bg-surface-elevated/80 p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Avatar
                  displayName={prayer.authorName}
                  avatarUrl={prayer.authorAvatarUrl}
                  size="sm"
                />
                <Text variant="subtitle">{prayer.authorName}</Text>
              </View>
              <View className="flex-row items-center">
                {prayer.status === 'answered' ? (
                  <View className="rounded-md bg-green-500/15 px-2 py-1">
                    <Text className="text-green-600 text-xs font-semibold">ANSWERED</Text>
                  </View>
                ) : null}
                {!prayer.isOwner ? (
                  <SafetyActions
                    targetType="prayer_request"
                    targetId={prayer.id}
                    targetUserId={prayer.isAnonymous ? undefined : prayer.userId}
                    targetLabel={prayer.authorName}
                    allowBlock={!prayer.isAnonymous}
                    onChanged={() => void load()}
                    onError={setError}
                  />
                ) : null}
              </View>
            </View>
            <Text variant="body" className="mt-3 leading-7">{prayer.content}</Text>
            {prayer.updates.length ? (
              <View className="mt-5 border-l border-brand/30 pl-4">
                <Text variant="label">Prayer journey</Text>
                {prayer.updates.map((entry) => (
                  <View key={entry.id} className="mt-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Ionicons
                          name={
                            entry.kind === 'testimony'
                              ? 'sparkles-outline'
                              : 'chatbubble-ellipses-outline'
                          }
                          size={17}
                          color={
                            entry.kind === 'testimony'
                              ? palette.success
                              : palette.brandMuted
                          }
                        />
                        <Text
                          className={
                            entry.kind === 'testimony'
                              ? 'text-green-500 text-xs font-semibold uppercase'
                              : 'text-brand-muted text-xs font-semibold uppercase'
                          }
                        >
                          {entry.kind === 'testimony' ? 'Testimony' : 'Update'}
                        </Text>
                      </View>
                      {entry.isOwner ? (
                        <Pressable
                          className="w-9 h-9 items-center justify-center"
                          accessibilityRole="button"
                          accessibilityLabel="Delete prayer update"
                          onPress={() => removeTimelineEntry(entry)}
                        >
                          <Ionicons name="trash-outline" size={17} color={palette.danger} />
                        </Pressable>
                      ) : (
                        <SafetyActions
                          targetType="prayer_update"
                          targetId={entry.id}
                          targetUserId={prayer.isAnonymous ? undefined : prayer.userId}
                          targetLabel={prayer.authorName}
                          allowBlock={!prayer.isAnonymous}
                          onChanged={() => void load()}
                          onError={setError}
                        />
                      )}
                    </View>
                    <Text className="mt-1 leading-6">{entry.body}</Text>
                    <Text variant="caption" className="mt-1">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View className="mt-4 pt-3 border-t border-border-subtle flex-row items-center justify-between">
              <Pressable
                className="flex-row items-center gap-2 py-2"
                accessibilityRole="button"
                accessibilityLabel={prayer.supportedByMe ? 'Remove prayer support' : 'I prayed'}
                onPress={() => void support(prayer)}
              >
                <Ionicons
                  name={prayer.supportedByMe ? 'heart' : 'heart-outline'}
                  size={20}
                  color={prayer.supportedByMe ? palette.brand : palette.muted}
                />
                <Text variant="caption">
                  {prayer.supportCount === 1 ? '1 person prayed' : `${prayer.supportCount} people prayed`}
                </Text>
              </Pressable>
              {prayer.isOwner ? (
                <View className="flex-row">
                  <Pressable
                    className="w-10 h-10 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel="Add prayer update or testimony"
                    onPress={() => openTimelineComposer(prayer)}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={palette.brand} />
                  </Pressable>
                  <Pressable
                    className="w-10 h-10 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel={
                      prayer.status === 'answered' ? 'Mark request active' : 'Mark prayer answered'
                    }
                    onPress={() => void markAnswered(prayer)}
                  >
                    <Ionicons
                      name={prayer.status === 'answered' ? 'refresh-outline' : 'checkmark-circle-outline'}
                      size={21}
                      color={palette.success}
                    />
                  </Pressable>
                  <Pressable
                    className="w-10 h-10 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel="Delete prayer request"
                    onPress={() => removePrayer(prayer)}
                  >
                    <Ionicons name="trash-outline" size={20} color={palette.danger} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </Card>
        ))}
        <View className="h-20" />
      </ScreenContainer>
      <Pressable
        className="absolute bottom-8 right-5 w-14 h-14 rounded-2xl bg-brand items-center justify-center shadow-lg border border-brand-light/30"
        accessibilityRole="button"
        accessibilityLabel="Create prayer request"
        onPress={() => setComposerOpen(true)}
      >
        <Ionicons name="add" size={26} color={palette.backgroundDark} />
      </Pressable>
      <ComposerModal
        visible={composerOpen}
        title="Prayer request"
        value={draft}
        placeholder="How can the community pray with you?"
        submitTitle="Share request"
        maxLength={3000}
        loading={saving}
        error={composerOpen ? error : null}
        onChangeText={setDraft}
        onClose={() => setComposerOpen(false)}
        onSubmit={() => void createPrayer()}
      >
        <View className="mt-4 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="font-semibold">Post anonymously</Text>
            <Text variant="caption" className="mt-1">
              Your identity stays hidden from other members.
            </Text>
          </View>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            trackColor={{ false: palette.muted, true: palette.brand }}
          />
        </View>
      </ComposerModal>
      <ComposerModal
        visible={Boolean(timelinePrayer)}
        title={timelineKind === 'testimony' ? 'Share testimony' : 'Prayer update'}
        value={timelineDraft}
        placeholder={
          timelineKind === 'testimony'
            ? 'Share how this prayer was answered...'
            : 'What has changed since this request was shared?'
        }
        submitTitle={
          timelineKind === 'testimony' ? 'Publish testimony' : 'Publish update'
        }
        maxLength={3000}
        loading={saving}
        error={timelinePrayer ? error : null}
        onChangeText={setTimelineDraft}
        onClose={() => setTimelinePrayer(null)}
        onSubmit={() => void publishTimelineEntry()}
      >
        <View className="mt-4 flex-row rounded-xl border border-border bg-surface-elevated p-1">
          {(['update', 'testimony'] as const).map((kind) => (
            <Pressable
              key={kind}
              className={`flex-1 rounded-lg py-3 items-center ${
                timelineKind === kind ? 'bg-brand/20 border border-brand/35' : ''
              }`}
              onPress={() => setTimelineKind(kind)}
            >
              <Text
                className={
                  timelineKind === kind
                    ? 'text-brand-light font-semibold'
                    : 'text-muted font-medium'
                }
              >
                {kind === 'update' ? 'Progress update' : 'Testimony'}
              </Text>
            </Pressable>
          ))}
        </View>
        {timelineKind === 'testimony' ? (
          <Text variant="caption" className="mt-3">
            Publishing a testimony will mark this prayer as answered.
          </Text>
        ) : null}
      </ComposerModal>
    </>
  );
}
