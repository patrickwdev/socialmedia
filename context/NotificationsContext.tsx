import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Database, Json } from '@/types/database';

export type AppNotificationItem = {
  id: string;
  postId: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  createdAt: string;
  /** First image/video URL for like-notification preview; null if post has no displayable media. */
  postMediaUri: string | null;
  postMediaKind: 'image' | 'video' | null;
};

type NotificationsContextType = {
  notifications: AppNotificationItem[];
  unreadCount: number;
  markNotificationRead: (id: string, postId?: string) => void;
  deleteNotification: (id: string) => void;
  reloadNotifications: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

/** Importing `expo-notifications` on Expo Go + Android throws (SDK 53+). Never load that module there. */
function canLoadExpoNotifications(): boolean {
  if (Platform.OS === 'web') return false;
  if (isRunningInExpoGo() && Platform.OS === 'android') return false;
  return true;
}

async function ensurePushPermission() {
  if (!canLoadExpoNotifications()) return;
  const Notifications = await import('expo-notifications');
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return;
  await Notifications.requestPermissionsAsync();
}

async function registerPushTokenForCurrentUser(userId: string) {
  if (!canLoadExpoNotifications()) return;
  const Notifications = await import('expo-notifications');
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') return;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
    ?? undefined;
  if (!projectId) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data;
  if (!expoPushToken) return;

  await supabase.from('user_push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: Platform.OS,
    },
    { onConflict: 'user_id,expo_push_token' }
  );
}

type NotificationRow = {
  id: string;
  post_id: string;
  actor_ids: string[];
  count: number;
  read: boolean;
  created_at: string;
  updated_at: string;
};

type PostPreviewRow = Pick<Database['public']['Tables']['posts']['Row'], 'id' | 'type' | 'content' | 'assets'>;

type PostMediaPreview = { uri: string; mediaKind: 'image' | 'video' };

function parsePostAssets(assets: Json | null): { uri: string; type: 'video' | 'image' }[] {
  if (!Array.isArray(assets)) return [];
  const out: { uri: string; type: 'video' | 'image' }[] = [];
  for (const item of assets) {
    if (
      item &&
      typeof item === 'object' &&
      'uri' in item &&
      'type' in item &&
      (item.type === 'video' || item.type === 'image') &&
      typeof item.uri === 'string' &&
      item.uri.length > 0
    ) {
      out.push({ uri: item.uri, type: item.type });
    }
  }
  return out;
}

function getPostLikeMediaPreview(row: PostPreviewRow): PostMediaPreview | null {
  if (row.type === 'text') return null;
  const assets = parsePostAssets(row.assets);
  const firstImage = assets.find((a) => a.type === 'image');
  if (firstImage) return { uri: firstImage.uri, mediaKind: 'image' };
  const firstVideo = assets.find((a) => a.type === 'video');
  if (firstVideo) return { uri: firstVideo.uri, mediaKind: 'video' };
  const content = typeof row.content === 'string' ? row.content.trim() : '';
  if (!content) return null;
  if (row.type === 'image') return { uri: content, mediaKind: 'image' };
  if (row.type === 'video') return { uri: content, mediaKind: 'video' };
  if (row.type === 'poll') return null;
  return null;
}

async function fetchPostMediaPreviewsByPostIds(postIds: string[]): Promise<Map<string, PostMediaPreview>> {
  const map = new Map<string, PostMediaPreview>();
  const unique = [...new Set(postIds)].filter((id) => typeof id === 'string' && id.length > 0);
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data } = await supabase.from('posts').select('id,type,content,assets').in('id', chunk);
    for (const row of (data ?? []) as PostPreviewRow[]) {
      const preview = getPostLikeMediaPreview(row);
      if (preview) map.set(row.id, preview);
    }
  }
  return map;
}

function formatRelativeNotificationTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

