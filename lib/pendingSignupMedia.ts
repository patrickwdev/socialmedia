import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { uploadUserProfileImage } from '@/lib/profileMediaUpload';

const STORAGE_KEY = 'pending_signup_profile_media_v1';

export type PendingSignupMedia = {
  email: string;
  profileImageUri: string | null;
  bannerImageUri: string | null;
};

export async function savePendingSignupMedia(payload: PendingSignupMedia): Promise<void> {
  if (!payload.profileImageUri && !payload.bannerImageUri) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearPendingSignupMedia(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

async function loadPending(): Promise<PendingSignupMedia | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingSignupMedia;
    if (!parsed?.email || typeof parsed.email !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

const AVATARS_BUCKET = 'avatars';
const BANNERS_BUCKET = 'banners';

/**
 * After the user finishes email verification and signs in, upload images chosen during signup
 * and attach URLs to auth metadata. Returns the updated user if metadata was applied.
 */
export async function tryApplyPendingSignupMedia(user: User): Promise<User | null> {
  const pending = await loadPending();
  if (!pending) return null;
  const userEmail = user.email?.trim().toLowerCase();
  const pendingEmail = pending.email.trim().toLowerCase();
  if (!userEmail || userEmail !== pendingEmail) return null;
  if (!pending.profileImageUri && !pending.bannerImageUri) {
    await clearPendingSignupMedia();
    return null;
  }

  let avatarUrl: string | undefined;
  let bannerUrl: string | undefined;

  if (pending.profileImageUri) {
    const r = await uploadUserProfileImage(pending.profileImageUri, AVATARS_BUCKET, `${user.id}/avatar.jpg`);
    if (r.error || !r.url) return null;
    avatarUrl = r.url;
  }
  if (pending.bannerImageUri) {
    const r = await uploadUserProfileImage(pending.bannerImageUri, BANNERS_BUCKET, `${user.id}/banner.jpg`);
    if (r.error || !r.url) return null;
    bannerUrl = r.url;
  }

  const updateData: Record<string, unknown> = {
    ...(user.user_metadata ?? {}),
  };
  if (avatarUrl) updateData.avatar_url = avatarUrl;
  if (bannerUrl) updateData.banner_url = bannerUrl;

  const { data: updateResult, error } = await supabase.auth.updateUser({
    data: updateData as Record<string, string>,
  });
  if (error || !updateResult?.user) return null;
  await clearPendingSignupMedia();
  return updateResult.user;
}
