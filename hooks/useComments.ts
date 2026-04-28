import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { faker } from '@faker-js/faker';
import { useAuth } from '@/context/AuthContext';
import { uploadPostMediaFile } from '@/lib/postMediaUpload';
import { supabase } from '@/lib/supabase';
import { useCommentLikes } from '@/hooks/useCommentLikes';
import type { Database } from '@/types/database';

type CommentRow = Database['public']['Tables']['comments']['Row'];
type CommentInsert = Database['public']['Tables']['comments']['Insert'];

type CommentProfile = {
  username: string | null;
  avatarUrl: string | null;
};

export type CommentNode = {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  /** Top-level comment id for this thread (used to bucket flat reply lists under a post). */
  threadRootId?: string;
  content: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  createdAt: string;
  likeCount: number;
  likedByCurrentUser: boolean;
  replyCount: number;
  author: {
    username: string;
    avatar: string;
  };
  isPending?: boolean;
};

/** When set, `parentId` is the comment being replied to; `threadRootId` buckets UI list under the top comment. */
export type AddCommentReplyTarget = {
  parentId: string;
  threadRootId: string;
};

export type CommentMediaDraft = {
  uri: string;
  type: 'image' | 'video';
};

type RepliesMap = Record<string, CommentNode[]>;
type ReplyCountMap = Record<string, number>;

type UseCommentsArgs = {
  postId: string;
  pageSize?: number;
  onPostCommentCountDelta?: (delta: number) => void;
  onServerCommentCountSync?: (count: number) => void;
};

const DEFAULT_PAGE_SIZE = 10;

function getFallbackUsername(userId: string) {
  return `user_${userId.slice(0, 6)}`;
}

function getFallbackAvatar(userId: string) {
  return `https://api.dicebear.com/9.x/initials/png?seed=${encodeURIComponent(userId)}`;
}

function mapRowsToNodes(
  rows: CommentRow[],
  likeCountByCommentId: Map<string, number>,
  likedByCurrentUserSet: Set<string>,
  replyCountByParentId: ReplyCountMap,
  profileByUserId: Map<string, CommentProfile>
): CommentNode[] {
  return rows.map((row) => ({
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    parentId: row.parent_id,
    content: row.content,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    createdAt: row.created_at,
    likeCount: likeCountByCommentId.get(row.id) ?? 0,
    likedByCurrentUser: likedByCurrentUserSet.has(row.id),
    replyCount: replyCountByParentId[row.id] ?? 0,
    author: {
      username: profileByUserId.get(row.user_id)?.username ?? getFallbackUsername(row.user_id),
      avatar: profileByUserId.get(row.user_id)?.avatarUrl ?? getFallbackAvatar(row.user_id),
    },
  }));
}