async function mapNotificationRowsToItems(
  rows: NotificationRow[],
  previewByPostId: Map<string, PostMediaPreview>
): Promise<AppNotificationItem[]> {
  const actorIdSet = new Set<string>();
  for (const row of rows) {
    for (const actorId of row.actor_ids ?? []) {
      if (actorId) actorIdSet.add(actorId);
    }
  }

  const actorIds = Array.from(actorIdSet);
  const usernameById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id,username')
      .in('id', actorIds);

    for (const profile of data ?? []) {
      if (profile?.id && typeof profile.username === 'string') {
        usernameById.set(profile.id, profile.username);
      }
    }
  }

  return rows.map((row) => {
    const latestActorId = row.actor_ids?.[row.actor_ids.length - 1];
    const latestActorUsername = latestActorId ? usernameById.get(latestActorId) : undefined;
    const actorLabel = latestActorUsername ? `@${latestActorUsername}` : 'Someone';
    const extraCount = Math.max(0, (row.count ?? 0) - 1);
    const body =
      extraCount > 0
        ? `${actorLabel} and ${extraCount} other${extraCount === 1 ? '' : 's'} liked your post`
        : `${actorLabel} liked your post`;

    const preview = previewByPostId.get(row.post_id);
    return {
      id: row.id,
      postId: row.post_id,
      title: 'New like',
      body,
      time: formatRelativeNotificationTime(row.updated_at ?? row.created_at),
      unread: !row.read,
      createdAt: row.created_at,
      postMediaUri: preview?.uri ?? null,
      postMediaKind: preview?.mediaKind ?? null,
    };
  });
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const locallyReadIdsRef = useRef(new Set<string>());
  const loadSeqRef = useRef(0);

  useEffect(() => {
    if (!canLoadExpoNotifications()) return;
    let cancelled = false;
    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } catch {
        // Missing native module, etc.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void ensurePushPermission();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void registerPushTokenForCurrentUser(user.id);
  }, [user?.id]);

  const markNotificationRead = useCallback((id: string, _postId?: string) => {
    locallyReadIdsRef.current.add(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    void (async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) {
        locallyReadIdsRef.current.delete(id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: true } : n)));
      }
    })();
  }, []);

  const deleteNotification = useCallback((id: string) => {
    const previousNotificationsRef: { value: AppNotificationItem[] } = { value: [] };
    setNotifications((prev) => {
      previousNotificationsRef.value = prev;
      const exists = prev.some((n) => n.id === id);
      if (!exists) return prev;
      return prev.filter((n) => n.id !== id);
    });
    locallyReadIdsRef.current.delete(id);
    void (async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ hidden: true })
        .eq('id', id);
      if (error) {
        setNotifications(previousNotificationsRef.value);
      }
    })();
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const seq = ++loadSeqRef.current;
    const { data, error } = await supabase
      .from('notifications')
      .select('id,post_id,actor_ids,count,read,created_at,updated_at')
      .eq('recipient_id', user.id)
      .eq('type', 'like')
      .eq('hidden', false)
      .order('updated_at', { ascending: false });

    if (error || seq !== loadSeqRef.current) return;
    const rows = (data ?? []) as NotificationRow[];
    const postIds = rows.map((r) => r.post_id);
    const previewByPostId = await fetchPostMediaPreviewsByPostIds(postIds);
    if (seq !== loadSeqRef.current) return;
    const items = await mapNotificationRowsToItems(rows, previewByPostId);
    if (seq !== loadSeqRef.current) return;
    const next = items.map((item) =>
      locallyReadIdsRef.current.has(item.id) ? { ...item, unread: false } : item
    );
    for (const item of next) {
      if (!item.unread) {
        locallyReadIdsRef.current.delete(item.id);
      }
    }
    setNotifications(next);
  }, [user?.id]);

  const reloadNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id) {
      locallyReadIdsRef.current.clear();
      setNotifications([]);
      return;
    }

    void loadNotifications();

    const channel = supabase
      .channel(`public:notifications:recipient:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, user?.id]);

  const unreadCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markNotificationRead,
      deleteNotification,
      reloadNotifications,
    }),
    [deleteNotification, markNotificationRead, notifications, reloadNotifications, unreadCount]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useAppNotifications() {
  const ctx = useContext(NotificationsContext);
  if (ctx === undefined) throw new Error('useAppNotifications must be used within NotificationsProvider');
  return ctx;
}
