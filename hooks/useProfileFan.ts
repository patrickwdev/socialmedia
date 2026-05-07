import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type UseProfileFanOptions = {
  /** Called after successful fan/unfan so callers can refresh denormalized counts. */
  onCountsChanged?: () => void;
  /** Called whenever local fan state changes (including optimistic updates). */
  onFanChange?: (isFan: boolean) => void;
  /** Best guess from navigation so fan icon can render correctly before verify. */
  initialIsFan?: boolean;
};

function isPlaceholderProfileId(id: string): boolean {
  return id.startsWith('pending-');
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const maybeMsg = (err as { message?: unknown }).message;
    if (typeof maybeMsg === 'string' && maybeMsg.trim()) return maybeMsg;
  }
  return 'Could not update fan status.';
}

export function useProfileFan(
  targetUserId: string | undefined,
  targetRole: 'athlete' | 'fan' | 'coach' | 'scout' | null,
  options?: UseProfileFanOptions
) {
  const { user } = useAuth();
  const router = useRouter();
  const currentId = user?.id ?? null;
  const targetId = targetUserId?.trim() || '';
  const onCountsChangedRef = useRef(options?.onCountsChanged);
  onCountsChangedRef.current = options?.onCountsChanged;
  const onFanChangeRef = useRef(options?.onFanChange);
  onFanChangeRef.current = options?.onFanChange;
  const initialHint = options?.initialIsFan;

  const [isFan, setIsFan] = useState(false);
  const [fanBusy, setFanBusy] = useState(false);

  useEffect(() => {
    if (!targetId || !currentId || currentId === targetId) {
      setIsFan(false);
      return;
    }

    // Known non-athlete targets cannot be fanned.
    if (targetRole === 'fan' || targetRole === 'coach' || targetRole === 'scout') {
      setIsFan(false);
      return;
    }

    if (isPlaceholderProfileId(targetId)) {
      setIsFan(Boolean(initialHint));
      return;
    }

    let cancelled = false;
    if (typeof initialHint === 'boolean') {
      setIsFan(initialHint);
    } else {
      setIsFan(false);
    }

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profile_fans')
          .select('fan_id')
          .eq('fan_id', currentId)
          .eq('athlete_id', targetId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        setIsFan(!!data);
      } catch {
        if (!cancelled) setIsFan(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentId, targetId, targetRole, initialHint]);

  const toggleFan = useCallback(async () => {
    if (!targetId || targetRole !== 'athlete') return;

    if (!currentId) {
      Alert.alert('Sign in required', 'Sign in to become a fan.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }

    if (currentId === targetId) return;
    if (isPlaceholderProfileId(targetId)) return;

    setFanBusy(true);
    const nextIsFan = !isFan;
    setIsFan(nextIsFan);
    onFanChangeRef.current?.(nextIsFan);
    try {
      if (isFan) {
        const { error } = await supabase
          .from('profile_fans')
          .delete()
          .eq('fan_id', currentId)
          .eq('athlete_id', targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('profile_fans').insert({
          fan_id: currentId,
          athlete_id: targetId,
        });
        // Duplicate relation can happen after refresh/race; treat as already-fanned success.
        if (error && (error as { code?: string }).code !== '23505') throw error;
      }
      onCountsChangedRef.current?.();
    } catch (e) {
      setIsFan(isFan);
      onFanChangeRef.current?.(isFan);
      Alert.alert('Error', getErrorMessage(e));
    } finally {
      setFanBusy(false);
    }
  }, [currentId, isFan, router, targetId, targetRole]);

  return {
    isFan,
    fanBusy,
    toggleFan,
  };
}
