import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type UseProfileFollowOptions = {
  /** Called after a successful follow or unfollow (e.g. refetch `profiles` counts). */
  onCountsChanged?: () => void;
  /** Best guess from navigation (e.g. feed prefetch) so the icon can render correctly before verify. */
  initialIsFollowing?: boolean;
  /** Sync local caches (e.g. feed author follow set) after a successful toggle. */
  onFollowChange?: (targetUserId: string, following: boolean) => void;
};

function isPlaceholderProfileId(id: string): boolean {
  return id.startsWith('pending-');
}

export function useProfileFollow(targetUserId: string | undefined, options?: UseProfileFollowOptions) {
  const { user } = useAuth();
  const router = useRouter();
  const currentId = user?.id ?? null;
  const targetId = targetUserId?.trim() || '';
  const onCountsChangedRef = useRef(options?.onCountsChanged);
  onCountsChangedRef.current = options?.onCountsChanged;
  const onFollowChangeRef = useRef(options?.onFollowChange);
  onFollowChangeRef.current = options?.onFollowChange;
  const initialHint = options?.initialIsFollowing;

  const [isFollowing, setIsFollowing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!targetId || !currentId || currentId === targetId) {
      setIsFollowing(false);
      return;
    }

    if (isPlaceholderProfileId(targetId)) {
      setIsFollowing(Boolean(initialHint));
      return;
    }

    let cancelled = false;
    if (typeof initialHint === 'boolean') {
      setIsFollowing(initialHint);
    } else {
      setIsFollowing(false);
    }

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profile_follows')
          .select('follower_id')
          .eq('follower_id', currentId)
          .eq('following_id', targetId)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;
        setIsFollowing(!!data);
      } catch {
        if (!cancelled) setIsFollowing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentId, targetId, initialHint]);

  const toggleFollow = useCallback(async () => {
    if (!targetId) return;

    if (!currentId) {
      Alert.alert('Sign in required', 'Sign in to follow people.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }

    if (currentId === targetId) return;
    if (isPlaceholderProfileId(targetId)) return;

    setActionLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('profile_follows')
          .delete()
          .eq('follower_id', currentId)
          .eq('following_id', targetId);
        if (error) throw error;
        setIsFollowing(false);
        onFollowChangeRef.current?.(targetId, false);
      } else {
        const { error } = await supabase.from('profile_follows').insert({
          follower_id: currentId,
          following_id: targetId,
        });
        if (error) throw error;
        setIsFollowing(true);
        onFollowChangeRef.current?.(targetId, true);
      }
      onCountsChangedRef.current?.();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update follow.');
    } finally {
      setActionLoading(false);
    }
  }, [currentId, isFollowing, router, targetId]);

  return {
    isFollowing,
    followBusy: actionLoading,
    toggleFollow,
    isViewerSelf: !!(currentId && targetId && currentId === targetId),
  };
}
