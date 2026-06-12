import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  HomeMain: undefined;
  FocusMode: undefined;
};

export type LiveStackParamList = {
  LiveHome: undefined;
  CreateStream: undefined;
  LiveStream: { streamId: string };
  Replay: { recordingId: string };
};

import type { BibleTranslation } from '@/types/bible';
import type { CommunityPost } from '@/types';

export type BibleStackParamList = {
  BibleMain: undefined;
  BibleReader: {
    book: string;
    chapter: number;
    verse?: number;
    translation?: BibleTranslation;
  };
  /** @deprecated Use BibleReader */
  PassageReader: { book: string; chapter: number };
};

export type PrayerStackParamList = {
  PrayerMain: undefined;
};

export type CommunityStackParamList = {
  CommunityMain: undefined;
  ActivityInbox: undefined;
  CommunityPost: { post: CommunityPost };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  CommunityPoints: undefined;
  EditProfile: undefined;
  Settings: undefined;
  NotificationSettings: undefined;
  BlockedUsers: undefined;
  Moderation: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  UpdatePassword: undefined;
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Live: NavigatorScreenParams<LiveStackParamList>;
  Bible: NavigatorScreenParams<BibleStackParamList>;
  Prayer: NavigatorScreenParams<PrayerStackParamList>;
  Community: NavigatorScreenParams<CommunityStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