export function useComments({
  postId,
  pageSize = DEFAULT_PAGE_SIZE,
  onPostCommentCountDelta,
  onServerCommentCountSync,
}: UseCommentsArgs) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [repliesByParentId, setRepliesByParentId] = useState<RepliesMap>({});
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRepliesByParentId, setIsLoadingRepliesByParentId] = useState<Record<string, boolean>>({});
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [page, setPage] = useState(0);
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Record<string, boolean>>({});
  const commentsRef = useRef<CommentNode[]>([]);
  const repliesByParentIdRef = useRef<RepliesMap>({});
  const expandedReplyThreadsRef = useRef<Record<string, boolean>>({});
  const realtimeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommentRefreshRef = useRef(false);
  const pendingLikeCommentIdsRef = useRef(new Set<string>());
  const realtimeFlushInFlightRef = useRef(false);
  const realtimeNeedsAnotherFlushRef = useRef(false);

  const patchCommentLikeState = useCallback(
    (commentId: string, next: { likedByCurrentUser: boolean; likeCount: number }) => {
      setComments((prev) =>
        prev.map((item) => (item.id === commentId ? { ...item, ...next } : item))
      );
      setRepliesByParentId((prev) => {
        const nextReplies: RepliesMap = {};
        for (const key of Object.keys(prev)) {
          nextReplies[key] = prev[key].map((item) => (item.id === commentId ? { ...item, ...next } : item));
        }
        return nextReplies;
      });
    },
    []
  );

  const { toggleCommentLike } = useCommentLikes({
    currentUserId: user?.id,
    patchCommentLikeState,
  });

  const bumpReplyCountById = useCallback((commentId: string, delta: number) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, replyCount: Math.max(0, (c.replyCount ?? 0) + delta) }
          : c
      )
    );
    setRepliesByParentId((prev) => {
      const next: RepliesMap = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = next[k].map((item) =>
          item.id === commentId
            ? { ...item, replyCount: Math.max(0, (item.replyCount ?? 0) + delta) }
            : item
        );
      }
      return next;
    });
  }, []);

  const syncServerCommentCount = useCallback(async () => {
    if (!postId) return;
    const { count } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);
    if (typeof count === 'number') {
      onServerCommentCountSync?.(count);
    }
  }, [onServerCommentCountSync, postId]);

  const loadCommentsPage = useCallback(
    async (nextPage: number, replace = false) => {
      if (!postId) return;
      const offset = nextPage * pageSize;
      const to = offset + pageSize - 1;

      const { data: commentRows, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .range(offset, to);

      if (error || !commentRows) return;

      const commentIds = commentRows.map((row) => row.id);
      const userIds = Array.from(new Set(commentRows.map((row) => row.user_id)));

      const [likesResult, likedResult, edgesResult, profilesResult] = await Promise.all([
        commentIds.length
          ? supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds)
          : Promise.resolve({ data: [], error: null }),
        commentIds.length && user?.id
          ? supabase.from('comment_likes').select('comment_id').eq('user_id', user.id).in('comment_id', commentIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('comments').select('id, parent_id').eq('post_id', postId).not('parent_id', 'is', null),
        userIds.length
          ? supabase.from('profiles').select('*').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const likeCountByCommentId = new Map<string, number>();
      for (const row of likesResult.data ?? []) {
        const id = row.comment_id;
        likeCountByCommentId.set(id, (likeCountByCommentId.get(id) ?? 0) + 1);
      }

      const likedByCurrentUserSet = new Set<string>((likedResult.data ?? []).map((item) => item.comment_id));

      const childrenByParent = new Map<string, string[]>();
      for (const row of edgesResult.data ?? []) {
        const p = row.parent_id;
        if (!p) continue;
        const list = childrenByParent.get(p) ?? [];
        list.push(row.id);
        childrenByParent.set(p, list);
      }
      const countDescendants = (rootId: string): number => {
        let n = 0;
        const stack = [...(childrenByParent.get(rootId) ?? [])];
        while (stack.length) {
          const id = stack.pop()!;
          n += 1;
          const kids = childrenByParent.get(id);
          if (kids) {
            for (const c of kids) stack.push(c);
          }
        }
        return n;
      };
      const replyCountByParentId: ReplyCountMap = {};
      for (const id of commentIds) {
        replyCountByParentId[id] = countDescendants(id);
      }

      const profileByUserId = new Map<string, CommentProfile>();
      for (const profile of profilesResult.data ?? []) {
        const raw = profile as unknown as Record<string, unknown>;
        const avatarUrl =
          typeof raw.avatar_url === 'string'
            ? raw.avatar_url
            : typeof raw.avatar === 'string'
              ? raw.avatar
              : null;
        profileByUserId.set(profile.id, { username: profile.username, avatarUrl });
      }

      const mapped = mapRowsToNodes(
        commentRows,
        likeCountByCommentId,
        likedByCurrentUserSet,
        replyCountByParentId,
        profileByUserId
      ).map((node) => ({ ...node, threadRootId: node.id }));

      setComments((prev) => (replace ? mapped : [...prev, ...mapped]));
      setHasMoreComments(mapped.length === pageSize);
      setPage(nextPage);
      if (replace) {
        await syncServerCommentCount();
      }
    },
    [pageSize, postId, syncServerCommentCount, user?.id]
  );

  const loadInitialComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      await loadCommentsPage(0, true);
    } finally {
      setIsLoadingComments(false);
    }
  }, [loadCommentsPage]);

  const loadMoreComments = useCallback(async () => {
    if (!hasMoreComments || isLoadingMoreComments || isLoadingComments) return;
    setIsLoadingMoreComments(true);
    try {
      await loadCommentsPage(page + 1, false);
    } finally {
      setIsLoadingMoreComments(false);
    }
  }, [hasMoreComments, isLoadingComments, isLoadingMoreComments, loadCommentsPage, page]);

  const loadReplies = useCallback(
    async (threadRootId: string) => {
      if (!threadRootId || isLoadingRepliesByParentId[threadRootId]) return;
      setIsLoadingRepliesByParentId((prev) => ({ ...prev, [threadRootId]: true }));

      try {
        const allRows: CommentRow[] = [];
        const seenIds = new Set<string>();
        let frontier: string[] = [threadRootId];

        for (let round = 0; round < 50 && frontier.length > 0; round += 1) {
          const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .in('parent_id', frontier);

          if (error) return;

          const nextFrontier: string[] = [];
          for (const row of data ?? []) {
            if (seenIds.has(row.id)) continue;
            seenIds.add(row.id);
            allRows.push(row);
            nextFrontier.push(row.id);
          }
          frontier = nextFrontier;
        }

        allRows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const replyIds = allRows.map((row) => row.id);
        const userIds = Array.from(new Set(allRows.map((row) => row.user_id)));
        const idSet = new Set(replyIds);

        const [likesResult, likedResult, profilesResult] = await Promise.all([
          replyIds.length
            ? supabase.from('comment_likes').select('comment_id').in('comment_id', replyIds)
            : Promise.resolve({ data: [], error: null }),
          replyIds.length && user?.id
            ? supabase.from('comment_likes').select('comment_id').eq('user_id', user.id).in('comment_id', replyIds)
            : Promise.resolve({ data: [], error: null }),
          userIds.length
            ? supabase.from('profiles').select('*').in('id', userIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const likeCountByCommentId = new Map<string, number>();
        for (const row of likesResult.data ?? []) {
          const id = row.comment_id;
          likeCountByCommentId.set(id, (likeCountByCommentId.get(id) ?? 0) + 1);
        }

        const likedByCurrentUserSet = new Set<string>((likedResult.data ?? []).map((item) => item.comment_id));
        const replyCountByParentId: ReplyCountMap = {};
        for (const row of allRows) {
          const pid = row.parent_id;
          if (!pid) continue;
          if (pid !== threadRootId && !idSet.has(pid)) continue;
          replyCountByParentId[pid] = (replyCountByParentId[pid] ?? 0) + 1;
        }
        const profileByUserId = new Map<string, CommentProfile>();
        for (const profile of profilesResult.data ?? []) {
          const raw = profile as unknown as Record<string, unknown>;
          const avatarUrl =
            typeof raw.avatar_url === 'string'
              ? raw.avatar_url
              : typeof raw.avatar === 'string'
                ? raw.avatar
                : null;
          profileByUserId.set(profile.id, { username: profile.username, avatarUrl });
        }

        const mapped = mapRowsToNodes(
          allRows,
          likeCountByCommentId,
          likedByCurrentUserSet,
          replyCountByParentId,
          profileByUserId
        ).map((node) => ({ ...node, threadRootId }));
        setRepliesByParentId((prev) => ({ ...prev, [threadRootId]: mapped }));
        setComments((prev) =>
          prev.map((c) => (c.id === threadRootId ? { ...c, replyCount: mapped.length } : c))
        );
        setExpandedReplyThreads((prev) => ({ ...prev, [threadRootId]: true }));
      } finally {
        setIsLoadingRepliesByParentId((prev) => ({ ...prev, [threadRootId]: false }));
      }
    },
    [isLoadingRepliesByParentId, postId, user?.id]
  );

  const refreshLikeStateForComments = useCallback(
    async (commentIds: string[]) => {
      if (!commentIds.length) return;

      const [likesResult, likedResult] = await Promise.all([
        supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds),
        user?.id
          ? supabase.from('comment_likes').select('comment_id').eq('user_id', user.id).in('comment_id', commentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const likeCountByCommentId = new Map<string, number>();
      for (const row of likesResult.data ?? []) {
        const id = row.comment_id;
        likeCountByCommentId.set(id, (likeCountByCommentId.get(id) ?? 0) + 1);
      }
      const likedByCurrentUserSet = new Set<string>((likedResult.data ?? []).map((item) => item.comment_id));

      setComments((prev) =>
        prev.map((item) => {
          if (!commentIds.includes(item.id)) return item;
          return {
            ...item,
            likeCount: likeCountByCommentId.get(item.id) ?? 0,
            likedByCurrentUser: likedByCurrentUserSet.has(item.id),
          };
        })
      );

      setRepliesByParentId((prev) => {
        const nextReplies: RepliesMap = {};
        for (const key of Object.keys(prev)) {
          nextReplies[key] = prev[key].map((item) => {
            if (!commentIds.includes(item.id)) return item;
            return {
              ...item,
              likeCount: likeCountByCommentId.get(item.id) ?? 0,
              likedByCurrentUser: likedByCurrentUserSet.has(item.id),
            };
          });
        }
        return nextReplies;
      });
    },
    [user?.id]
  );

  const deleteComment = useCallback(
    async (comment: CommentNode) => {
      if (!user?.id || comment.userId !== user.id) return false;
      if (comment.isPending || comment.id.startsWith('temp-')) return false;

      const isTop = comment.parentId == null;
      const threadRootId = comment.threadRootId ?? comment.id;

      if (isTop) {
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
        setRepliesByParentId((prev) => {
          const next = { ...prev };
          delete next[comment.id];
          return next;
        });
        setExpandedReplyThreads((prev) => {
          const next = { ...prev };
          delete next[comment.id];
          return next;
        });
      } else {
        setRepliesByParentId((prev) => ({
          ...prev,
          [threadRootId]: (prev[threadRootId] ?? []).filter((r) => r.id !== comment.id),
        }));
        if (comment.parentId) {
          bumpReplyCountById(comment.parentId, -1);
          if (comment.parentId !== threadRootId) {
            bumpReplyCountById(threadRootId, -1);
          }
        }
      }

      const { error } = await supabase.from('comments').delete().eq('id', comment.id);

      if (error) {
        await loadCommentsPage(0, true);
        setRepliesByParentId({});
        setExpandedReplyThreads({});
        await syncServerCommentCount();
        return false;
      }

      await syncServerCommentCount();
      if (!isTop && expandedReplyThreadsRef.current[threadRootId]) {
        await loadReplies(threadRootId);
      }
      return true;
    },
    [bumpReplyCountById, loadCommentsPage, loadReplies, syncServerCommentCount, user?.id]
  );

  const editComment = useCallback(
    async (comment: CommentNode, nextContent: string) => {
      if (!user?.id || comment.userId !== user.id) return false;
      const trimmed = nextContent.trim();
      if (!trimmed || comment.isPending || comment.id.startsWith('temp-')) return false;

      const prevContent = comment.content;
      const patchContent = (targetId: string, content: string) => {
        setComments((prev) => prev.map((c) => (c.id === targetId ? { ...c, content } : c)));
        setRepliesByParentId((prev) => {
          const next: RepliesMap = {};
          for (const key of Object.keys(prev)) {
            next[key] = prev[key].map((item) => (item.id === targetId ? { ...item, content } : item));
          }
          return next;
        });
      };

      patchContent(comment.id, trimmed);
      const { error } = await supabase.from('comments').update({ content: trimmed }).eq('id', comment.id);
      if (error) {
        patchContent(comment.id, prevContent);
        return false;
      }
      return true;
    },
    [user?.id]
  );

  const toggleReplies = useCallback(
    async (parentCommentId: string) => {
      const isExpanded = expandedReplyThreads[parentCommentId];
      if (isExpanded) {
        setExpandedReplyThreads((prev) => ({ ...prev, [parentCommentId]: false }));
        return;
      }
      if (!repliesByParentId[parentCommentId]) {
        await loadReplies(parentCommentId);
        return;
      }
      setExpandedReplyThreads((prev) => ({ ...prev, [parentCommentId]: true }));
    },
    [expandedReplyThreads, loadReplies, repliesByParentId]
  );

  const addComment = useCallback(
    async (content: string, reply?: AddCommentReplyTarget | null, media?: CommentMediaDraft | null) => {
      if (!user?.id || !postId) return false;
      const trimmed = content.trim();
      if (!trimmed && !media) return false;

      let uploadedMediaUrl: string | null = null;
      if (media) {
        const uploadResult = await uploadPostMediaFile(media.uri, user.id, media.type);
        if (uploadResult.error || !uploadResult.url) {
          return false;
        }
        uploadedMediaUrl = uploadResult.url;
      }

      const isReply = Boolean(reply?.parentId);
      const safeParentId = reply?.parentId ?? null;
      const threadKey = reply?.threadRootId ?? null;
      const tempId = `temp-comment-${faker.string.uuid()}`;
      const optimistic: CommentNode = {
        id: tempId,
        postId,
        userId: user.id,
        parentId: safeParentId,
        ...(threadKey ? { threadRootId: threadKey } : {}),
        content: trimmed,
        mediaUrl: uploadedMediaUrl,
        mediaType: media?.type ?? null,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        likedByCurrentUser: false,
        replyCount: 0,
        author: {
          username:
            typeof user.user_metadata?.username === 'string'
              ? user.user_metadata.username
              : getFallbackUsername(user.id),
          avatar:
            typeof user.user_metadata?.avatar_url === 'string'
              ? user.user_metadata.avatar_url
              : getFallbackAvatar(user.id),
        },
        isPending: true,
      };

      setIsSubmitting(true);
      onPostCommentCountDelta?.(1);

      if (isReply && safeParentId && threadKey) {
        setRepliesByParentId((prev) => ({
          ...prev,
          [threadKey]: [...(prev[threadKey] ?? []), optimistic],
        }));
        setExpandedReplyThreads((prev) => ({ ...prev, [threadKey]: true }));
        bumpReplyCountById(safeParentId, 1);
        if (safeParentId !== threadKey) {
          bumpReplyCountById(threadKey, 1);
        }
      } else {
        setComments((prev) => [{ ...optimistic, threadRootId: tempId }, ...prev]);
      }

      try {
        const insert: CommentInsert = {
          post_id: postId,
          user_id: user.id,
          parent_id: safeParentId,
          content: trimmed,
          media_url: uploadedMediaUrl,
          media_type: media?.type ?? null,
        };
        const { data, error } = await supabase.from('comments').insert(insert).select().single();
        if (error || !data) {
          throw error ?? new Error('Comment insert failed');
        }

        const persisted: CommentNode = {
          ...optimistic,
          id: data.id,
          createdAt: data.created_at,
          isPending: false,
        };

        if (isReply && threadKey) {
          setRepliesByParentId((prev) => ({
            ...prev,
            [threadKey]: (prev[threadKey] ?? []).map((item) => (item.id === tempId ? persisted : item)),
          }));
        } else {
          setComments((prev) =>
            prev.map((item) =>
              item.id === tempId ? { ...persisted, threadRootId: persisted.id } : item
            )
          );
        }
        await syncServerCommentCount();
        return true;
      } catch {
        onPostCommentCountDelta?.(-1);
        if (isReply && safeParentId && threadKey) {
          setRepliesByParentId((prev) => ({
            ...prev,
            [threadKey]: (prev[threadKey] ?? []).filter((item) => item.id !== tempId),
          }));
          bumpReplyCountById(safeParentId, -1);
          if (safeParentId !== threadKey) {
            bumpReplyCountById(threadKey, -1);
          }
        } else {
          setComments((prev) => prev.filter((item) => item.id !== tempId));
        }
        await syncServerCommentCount();
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [bumpReplyCountById, onPostCommentCountDelta, postId, syncServerCommentCount, user]
  );

  const canLoadMore = useMemo(() => hasMoreComments && !isLoadingComments && !isLoadingMoreComments, [
    hasMoreComments,
    isLoadingComments,
    isLoadingMoreComments,
  ]);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    repliesByParentIdRef.current = repliesByParentId;
  }, [repliesByParentId]);

  useEffect(() => {
    expandedReplyThreadsRef.current = expandedReplyThreads;
  }, [expandedReplyThreads]);

  const flushRealtimeQueue = useCallback(async () => {
    if (realtimeFlushInFlightRef.current) {
      realtimeNeedsAnotherFlushRef.current = true;
      return;
    }

    realtimeFlushInFlightRef.current = true;
    try {
      do {
        realtimeNeedsAnotherFlushRef.current = false;

        const shouldRefreshComments = pendingCommentRefreshRef.current;
        pendingCommentRefreshRef.current = false;

        const likeIds = Array.from(pendingLikeCommentIdsRef.current);
        pendingLikeCommentIdsRef.current.clear();

        if (shouldRefreshComments) {
          await loadCommentsPage(0, true);
          const expandedParentIds = Object.entries(expandedReplyThreadsRef.current)
            .filter(([, expanded]) => expanded)
            .map(([parentId]) => parentId);
          if (expandedParentIds.length) {
            await Promise.all(expandedParentIds.map((parentId) => loadReplies(parentId)));
          }
          continue;
        }

        if (likeIds.length > 0) {
          await refreshLikeStateForComments(likeIds);
        }
      } while (
        realtimeNeedsAnotherFlushRef.current ||
        pendingCommentRefreshRef.current ||
        pendingLikeCommentIdsRef.current.size > 0
      );
    } finally {
      realtimeFlushInFlightRef.current = false;
    }
  }, [loadCommentsPage, loadReplies, refreshLikeStateForComments]);

  const scheduleRealtimeFlush = useCallback(
    (delayMs = 250) => {
      if (realtimeFlushInFlightRef.current) {
        realtimeNeedsAnotherFlushRef.current = true;
        return;
      }

      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
      realtimeDebounceTimerRef.current = setTimeout(() => {
        realtimeDebounceTimerRef.current = null;
        void flushRealtimeQueue();
      }, delayMs);
    },
    [flushRealtimeQueue]
  );

  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`public:comments-and-likes:realtime:${postId}:${user?.id ?? 'anon'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        () => {
          pendingCommentRefreshRef.current = true;
          scheduleRealtimeFlush(300);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_likes' },
        (payload) => {
          const next = payload.new as { comment_id?: string } | null;
          const prev = payload.old as { comment_id?: string } | null;
          const changedCommentId = next?.comment_id ?? prev?.comment_id;
          if (!changedCommentId) return;

          const visibleCommentIds = new Set<string>(commentsRef.current.map((item) => item.id));
          for (const parentId of Object.keys(repliesByParentIdRef.current)) {
            for (const reply of repliesByParentIdRef.current[parentId] ?? []) {
              visibleCommentIds.add(reply.id);
            }
          }
          if (!visibleCommentIds.has(changedCommentId)) return;

          pendingLikeCommentIdsRef.current.add(changedCommentId);
          scheduleRealtimeFlush(200);
        }
      )
      .subscribe();

    return () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
        realtimeDebounceTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [
    postId,
    scheduleRealtimeFlush,
    user?.id,
  ]);

  return {
    comments,
    repliesByParentId,
    expandedReplyThreads,
    isLoadingComments,
    isLoadingMoreComments,
    isSubmitting,
    isLoadingRepliesByParentId,
    canLoadMore,
    loadInitialComments,
    loadMoreComments,
    toggleReplies,
    addComment,
    editComment,
    deleteComment,
    toggleCommentLike,
  };
}
