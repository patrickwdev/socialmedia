import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { faker } from '@faker-js/faker';
import { type Post, type PostAsset, type PostPoll } from '@/data/mock';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Database, Json } from '@/types/database';
import type { User } from '@/data/mock';
import { formatRelativePostTime } from '@/lib/formatRelativePostTime';
import { uploadPostMediaFile } from '@/lib/postMediaUpload';
import { addLikeNotification, removeLikeNotification } from '@/lib/likeNotifications';

export type OptimisticMediaDraft = {
  author: User;
  caption: string;
  localAssets: PostAsset[];
  postKind: 'video' | 'image' | 'poll';
  processingMediaType: 'video' | 'image';
  poll?: PostPoll;
  postType: 'post' | 'clips';
  clipsSource?: 'highlights' | 'grinds' | 'clips';
  location?: string | null;
};

type FeedPostsContextType = {
  posts: Post[];
  clipsPosts: Post[];
  /** True after the first Supabase fetch finishes (success or error). */
  feedInitialLoadComplete: boolean;
  reloadFeed: () => Promise<void>;
  addPost: (post: Post) => Promise<boolean>;
  deletePost: (postId: string) => Promise<void>;
  togglePostLike: (post: Post) => Promise<void>;
  publishOptimisticMediaPost: (draft: OptimisticMediaDraft) => void;
  retryFailedMediaPost: (failedPost: Post) => void;
};

const FeedPostsContext = createContext<FeedPostsContextType | undefined>(undefined);

type PostRow = Database['public']['Tables']['posts']['Row'];
type PostsInsert = Database['public']['Tables']['posts']['Insert'];
type PostLikeRow = Database['public']['Tables']['post_likes']['Row'];

function asPostAssetArray(value: Database['public']['Tables']['posts']['Row']['assets']): Post['assets'] {
  if (!Array.isArray(value)) return undefined;
  const assets = value
    .map((item) => {
      if (
        item &&
        typeof item === 'object' &&
        'uri' in item &&
        'type' in item &&
        (item.type === 'video' || item.type === 'image') &&
        typeof item.uri === 'string'
      ) {
        return { uri: item.uri, type: item.type };
      }
      return null;
    })
    .filter((asset): asset is { uri: string; type: 'video' | 'image' } => asset !== null);
  return assets.length > 0 ? assets : undefined;
}

function asPostPoll(value: PostRow['poll']): PostPoll | undefined {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const o = value as Record<string, unknown>;
  if (typeof o.question !== 'string') return undefined;
  if (!Array.isArray(o.choices)) return undefined;
  const choices = o.choices
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.trim())
    .filter(Boolean);
  if (choices.length < 2) return undefined;
  const d = o.durationDays;
  const durationDays = d === 1 || d === 3 || d === 7 ? d : 7;
  const endsAt = typeof o.endsAt === 'string' ? o.endsAt : undefined;
  return { question: o.question.trim(), choices, durationDays, endsAt };
}

function asFeedUser(snapshot: Database['public']['Tables']['posts']['Row']['user_snapshot'], userId: string): User | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const base = snapshot as Record<string, unknown>;
  if (typeof base.name !== 'string' || typeof base.username !== 'string') return null;
  return {
    id: userId,
    name: base.name,
    username: base.username,
    avatar: typeof base.avatar === 'string' ? base.avatar : '',
    banner: typeof base.banner === 'string' ? base.banner : undefined,
    isVerified: Boolean(base.isVerified),
    isAthlete: Boolean(base.isAthlete),
    sport: typeof base.sport === 'string' ? base.sport : '',
    team: typeof base.team === 'string' ? base.team : undefined,
    bio: typeof base.bio === 'string' ? base.bio : undefined,
    location: typeof base.location === 'string' ? base.location : undefined,
    followers: typeof base.followers === 'string' ? base.followers : '0',
    fans: typeof base.fans === 'string' ? base.fans : '0',
    following: typeof base.following === 'string' ? base.following : '0',
    highlightsCount: typeof base.highlightsCount === 'number' ? base.highlightsCount : 0,
  };
}

