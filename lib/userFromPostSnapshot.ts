import type { User } from '@/data/mock';
import type { Database } from '@/types/database';

type UserSnapshot = Database['public']['Tables']['posts']['Row']['user_snapshot'];

/**
 * Maps a post `user_snapshot` JSON blob to the app `User` shape (same rules as feed mapping).
 */
export function userFromPostSnapshot(snapshot: UserSnapshot, userId: string): User | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const base = snapshot as Record<string, unknown>;
  if (typeof base.name !== 'string' || typeof base.username !== 'string') return null;
  return {
    id: userId,
    name: base.name,
    username: base.username,
    avatar: typeof base.avatar === 'string' ? base.avatar : '',
    banner: typeof base.banner === 'string' ? base.banner : undefined,
    isVerified: Boolean(base.isVerified),
    isAthlete: Boolean(base.isAthlete),
    sport: typeof base.sport === 'string' ? base.sport : '',
    team: typeof base.team === 'string' ? base.team : undefined,
    bio: typeof base.bio === 'string' ? base.bio : undefined,
    location: typeof base.location === 'string' ? base.location : undefined,
    followers: typeof base.followers === 'string' ? base.followers : '0',
    fans: typeof base.fans === 'string' ? base.fans : '0',
    following: typeof base.following === 'string' ? base.following : '0',
    highlightsCount: typeof base.highlightsCount === 'number' ? base.highlightsCount : 0,
  };
}
