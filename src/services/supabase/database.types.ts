export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
        };
      };
      live_streams: {
        Row: {
          id: string;
          title: string;
          host_id: string;
          status: string;
          stream_url: string | null;
          viewer_count: number;
          scheduled_at: string | null;
          created_at: string;
        };
      };
      prayer_requests: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          is_anonymous: boolean;
          created_at: string;
        };
      };
      community_posts: {
        Row: {
          id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
      };
    };
  };
};