function mapRowToPost(row: PostRow): Post | null {
  const user = asFeedUser(row.user_snapshot, row.user_id);
  if (!user) return null;
  const poll = asPostPoll(row.poll);
  return {
    id: row.id,
    user,
    content: row.content,
    assets: asPostAssetArray(row.assets),
    caption: row.caption,
    likes: row.like_count,
    comments: row.comments,
    shares: row.shares,
    timeAgo: formatRelativePostTime(row.created_at),
    createdAt: row.created_at,
    isLive: row.is_live,
    type: row.type,
    postType: row.post_type === 'clips' ? 'clips' : 'post',
    ...(row.clips_source === 'highlights' ||
    row.clips_source === 'grinds' ||
    row.clips_source === 'clips'
      ? { clipsSource: row.clips_source }
      : {}),
    ...(poll ? { poll } : {}),
    ...(typeof row.location === 'string' && row.location.trim()
      ? { location: row.location.trim() }
      : {}),
    likedByCurrentUser: false,
  };
}

function mergeServerPostsWithInflight(
  serverPosts: Post[],
  prevPosts: Post[],
  realIdByTempId: Map<string, string>
): Post[] {
  const inflight = prevPosts.filter(
    (p) =>
      typeof p.id === 'string' &&
      p.id.startsWith('temp-') &&
      p.uploadStatus &&
      p.uploadStatus !== 'posted'
  );
  const keptInflight = inflight.filter((p) => {
    const mappedReal = realIdByTempId.get(p.id);
    if (mappedReal && serverPosts.some((s) => s.id === mappedReal)) return false;
    return true;
  });
  const keptIds = new Set(keptInflight.map((p) => p.id));
  const serverFiltered = serverPosts.filter((s) => !keptIds.has(s.id));
  return [...keptInflight, ...serverFiltered];
}

