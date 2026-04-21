import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_POSTS, type Post, type PostPoll } from '@/data/mock';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Database } from '@/types/database';
import type { User } from '@/data/mock';
import { formatRelativePostTime } from '@/lib/formatRelativePostTime';

type FeedPostsContextType = {
  posts: Post[];
  clipsPosts: Post[];
  addPost: (post: Post) => Promise<boolean>;
  deletePost: (postId: string) => Promise<void>;
};

const FeedPostsContext = createContext<FeedPostsContextType | undefined>(undefined);

type PostRow = Database['public']['Tables']['posts']['Row'];

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
    likes: row.likes,
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
  };
}

export function FeedPostsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>(() => [...MOCK_POSTS]);
  const [loadedFromSupabase, setLoadedFromSupabase] = useState(false);
  const isFetchingRef = useRef(false);

  const loadPosts = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (error) {
        return;
      }
      const mapped = (data ?? []).map(mapRowToPost).filter((post): post is Post => post !== null);
      setPosts(mapped);
      setLoadedFromSupabase(true);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const channel = supabase
      .channel('public:posts:realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => {
          void loadPosts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  const addPost = useCallback(async (post: Post): Promise<boolean> => {
    setPosts((prev) => [post, ...prev]);
    if (!user) return true;

    const { error } = await supabase.from('posts').insert({
      id: post.id,
      user_id: user.id,
      caption: post.caption,
      content: post.content,
      assets: post.assets ?? null,
      type: post.type,
      post_type: post.postType ?? 'post',
      clips_source: post.clipsSource ?? null,
      poll: post.poll ?? null,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      is_live: Boolean(post.isLive),
      user_snapshot: post.user,
      location: post.location?.trim() ? post.location.trim() : null,
      ...(post.createdAt ? { created_at: post.createdAt } : {}),
    });

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
  }, [loadPosts, loadedFromSupabase, user]);

  const deletePost = useCallback(async (postId: string) => {
    let previousPosts: Post[] = [];
    setPosts((prev) => {
      previousPosts = prev;
      return prev.filter((post) => post.id !== postId);
    });

    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) {
      setPosts(previousPosts);
    }
  }, []);

  const clipsPosts = useMemo(
    () => posts.filter((post) => post.postType === 'clips' && post.type === 'video'),
    [posts]
  );

  const value = useMemo(
    () => ({ posts, clipsPosts, addPost, deletePost }),
    [posts, clipsPosts, addPost, deletePost]
  );

  return <FeedPostsContext.Provider value={value}>{children}</FeedPostsContext.Provider>;
}

export function useFeedPosts() {
  const ctx = useContext(FeedPostsContext);
  if (ctx === undefined) throw new Error('useFeedPosts must be used within FeedPostsProvider');
  return ctx;
}
