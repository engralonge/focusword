export type ThemeMode = 'system' | 'light' | 'dark';

export type FocusPreference = {
  consentedAt: string;
  consentVersion: string;
};

export type FocusSession = {
  id: string;
  plannedSeconds: number;
  focusedSeconds: number;
  interruptionCount: number;
  startedAt: string;
  endedAt?: string;
  completed: boolean;
};

export type CommunityPointKind =
  | 'focus_completion'
  | 'community_post'
  | 'community_comment'
  | 'prayer_support'
  | 'testimony'
  | 'live_host'
  | 'live_attendance'
  | 'live_stage';

export type CommunityPointEvent = {
  id: string;
  kind: CommunityPointKind;
  points: number;
  createdAt: string;
};

export type CommunityPointOverview = {
  totalPoints: number;
  todayPoints: number;
  currentStreak: number;
  completedActions: number;
  recentActivity: CommunityPointEvent[];
};

export type ActivityEventKind =
  | 'comment'
  | 'reaction'
  | 'prayer_support'
  | 'stage_invitation'
  | 'stage_update'
  | 'points'
  | 'live_reminder';

export type ActivityEvent = {
  id: string;
  kind: ActivityEventKind;
  title: string;
  body?: string;
  url?: string;
  actorName?: string;
  actorAvatarUrl?: string;
  read: boolean;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  bio?: string;
  role?: 'member' | 'moderator' | 'admin';
  accountStatus?: 'active' | 'suspended' | 'banned';
  suspendedUntil?: string;
};

export type ReportTargetType =
  | 'user'
  | 'community_post'
  | 'community_comment'
  | 'prayer_request'
  | 'prayer_update'
  | 'live_stream'
  | 'live_message';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'misinformation'
  | 'other';

export type ModerationReport = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetUserId: string;
  targetDisplayName: string;
  reason: ReportReason;
  details?: string;
  contentExcerpt?: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  resolutionNote?: string;
  createdAt: string;
};

export type BlockedUser = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  blockedAt: string;
};

export type ModerationAuditEvent = {
  id: string;
  action: string;
  targetDisplayName?: string;
  note?: string;
  createdAt: string;
};

export type UserSanction = {
  id: string;
  userId: string;
  displayName: string;
  kind: 'suspension' | 'ban';
  reason: string;
  endsAt?: string;
  createdAt: string;
};

export type NotificationPreferences = {
  live: boolean;
  community: boolean;
  prayer: boolean;
  points: boolean;
};

export type LiveStreamStatus = 'scheduled' | 'live' | 'ended';

export type LiveStream = {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  status: LiveStreamStatus;
  roomName: string;
  viewerCount: number;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
  isHost: boolean;
  reminderSet: boolean;
  recordingRequested: boolean;
  recordingStatus?: 'pending' | 'recording' | 'processing' | 'ready' | 'failed';
};

export type LiveRecording = {
  id: string;
  streamId: string;
  title: string;
  hostName: string;
  playbackUrl: string;
  durationSeconds?: number;
  readyAt: string;
};

export type LiveMessage = {
  id: string;
  streamId: string;
  userId: string;
  authorName: string;
  body: string;
  isOwner: boolean;
  createdAt: string;
};

export type LiveStageStatus =
  | 'pending'
  | 'invited'
  | 'approved'
  | 'declined'
  | 'removed'
  | 'cancelled';

export type LiveStageRequest = {
  id: string;
  streamId: string;
  userId: string;
  displayName: string;
  status: LiveStageStatus;
  isCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LiveRoomParticipant = {
  userId: string;
  displayName: string;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isSpeaking: boolean;
};

export type LiveBibleWorkspace = {
  streamId: string;
  book: string;
  chapter: number;
  translation: import('@/types/bible').BibleTranslation;
  activeVerse?: number;
  isVisible: boolean;
  summary?: string;
  summaryReference?: string;
  updatedAt: string;
};

export type BiblePassage = {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  text: string;
};

export type PrayerRequest = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  isAnonymous: boolean;
  status: 'published' | 'answered';
  supportCount: number;
  supportedByMe: boolean;
  isOwner: boolean;
  updates: PrayerUpdate[];
  createdAt: string;
  updatedAt: string;
};

export type PrayerUpdate = {
  id: string;
  prayerId: string;
  kind: 'update' | 'testimony';
  body: string;
  isOwner: boolean;
  createdAt: string;
};

export type CommunityPost = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatarUrl?: string;
  body: string;
  reactionCount: number;
  reactedByMe: boolean;
  commentCount: number;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommunityComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorAvatarUrl?: string;
  body: string;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
};
