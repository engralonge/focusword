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

export type UserProfile = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  bio?: string;
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
  body: string;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
};
