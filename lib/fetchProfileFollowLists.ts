import { supabase } from '@/lib/supabase';
import type { FollowerItem } from '@/data/mock';

function mapProfileRow(p: {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count?: number | null;
  following_count?: number | null;
}): FollowerItem {
  const username = p.username?.trim() || 'user';
  const displayName = p.display_name?.trim() || username;
  const avatar =
    p.avatar_url?.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`;
  return {
    id: p.id,
    name: displayName,
    username,
    avatar,
    isVerified: false,
    displayName,
    followers: String(p.followers_count ?? 0),
    following: String(p.following_count ?? 0),
  };
}

/** Users who follow `profileId` (their `follower_id` → this profile as `following_id`). */
export async function fetchFollowersOfProfile(profileId: string): Promise<FollowerItem[]> {
  if (!profileId) return [];
  const { data: edges, error } = await supabase
    .from('profile_follows')
    .select('follower_id')
    .eq('following_id', profileId);
  if (error || !edges?.length) return [];
  const ids = [...new Set(edges.map((e) => e.follower_id as string).filter(Boolean))];
  if (!ids.length) return [];
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, followers_count, following_count')
    .in('id', ids);
  if (pErr || !profiles?.length) return [];
  return profiles.map((row) =>
    mapProfileRow(
      row as {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        followers_count: number | null;
        following_count: number | null;
      }
    )
  );
}

/** Users that `profileId` follows (`follower_id` = profile, `following_id` = other user). */
export async function fetchFollowingOfProfile(profileId: string): Promise<FollowerItem[]> {
  if (!profileId) return [];
  const { data: edges, error } = await supabase
    .from('profile_follows')
    .select('following_id')
    .eq('follower_id', profileId);
  if (error || !edges?.length) return [];
  const ids = [...new Set(edges.map((e) => e.following_id as string).filter(Boolean))];
  if (!ids.length) return [];
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, followers_count, following_count')
    .in('id', ids);
  if (pErr || !profiles?.length) return [];
  return profiles.map((row) =>
    mapProfileRow(
      row as {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        followers_count: number | null;
        following_count: number | null;
      }
    )
  );
}

/** Users who are fans of `profileId` (`fan_id` -> this profile as `athlete_id`). */
export async function fetchFansOfProfile(profileId: string): Promise<FollowerItem[]> {
  if (!profileId) return [];
  const { data: edges, error } = await supabase
    .from('profile_fans')
    .select('fan_id')
    .eq('athlete_id', profileId);
  if (error || !edges?.length) return [];
  const ids = [...new Set(edges.map((e) => e.fan_id as string).filter(Boolean))];
  if (!ids.length) return [];
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, followers_count, following_count')
    .in('id', ids);
  if (pErr || !profiles?.length) return [];
  return profiles.map((row) =>
    mapProfileRow(
      row as {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        followers_count: number | null;
        following_count: number | null;
      }
    )
  );
}
