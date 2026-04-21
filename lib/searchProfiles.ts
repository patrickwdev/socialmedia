import { supabase } from '@/lib/supabase';

export type ProfileSearchHit = {
  id: string;
  username: string;
};

/** Search `public.profiles` by username (case-insensitive partial match). */
export async function searchProfilesByUsername(
  query: string,
  opts?: { excludeUserId?: string; limit?: number },
): Promise<ProfileSearchHit[]> {
  const term = query.trim().replace(/%/g, '').replace(/\\/g, '').slice(0, 48);
  if (term.length < 1) return [];

  const limit = Math.min(Math.max(opts?.limit ?? 24, 1), 50);
  const pattern = `%${term}%`;

  let request = supabase.from('profiles').select('id, username').ilike('username', pattern).limit(limit);

  const excludeId = opts?.excludeUserId?.trim();
  if (excludeId) {
    request = request.neq('id', excludeId);
  }

  const { data, error } = await request;
  if (error) throw error;
  if (!data?.length) return [];

  return data
    .filter((row): row is { id: string; username: string } => typeof row.id === 'string' && typeof row.username === 'string')
    .map((row) => ({ id: row.id, username: row.username.trim() }))
    .filter((row) => row.username.length > 0);
}
