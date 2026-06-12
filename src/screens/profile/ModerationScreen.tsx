import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ComposerModal } from '@/components/common/ComposerModal';
import type {
  ModerationAuditEvent,
  ModerationReport,
  UserSanction,
} from '@/types';
import {
  applyUserSanction,
  fetchModerationAudit,
  fetchModerationReports,
  fetchActiveSanctions,
  moderateReport,
  revokeUserSanction,
} from '@/services/safety/safetyService';
import { palette } from '@/constants/colors';

type SanctionDraft = {
  report: ModerationReport;
  kind: 'suspension' | 'ban';
} | null;

function actionLabel(action: string) {
  return action.replaceAll('_', ' ');
}

export function ModerationScreen() {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [audit, setAudit] = useState<ModerationAuditEvent[]>([]);
  const [sanctions, setSanctions] = useState<UserSanction[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sanctionDraft, setSanctionDraft] = useState<SanctionDraft>(null);
  const [sanctionReason, setSanctionReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextReports, nextAudit, nextSanctions] = await Promise.all([
        fetchModerationReports(),
        fetchModerationAudit(),
        fetchActiveSanctions(),
      ]);
      setReports(nextReports);
      setAudit(nextAudit);
      setSanctions(nextSanctions);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load moderation.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (
    report: ModerationReport,
    action: 'reviewing' | 'dismiss' | 'hide' | 'remove',
  ) => {
    setWorkingId(report.id);
    setError(null);
    try {
      await moderateReport(report.id, action);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update the report.');
    } finally {
      setWorkingId(null);
    }
  };

  const confirmContentAction = (
    report: ModerationReport,
    action: 'dismiss' | 'hide' | 'remove',
  ) => {
    const labels = {
      dismiss: ['Dismiss report?', 'The content will remain visible.'],
      hide: ['Hide this content?', 'It will no longer be visible to regular members.'],
      remove: ['Remove this content?', 'It will be marked as removed.'],
    } as const;
    Alert.alert(labels[action][0], labels[action][1], [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'dismiss' ? 'Dismiss' : action === 'hide' ? 'Hide' : 'Remove',
        style: action === 'dismiss' ? 'default' : 'destructive',
        onPress: () => void decide(report, action),
      },
    ]);
  };

  const submitSanction = async () => {
    if (!sanctionDraft) return;
    setWorkingId(sanctionDraft.report.id);
    setError(null);
    try {
      await applyUserSanction(
        sanctionDraft.report,
        sanctionDraft.kind,
        sanctionReason,
        sanctionDraft.kind === 'suspension' ? 24 : undefined,
      );
      setSanctionDraft(null);
      setSanctionReason('');
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not sanction this account.');
    } finally {
      setWorkingId(null);
    }
  };

  const revokeSanction = (sanction: UserSanction) => {
    Alert.alert(
      `Restore ${sanction.displayName}?`,
      'Their account will become active immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore account',
          onPress: () => {
            setWorkingId(sanction.id);
            void revokeUserSanction(sanction.userId, 'Restored from moderation console')
              .then(load)
              .catch((nextError: unknown) => {
                setError(nextError instanceof Error ? nextError.message : 'Could not restore account.');
              })
              .finally(() => setWorkingId(null));
          },
        },
      ],
    );
  };

  return (
    <>
      <ScreenContainer contentClassName="px-5">
        <Card className="mt-3 mb-5 border-brand/20 bg-brand/[0.05]">
          <View className="flex-row items-center gap-3">
            <Ionicons name="shield-outline" size={24} color={palette.brandLight} />
            <View className="flex-1">
              <Text variant="subtitle">Moderation queue</Text>
              <Text variant="caption" className="mt-1">
                Review reports carefully. Every action is recorded.
              </Text>
            </View>
            <View className="min-w-8 h-8 rounded-full bg-live px-2 items-center justify-center">
              <Text className="text-white text-sm font-semibold">{reports.length}</Text>
            </View>
          </View>
        </Card>
        {error ? (
          <Pressable onPress={() => void load()}>
            <Text className="mb-4 text-center text-red-500">{error} Tap to retry.</Text>
          </Pressable>
        ) : null}
        {loading ? <Text variant="caption">Loading moderation queue...</Text> : null}
        {!loading && reports.length === 0 ? (
          <EmptyState title="Queue is clear" message="New member reports will appear here." />
        ) : null}
        {reports.map((report) => {
          const busy = workingId === report.id;
          return (
            <Card key={report.id} className="mb-4 border-border p-5">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text variant="label">{report.targetType.replaceAll('_', ' ')}</Text>
                  <Text variant="subtitle" className="mt-2">{report.targetDisplayName}</Text>
                  <Text className="mt-2 font-semibold text-red-400">
                    {report.reason.replaceAll('_', ' ')}
                  </Text>
                </View>
                <View className="rounded-md bg-brand/10 px-2 py-1">
                  <Text variant="caption">{report.status}</Text>
                </View>
              </View>
              {report.contentExcerpt ? (
                <View className="mt-4 border-l-2 border-brand/30 pl-3">
                  <Text numberOfLines={6}>{report.contentExcerpt}</Text>
                </View>
              ) : null}
              {report.details ? <Text variant="caption" className="mt-3">{report.details}</Text> : null}
              <Text variant="caption" className="mt-3">
                Reported {new Date(report.createdAt).toLocaleString()}
              </Text>
              <View className="mt-4 flex-row flex-wrap gap-2">
                {report.status === 'open' ? (
                  <Button
                    title="Review"
                    variant="secondary"
                    className="min-h-10 px-4 py-2"
                    disabled={busy}
                    onPress={() => void decide(report, 'reviewing')}
                  />
                ) : null}
                {report.targetType !== 'user' ? (
                  <>
                    <Button
                      title="Hide"
                      variant="secondary"
                      className="min-h-10 px-4 py-2"
                      disabled={busy}
                      onPress={() => confirmContentAction(report, 'hide')}
                    />
                    <Button
                      title="Remove"
                      variant="danger"
                      className="min-h-10 px-4 py-2"
                      disabled={busy}
                      onPress={() => confirmContentAction(report, 'remove')}
                    />
                  </>
                ) : null}
                <Button
                  title="Suspend 24h"
                  variant="secondary"
                  className="min-h-10 px-4 py-2"
                  disabled={busy}
                  onPress={() => {
                    setSanctionDraft({ report, kind: 'suspension' });
                    setSanctionReason('');
                  }}
                />
                <Button
                  title="Ban"
                  variant="danger"
                  className="min-h-10 px-4 py-2"
                  disabled={busy}
                  onPress={() => {
                    setSanctionDraft({ report, kind: 'ban' });
                    setSanctionReason('');
                  }}
                />
                <Button
                  title="Dismiss"
                  variant="ghost"
                  className="min-h-10 px-3 py-2"
                  disabled={busy}
                  onPress={() => confirmContentAction(report, 'dismiss')}
                />
              </View>
            </Card>
          );
        })}
        <Text variant="label" className="mt-5 mb-2">Active sanctions</Text>
        {sanctions.length === 0 ? (
          <Text variant="caption" className="mb-4">No accounts are currently sanctioned.</Text>
        ) : null}
        {sanctions.map((sanction) => (
          <View
            key={sanction.id}
            className="flex-row items-center gap-3 border-b border-border-subtle py-4"
          >
            <View className="flex-1">
              <Text className="font-semibold">{sanction.displayName}</Text>
              <Text className="mt-1 capitalize text-red-400">{sanction.kind}</Text>
              <Text variant="caption" className="mt-1">{sanction.reason}</Text>
              {sanction.endsAt ? (
                <Text variant="caption" className="mt-1">
                  Until {new Date(sanction.endsAt).toLocaleString()}
                </Text>
              ) : null}
            </View>
            <Pressable
              className="min-h-10 rounded-lg border border-brand/30 px-3 items-center justify-center"
              disabled={workingId === sanction.id}
              onPress={() => revokeSanction(sanction)}
            >
              <Text className="text-brand-light text-sm font-semibold">Restore</Text>
            </Pressable>
          </View>
        ))}
        <Text variant="label" className="mt-5 mb-2">Recent audit history</Text>
        {audit.map((event) => (
          <View key={event.id} className="border-b border-border-subtle py-3">
            <Text className="font-medium capitalize">{actionLabel(event.action)}</Text>
            {event.targetDisplayName ? (
              <Text variant="caption" className="mt-1">{event.targetDisplayName}</Text>
            ) : null}
            {event.note ? <Text variant="caption" className="mt-1">{event.note}</Text> : null}
            <Text variant="caption" className="mt-1">
              {new Date(event.createdAt).toLocaleString()}
            </Text>
          </View>
        ))}
        <View className="h-8" />
      </ScreenContainer>
      <ComposerModal
        visible={Boolean(sanctionDraft)}
        title={sanctionDraft?.kind === 'ban' ? 'Ban account' : 'Suspend for 24 hours'}
        value={sanctionReason}
        placeholder="Record the policy reason for this action..."
        submitTitle={sanctionDraft?.kind === 'ban' ? 'Ban account' : 'Suspend account'}
        maxLength={1000}
        loading={Boolean(workingId)}
        error={sanctionDraft ? error : null}
        onChangeText={setSanctionReason}
        onClose={() => setSanctionDraft(null)}
        onSubmit={() => void submitSanction()}
      />
    </>
  );
}
