import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type ViewerFollowsContextValue = {
  /** Whether the signed-in user follows `userId` (based on the last full load + local patches). */
  isViewerFollowingUser: (userId: string) => boolean;
  /** Whether the signed-in user is a fan of athlete `userId` (last full load + local patches). */
  isViewerFanningUser: (userId: string) => boolean;
  /** Update after follow/unfollow so navigation hints stay correct until the next reload. */
  patchViewerFollows: (followingUserId: string, following: boolean) => void;
  /** Update after fan/unfan so navigation hints stay correct until the next reload. */
  patchViewerFans: (athleteUserId: string, fanning: boolean) => void;
  /** Re-fetch all follows for the current user (e.g. after a remote change). */
  reloadViewerFollows: () => Promise<void>;
};

const ViewerFollowsContext = createContext<ViewerFollowsContextValue | undefined>(undefined);

export function ViewerFollowsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [followingIds, setFollowingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [fanningIds, setFanningIds] = useState<ReadonlySet<string>>(() => new Set());

  const loadAllFollowing = useCallback(async (forUserId: string) => {
    const { data, error } = await supabase.from('profile_follows').select('following_id').eq('follower_id', forUserId);
    if (error) {
      setFollowingIds(new Set());
      return;
    }
    const ids = (data ?? [])
      .map((row) => (row as { following_id?: string }).following_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    setFollowingIds(new Set(ids));
  }, []);

  const loadAllFanning = useCallback(async (forUserId: string) => {
    const { data, error } = await supabase.from('profile_fans').select('athlete_id').eq('fan_id', forUserId);
    if (error) {
      setFanningIds(new Set());
      return;
    }
    const ids = (data ?? [])
      .map((row) => (row as { athlete_id?: string }).athlete_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    setFanningIds(new Set(ids));
  }, []);

  useEffect(() => {
    if (!uid) {
      setFollowingIds(new Set());
      setFanningIds(new Set());
      return;
    }
    void loadAllFollowing(uid);
    void loadAllFanning(uid);
  }, [uid, loadAllFollowing, loadAllFanning]);

  const isViewerFollowingUser = useCallback((userId: string) => followingIds.has(userId), [followingIds]);
  const isViewerFanningUser = useCallback((userId: string) => fanningIds.has(userId), [fanningIds]);

  const patchViewerFollows = useCallback((followingUserId: string, following: boolean) => {
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (following) next.add(followingUserId);
      else next.delete(followingUserId);
      return next;
    });
  }, []);

  const patchViewerFans = useCallback((athleteUserId: string, fanning: boolean) => {
    setFanningIds((prev) => {
      const next = new Set(prev);
      if (fanning) next.add(athleteUserId);
      else next.delete(athleteUserId);
      return next;
    });
  }, []);

  const reloadViewerFollows = useCallback(async () => {
    if (!uid) {
      setFollowingIds(new Set());
      setFanningIds(new Set());
      return;
    }
    await Promise.all([loadAllFollowing(uid), loadAllFanning(uid)]);
  }, [uid, loadAllFollowing, loadAllFanning]);

  const value = useMemo(
    () => ({
      isViewerFollowingUser,
      isViewerFanningUser,
      patchViewerFollows,
      patchViewerFans,
      reloadViewerFollows,
    }),
    [isViewerFollowingUser, isViewerFanningUser, patchViewerFollows, patchViewerFans, reloadViewerFollows]
  );

  return <ViewerFollowsContext.Provider value={value}>{children}</ViewerFollowsContext.Provider>;
}

export function useViewerFollows(): ViewerFollowsContextValue {
  const ctx = useContext(ViewerFollowsContext);
  if (ctx === undefined) {
    throw new Error('useViewerFollows must be used within ViewerFollowsProvider');
  }
  return ctx;
}
