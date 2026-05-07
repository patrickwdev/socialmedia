import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { User } from '@/data/mock';

export type ProfileState = {
  profile: User | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};


function capitalizeFirstLetterOfEachWord(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Fetches the logged-in user's profile from Supabase and auth metadata,
 * and maps it to the app's User shape for the profile screen.
 */
export function useProfile(): ProfileState {
  const { user: authUser } = useAuth();
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileRef = useRef<User | null>(null);
  profileRef.current = profile;

  const fetchProfile = useCallback(async () => {
    const u = authUserRef.current;
    if (!u) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    // Only flip loading for the first load (no cached profile). Refetches after
    // edit-profile / metadata updates keep showing current UI until new data arrives.
    if (profileRef.current === null) {
      setLoading(true);
    }
    setError(null);
    try {
      const { data: row, error: fetchError } = await supabase
        .from('profiles')
        .select('id, username, email, followers_count, following_count, fans_count')
        .eq('id', u.id)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setProfile(null);
        setLoading(false);
        return;
      }

      const meta = u.user_metadata as {
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
      const email = row?.email ?? u.email ?? '';
      const rawName = meta?.profile_name?.trim() || meta?.full_name?.trim() || email.split('@')[0] || 'User';
      const name = capitalizeFirstLetterOfEachWord(rawName);
      const username = row?.username?.trim() || meta?.username?.trim() || email.split('@')[0] || 'user';

      const rowCounts = row as {
        followers_count?: number;
        following_count?: number;
        fans_count?: number;
      } | null;
      const followersCount = rowCounts?.followers_count ?? 0;
      const followingCount = rowCounts?.following_count ?? 0;
      const fansCount = rowCounts?.fans_count ?? 0;

      const displayUser: User = {
        id: u.id,
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
        followers: String(followersCount),
        fans: String(fansCount),
        following: String(followingCount),
        highlightsCount: 0,
      };
      setProfile(displayUser);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const metadataKey = authUser ? JSON.stringify(authUser.user_metadata ?? {}) : '';
  useEffect(() => {
    void fetchProfile();
  }, [authUser?.id, metadataKey, fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}
