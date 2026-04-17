import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '@/data/mock';

function capitalizeFirstLetterOfEachWord(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Maps the signed-in Supabase user to the feed `User` shape when a full profile row is not loaded. */
export function mapAuthUserToFeedUser(authUser: SupabaseUser): User {
  const meta = authUser.user_metadata as {
    full_name?: string;
    profile_name?: string;
    role?: string;
    username?: string;
    sport?: string;
    team?: string;
    bio?: string;
    location?: string;
    avatar_url?: string;
    banner_url?: string;
  } | undefined;
  const email = authUser.email ?? '';
  const rawName = meta?.profile_name?.trim() || meta?.full_name?.trim() || email.split('@')[0] || 'User';
  const name = capitalizeFirstLetterOfEachWord(rawName);
  const username = meta?.username?.trim() || email.split('@')[0] || 'user';

  return {
    id: authUser.id,
    name,
    username: username || email.split('@')[0] || 'user',
    avatar: meta?.avatar_url?.trim() ?? '',
    banner: meta?.banner_url?.trim() || undefined,
    isVerified: false,
    isAthlete: meta?.role === 'athlete',
    sport: meta?.sport?.trim() ?? '',
    team: meta?.team?.trim() || undefined,
    bio: meta?.bio?.trim() || undefined,
    location: meta?.location?.trim() || undefined,
    followers: '0',
    fans: '0',
    following: '0',
    highlightsCount: 0,
  };
}
