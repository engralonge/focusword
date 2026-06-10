export type ThemeMode = 'system' | 'light' | 'dark';

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
  createdAt: string;
  updatedAt: string;
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