export function FeedPostsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadedFromSupabase, setLoadedFromSupabase] = useState(false);
  const [feedInitialLoadComplete, setFeedInitialLoadComplete] = useState(false);
  const isFetchingRef = useRef(false);
  const realIdByTempId = useRef(new Map<string, string>());
  const abortedTempIds = useRef(new Set<string>());
  const likeToggleInFlightRef = useRef(new Set<string>());

  const loadPosts = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (postsError) {
        return;
      }

      const postIds = (postsData ?? []).map((row) => row.id);
      let likedPostIdSet = new Set<string>();

      if (user?.id && postIds.length > 0) {
        const { data: likesData, error: likesError } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);

        if (!likesError) {
          likedPostIdSet = new Set((likesData as Pick<PostLikeRow, 'post_id'>[] | null)?.map((l) => l.post_id) ?? []);
        }
      }

      const mapped = (postsData ?? [])
        .map(mapRowToPost)
        .filter((post): post is Post => post !== null)
        .map((post) => ({ ...post, likedByCurrentUser: likedPostIdSet.has(post.id) }));
      setPosts((prev) => mergeServerPostsWithInflight(mapped, prev, realIdByTempId.current));
      setLoadedFromSupabase(true);
    } finally {
      isFetchingRef.current = false;
      setFeedInitialLoadComplete(true);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const channel = supabase
      .channel(`public:posts-and-post-likes:realtime:${user?.id ?? 'anon'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => {
          void loadPosts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
          ...(user?.id ? { filter: `user_id=eq.${user.id}` } : {}),
        },
        () => {
          void loadPosts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPosts, user?.id]);

  const patchPostById = useCallback((postId: string, partial: Partial<Post>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...partial } : p)));
  }, []);

  const runOptimisticMediaPipeline = useCallback(
    (tempId: string, draft: OptimisticMediaDraft, persistedCreatedAt: string) => {
      if (!user) return;

      const patch = (partial: Partial<Post>) => {
        patchPostById(tempId, partial);
      };

      void (async () => {
        try {
          const n = draft.localAssets.length;
          const uploaded: PostAsset[] = [];
          for (let i = 0; i < n; i++) {
            if (abortedTempIds.current.has(tempId)) return;
            const asset = draft.localAssets[i];
            patch({
              uploadProgress: Math.max(1, Math.round(((i + 1) / n) * 70)),
            });
            const { url, error } = await uploadPostMediaFile(asset.uri, user.id, asset.type);
            if (error || !url) {
              patch({ uploadStatus: 'failed', uploadProgress: 0 });
              return;
            }
            uploaded.push({ uri: url, type: asset.type });
          }

          if (abortedTempIds.current.has(tempId)) return;

          if (draft.processingMediaType === 'video') {
            patch({ uploadStatus: 'processing', uploadProgress: 82 });
            await new Promise((r) => setTimeout(r, 450));
          }
          if (abortedTempIds.current.has(tempId)) return;

          patch({ uploadProgress: 93 });

          const realId = faker.string.uuid();
          const insertRow: PostsInsert = {
            id: realId,
            user_id: user.id,
            caption: draft.caption,
            content: uploaded[0].uri,
            assets: uploaded as unknown as Json,
            type: draft.postKind,
            post_type: draft.postType ?? 'post',
            clips_source: draft.clipsSource ?? null,
            poll: (draft.poll ?? null) as unknown as Json,
            like_count: 0,
            comments: 0,
            shares: 0,
            is_live: false,
            user_snapshot: draft.author as unknown as Json,
            created_at: persistedCreatedAt,
            location: draft.location?.trim() ? draft.location.trim() : null,
          };
          const { data, error } = await supabase.from('posts').insert(insertRow as never).select().single();

          if (error || !data) {
            if (__DEV__) {
              console.warn('[posts insert]', error?.message, error);
            }
            patch({ uploadStatus: 'failed', uploadProgress: 0 });
            return;
          }
          if (abortedTempIds.current.has(tempId)) return;

          const finalized = mapRowToPost(data as PostRow);
          if (!finalized) {
            patch({ uploadStatus: 'failed', uploadProgress: 0 });
            return;
          }
          realIdByTempId.current.set(tempId, finalized.id);
          setPosts((prev) => prev.map((p) => (p.id === tempId ? finalized : p)));
          realIdByTempId.current.delete(tempId);
        } catch (e) {
          if (__DEV__) {
            console.warn('[optimistic media post]', e);
          }
          patchPostById(tempId, { uploadStatus: 'failed', uploadProgress: 0 });
        }
      })();
    },
    [patchPostById, user]
  );

  const publishOptimisticMediaPost = useCallback(
    (draft: OptimisticMediaDraft) => {
      if (!user) return;
      const tempId = `temp-${faker.string.uuid()}`;
      const createdAt = new Date().toISOString();
      const primary = draft.localAssets[0];
      const optimistic: Post = {
        id: tempId,
        user: draft.author,
        content: primary.uri,
        assets: draft.localAssets,
        caption: draft.caption,
        likes: 0,
        comments: 0,
        reposts: 0,
        shares: 0,
        timeAgo: 'Just now',
        createdAt,
        type: draft.postKind,
        ...(draft.poll ? { poll: draft.poll } : {}),
        postType: draft.postType,
        ...(draft.postType === 'clips' && draft.clipsSource ? { clipsSource: draft.clipsSource } : {}),
        ...(draft.location?.trim() ? { location: draft.location.trim() } : {}),
        uploadStatus: 'uploading',
        uploadProgress: 0,
      };
      setPosts((prev) => [optimistic, ...prev]);
      runOptimisticMediaPipeline(tempId, draft, createdAt);
    },
    [runOptimisticMediaPipeline, user]
  );

  const retryFailedMediaPost = useCallback(
    (failedPost: Post) => {
      if (!user) return;
      if (!failedPost.id.startsWith('temp-') || failedPost.uploadStatus !== 'failed') return;
      const assets: PostAsset[] =
        failedPost.assets && failedPost.assets.length > 0
          ? failedPost.assets
          : [
              {
                uri: failedPost.content,
                type: failedPost.type === 'video' ? 'video' : 'image',
              },
            ];
      const draft: OptimisticMediaDraft = {
        // Failed optimistic uploads are media-backed; guard against broader Post unions.
        postKind: failedPost.type === 'text' ? (assets[0]?.type ?? 'image') : failedPost.type,
        processingMediaType: assets.some((a) => a.type === 'video') ? 'video' : 'image',
        author: failedPost.user,
        caption: failedPost.caption,
        localAssets: assets,
        ...(failedPost.poll ? { poll: failedPost.poll } : {}),
        postType: failedPost.postType ?? 'post',
        clipsSource: failedPost.clipsSource,
        location: failedPost.location ?? null,
      };
      const persistedCreatedAt = failedPost.createdAt ?? new Date().toISOString();
      patchPostById(failedPost.id, { uploadStatus: 'uploading', uploadProgress: 0 });
      runOptimisticMediaPipeline(failedPost.id, draft, persistedCreatedAt);
    },
    [patchPostById, runOptimisticMediaPipeline, user]
  );

  const addPost = useCallback(
    async (post: Post): Promise<boolean> => {
      setPosts((prev) => [post, ...prev]);
      if (!user) return true;

      const insertRow: PostsInsert = {
        id: post.id,
        user_id: user.id,
        caption: post.caption,
        content: post.content,
        assets: (post.assets ?? null) as unknown as Json,
        type: post.type,
        post_type: post.postType ?? 'post',
        clips_source: post.clipsSource ?? null,
        poll: (post.poll ?? null) as unknown as Json,
        like_count: post.likes,
        comments: post.comments,
        shares: post.shares,
        is_live: Boolean(post.isLive),
        user_snapshot: post.user as unknown as Json,
        location: post.location?.trim() ? post.location.trim() : null,
        ...(post.createdAt ? { created_at: post.createdAt } : {}),
      };
      const { error } = await supabase.from('posts').insert(insertRow as never);

      if (error) {
        if (__DEV__) {
          console.warn('[posts insert]', error.message, error);
        }
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        if (loadedFromSupabase) {
          void loadPosts();
        }
        return false;
      }
      return true;
    },
    [loadPosts, loadedFromSupabase, user]
  );

  const deletePost = useCallback(async (postId: string) => {
    if (postId.startsWith('temp-')) {
      abortedTempIds.current.add(postId);
    }
    let previousPosts: Post[] = [];
    setPosts((prev) => {
      previousPosts = prev;
      return prev.filter((post) => post.id !== postId);
    });

    if (postId.startsWith('temp-')) {
      return;
    }

    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) {
      setPosts(previousPosts);
    }
  }, []);

  const togglePostLike = useCallback(
    async (post: Post) => {
      if (!user?.id) return;
      if (!post?.id || post.id.startsWith('temp-')) return;
      if (likeToggleInFlightRef.current.has(post.id)) return;

      const isCurrentlyLiked = Boolean(post.likedByCurrentUser);
      const nextLiked = !isCurrentlyLiked;
      const nextLikeCount = Math.max(0, (post.likes ?? 0) + (nextLiked ? 1 : -1));
      likeToggleInFlightRef.current.add(post.id);

      patchPostById(post.id, {
        likedByCurrentUser: nextLiked,
        likes: nextLikeCount,
      });
      try {
        const { data: serverLikeCount, error: postUpdateError } = await supabase.rpc('set_post_like', {
          p_post_id: post.id,
          p_user_id: user.id,
          p_like: nextLiked,
        });

        if (postUpdateError) {
          patchPostById(post.id, {
            likedByCurrentUser: isCurrentlyLiked,
            likes: post.likes ?? 0,
          });
          return;
        }

        patchPostById(post.id, {
          likedByCurrentUser: nextLiked,
          likes: typeof serverLikeCount === 'number' ? serverLikeCount : nextLikeCount,
        });

        // Keep like interactions resilient: notification side-effects should not
        // block the like action if they fail.
        try {
          if (nextLiked) {
            await addLikeNotification({
              postId: post.id,
              actorId: user.id,
              recipientId: post.user.id,
            });
          } else {
            await removeLikeNotification({
              postId: post.id,
              actorId: user.id,
              recipientId: post.user.id,
            });
          }
        } catch (notificationError) {
          if (__DEV__) {
            console.warn('[like notification]', notificationError);
          }
        }
      } finally {
        likeToggleInFlightRef.current.delete(post.id);
      }
    },
    [patchPostById, user?.id]
  );

  const clipsPosts = useMemo(
    () => posts.filter((post) => post.postType === 'clips' && post.type === 'video'),
    [posts]
  );

  const value = useMemo(
    () => ({
      posts,
      clipsPosts,
      feedInitialLoadComplete,
      reloadFeed: loadPosts,
      addPost,
      deletePost,
      togglePostLike,
      publishOptimisticMediaPost,
      retryFailedMediaPost,
    }),
    [
      posts,
      clipsPosts,
      feedInitialLoadComplete,
      loadPosts,
      addPost,
      deletePost,
      togglePostLike,
      publishOptimisticMediaPost,
      retryFailedMediaPost,
    ]
  );

  return <FeedPostsContext.Provider value={value}>{children}</FeedPostsContext.Provider>;
}

export function useFeedPosts() {
  const ctx = useContext(FeedPostsContext);
  if (ctx === undefined) throw new Error('useFeedPosts must be used within FeedPostsProvider');
  return ctx;
}
