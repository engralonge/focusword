import { Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReportReason, ReportTargetType } from '@/types';
import { blockUser, reportContent } from '@/services/safety/safetyService';
import { palette } from '@/constants/colors';

type Props = {
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  targetLabel: string;
  allowBlock?: boolean;
  onChanged?: () => void;
  onError: (message: string) => void;
};

const reportReasons: Array<{ label: string; value: ReportReason }> = [
  { label: 'Spam or scam', value: 'spam' },
  { label: 'Harassment or bullying', value: 'harassment' },
  { label: 'Hate or discrimination', value: 'hate' },
  { label: 'Sexual content', value: 'sexual' },
  { label: 'Violence or threats', value: 'violence' },
  { label: 'Dangerous misinformation', value: 'misinformation' },
  { label: 'Something else', value: 'other' },
];

export function SafetyActions({
  targetType,
  targetId,
  targetUserId,
  targetLabel,
  allowBlock = true,
  onChanged,
  onError,
}: Props) {
  const submitReport = (
    reason: ReportReason,
    reportTargetType: ReportTargetType,
    reportTargetId: string,
  ) => {
    void reportContent(reportTargetType, reportTargetId, reason)
      .then(() => {
        Alert.alert('Report received', 'Thank you. A moderator can now review it.');
      })
      .catch((error: unknown) => {
        onError(error instanceof Error ? error.message : 'Could not submit the report.');
      });
  };

  const chooseReason = (
    reportTargetType: ReportTargetType,
    reportTargetId: string,
    subject: string,
  ) => {
    Alert.alert(
      `Report ${subject}?`,
      'Choose the reason that best describes the concern.',
      [
        ...reportReasons.map((reason) => ({
          text: reason.label,
          onPress: () =>
            submitReport(reason.value, reportTargetType, reportTargetId),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const confirmBlock = () => {
    if (!targetUserId) return;
    Alert.alert(
      `Block ${targetLabel}?`,
      'You will no longer see each other’s community, prayer, or live content.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void blockUser(targetUserId)
              .then(() => {
                onChanged?.();
                Alert.alert('Account blocked', `${targetLabel} is now hidden from your account.`);
              })
              .catch((error: unknown) => {
                onError(error instanceof Error ? error.message : 'Could not block this account.');
              });
          },
        },
      ],
    );
  };

  const open = () => {
    Alert.alert('Safety options', targetLabel, [
      {
        text: 'Report content',
        onPress: () => chooseReason(targetType, targetId, 'this content'),
      },
      ...(targetUserId
        ? [{
            text: 'Report account',
            onPress: () => chooseReason('user', targetUserId, targetLabel),
          }]
        : []),
      ...(allowBlock && targetUserId
        ? [{ text: 'Block account', style: 'destructive' as const, onPress: confirmBlock }]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      className="w-10 h-10 items-center justify-center"
      accessibilityRole="button"
      accessibilityLabel={`Safety options for ${targetLabel}`}
      onPress={open}
    >
      <Ionicons name="ellipsis-horizontal" size={20} color={palette.muted} />
    </Pressable>
  );
}
