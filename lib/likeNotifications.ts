import { supabase } from '@/lib/supabase';

type LikeNotificationArgs = {
  postId: string;
  actorId: string;
  recipientId: string;
};

/**
 * Adds a like notification using a 5-minute server-side aggregation window.
 * Returns notification id (or null for no-op cases, e.g. self-like).
 */
export async function addLikeNotification({
  postId,
  actorId,
  recipientId,
}: LikeNotificationArgs): Promise<string | null> {
  const { data, error } = await supabase.rpc('add_like_notification', {
    p_post_id: postId,
    p_actor_id: actorId,
    p_recipient_id: recipientId,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Removes a like actor from the most recent matching aggregated notification.
 * Returns affected notification id, or null when nothing changed.
 */
export async function removeLikeNotification({
  postId,
  actorId,
  recipientId,
}: LikeNotificationArgs): Promise<string | null> {
  const { data, error } = await supabase.rpc('remove_like_notification', {
    p_post_id: postId,
    p_actor_id: actorId,
    p_recipient_id: recipientId,
  });

  if (error) {
    throw error;
  }

  return data;
}
