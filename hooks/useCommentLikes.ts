import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type ToggleLikeArgs = {
  commentId: string;
  currentLikedByUser: boolean;
  currentLikeCount: number;
};

type UseCommentLikesArgs = {
  currentUserId?: string;
  patchCommentLikeState: (
    commentId: string,
    next: { likedByCurrentUser: boolean; likeCount: number }
  ) => void;
};

export function useCommentLikes({ currentUserId, patchCommentLikeState }: UseCommentLikesArgs) {
  const inFlightRef = useRef(new Set<string>());

  const toggleCommentLike = useCallback(
    async ({ commentId, currentLikedByUser, currentLikeCount }: ToggleLikeArgs) => {
      if (!currentUserId || !commentId) return;
      if (inFlightRef.current.has(commentId)) return;

      const nextLiked = !currentLikedByUser;
      const optimisticLikeCount = Math.max(0, currentLikeCount + (nextLiked ? 1 : -1));
      inFlightRef.current.add(commentId);

      patchCommentLikeState(commentId, {
        likedByCurrentUser: nextLiked,
        likeCount: optimisticLikeCount,
      });

      try {
        if (nextLiked) {
          const { error } = await supabase.from('comment_likes').insert({
            comment_id: commentId,
            user_id: currentUserId,
          });
          if (error) {
            patchCommentLikeState(commentId, {
              likedByCurrentUser: currentLikedByUser,
              likeCount: currentLikeCount,
            });
            return;
          }
        } else {
          const { error } = await supabase
            .from('comment_likes')
            .delete()
            .eq('comment_id', commentId)
            .eq('user_id', currentUserId);
          if (error) {
            patchCommentLikeState(commentId, {
              likedByCurrentUser: currentLikedByUser,
              likeCount: currentLikeCount,
            });
            return;
          }
        }

        const { count } = await supabase
          .from('comment_likes')
          .select('id', { count: 'exact', head: true })
          .eq('comment_id', commentId);

        patchCommentLikeState(commentId, {
          likedByCurrentUser: nextLiked,
          likeCount: typeof count === 'number' ? count : optimisticLikeCount,
        });
      } finally {
        inFlightRef.current.delete(commentId);
      }
    },
    [currentUserId, patchCommentLikeState]
  );

  return { toggleCommentLike };
}
