/**
 * Supabase database types.
 * Generate full types with: npx supabase gen types typescript --project-id YOUR_REF > types/database.ts
 * For now we use a minimal type so auth works; extend when you add tables.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      posts: {
        Row: {
          id: string;
          user_id: string;
          caption: string;
          content: string;
          assets: Json | null;
          type: 'video' | 'image' | 'text' | 'poll';
          post_type: 'post' | 'clips';
          clips_source: string | null;
          poll: Json | null;
          like_count: number;
          comments: number;
          shares: number;
          is_live: boolean;
          user_snapshot: Json;
          created_at: string;
          location: string | null;
        };
        Relationships: [];
        Insert: {
          id?: string;
          user_id: string;
          caption?: string;
          content?: string;
          assets?: Json | null;
          type: 'video' | 'image' | 'text' | 'poll';
          post_type?: 'post' | 'clips';
          clips_source?: string | null;
          poll?: Json | null;
          like_count?: number;
          comments?: number;
          shares?: number;
          is_live?: boolean;
          user_snapshot: Json;
          created_at?: string;
          location?: string | null;
        };
        Update: {
          caption?: string;
          content?: string;
          assets?: Json | null;
          type?: 'video' | 'image' | 'text' | 'poll';
          post_type?: 'post' | 'clips';
          clips_source?: string | null;
          poll?: Json | null;
          like_count?: number;
          comments?: number;
          shares?: number;
          is_live?: boolean;
          user_snapshot?: Json;
          location?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          followers_count?: number;
          following_count?: number;
          fans_count?: number;
        };
        Relationships: [];
        Insert: { id: string; username: string; email: string };
        Update: {
          username?: string;
          email?: string;
          followers_count?: number;
          following_count?: number;
          fans_count?: number;
        };
      };
      user_push_tokens: {
        Row: {
          user_id: string;
          expo_push_token: string;
          platform: string;
          created_at?: string;
        };
        Relationships: [];
        Insert: {
          user_id: string;
          expo_push_token: string;
          platform: string;
          created_at?: string;
        };
        Update: {
          expo_push_token?: string;
          platform?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          post_id: string;
          actor_ids: string[];
          count: number;
          type: string;
          read: boolean;
          hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          post_id: string;
          actor_ids?: string[];
          count?: number;
          type?: string;
          read?: boolean;
          hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          recipient_id?: string;
          post_id?: string;
          actor_ids?: string[];
          count?: number;
          type?: string;
          read?: boolean;
          hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      post_likes: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profile_follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: [];
      };
      profile_fans: {
        Row: {
          fan_id: string;
          athlete_id: string;
          created_at: string;
        };
        Insert: {
          fan_id: string;
          athlete_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          parent_id: string | null;
          content: string;
          media_url: string | null;
          media_type: 'image' | 'video' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          parent_id?: string | null;
          content: string;
          media_url?: string | null;
          media_type?: 'image' | 'video' | null;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          user_id?: string;
          parent_id?: string | null;
          content?: string;
          media_url?: string | null;
          media_type?: 'image' | 'video' | null;
          created_at?: string;
        };
        Relationships: [];
      };
      comment_likes: {
        Row: {
          id: string;
          comment_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          comment_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_email_available: {
        Args: { check_email: string };
        Returns: boolean;
      };
      check_username_available: {
        Args: { check_username: string };
        Returns: boolean;
      };
      add_like_notification: {
        Args: {
          p_post_id: string;
          p_actor_id: string;
          p_recipient_id: string;
        };
        Returns: string | null;
      };
      remove_like_notification: {
        Args: {
          p_post_id: string;
          p_actor_id: string;
          p_recipient_id: string;
        };
        Returns: string | null;
      };
      set_post_like: {
        Args: {
          p_post_id: string;
          p_user_id: string;
          p_like: boolean;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}
