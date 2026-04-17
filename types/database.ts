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
          likes: number;
          comments: number;
          shares: number;
          is_live: boolean;
          user_snapshot: Json;
          created_at: string;
        };
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
          likes?: number;
          comments?: number;
          shares?: number;
          is_live?: boolean;
          user_snapshot: Json;
          created_at?: string;
        };
        Update: {
          caption?: string;
          content?: string;
          assets?: Json | null;
          type?: 'video' | 'image' | 'text' | 'poll';
          post_type?: 'post' | 'clips';
          clips_source?: string | null;
          poll?: Json | null;
          likes?: number;
          comments?: number;
          shares?: number;
          is_live?: boolean;
          user_snapshot?: Json;
        };
      };
      profiles: {
        Row: { id: string; username: string; email: string };
        Insert: { id: string; username: string; email: string };
        Update: { username?: string; email?: string };
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
    };
    Enums: Record<string, never>;
  };
}
