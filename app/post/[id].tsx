import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Heart, MessageCircle, Share2, ArrowLeft, Radio, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useFeedPosts } from '@/context/FeedPostsContext';
import { PostMedia } from '@/components/PostMedia';
import type { Post } from '@/data/mock';
import { faker } from '@faker-js/faker';
import { useRelativePostTime } from '@/hooks/useRelativePostTime';

type CommentItem = {
  id: string;
  userName: string;
  userAvatar: string;
  body: string;
  timeAgo: string;
};

function formatCount(n: number) {
  if (n < 1000) return `${n}`;
  const k = n / 1000;
  return `${k.toFixed(k >= 10 ? 0 : 1)}k`;
}

export default function PostDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { posts } = useFeedPosts();

  const { height: WINDOW_HEIGHT } = Dimensions.get('window');
  const PANEL_HEIGHT = WINDOW_HEIGHT * 0.75;
  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);

  const commentsClose = () => {
    Animated.timing(slideAnim, {
      toValue: PANEL_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setCommentsVisible(false));
  };

  const commentsOpen = () => {
    setCommentsVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const post = useMemo<Post | undefined>(() => {
    const id = params.id;
    if (!id) return undefined;
    return posts.find((p) => p.id === id);
  }, [params.id, posts]);

  const postRelativeTime = useRelativePostTime(post?.createdAt, post?.timeAgo ?? '');

  const comments = useMemo<CommentItem[]>(() => {
    if (!post) return [];
    // Keep it simple: show a reasonable number of mock comments.
    const count = Math.max(3, Math.min(12, Math.round(post.comments / 150)));
    return Array.from({ length: count }).map((_, i) => ({
      id: `${post.id}-c${i}`,
      userName: faker.person.fullName(),
      userAvatar: faker.image.avatar(),
      body: faker.lorem.sentence(),
      timeAgo: faker.helpers.arrayElement(['Just now', '2m', '1h', 'Yesterday', '3d']),
    }));
  }, [post]);

  const mediaItems = useMemo(() => {
    if (!post) return [];
    if (post.type === 'text') return [];
    if (post.assets && post.assets.length > 0) return post.assets;
    if (post.type === 'poll') return [];
    if (!post.content) return [];
    return [{ uri: post.content, type: post.type === 'video' ? 'video' : 'image' }] as const;
  }, [post]);

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
            <ArrowLeft size={22} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={styles.headerRightSpacer} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <ArrowLeft size={22} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mediaWrap}>
          {post.type === 'text' ? (
            <View style={styles.textOnlyWrap}>
              <Text style={styles.textOnlyBody}>{post.caption}</Text>
            </View>
          ) : post.type === 'poll' && post.poll ? (
            <>
              {mediaItems.length > 0 ? (
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    style={styles.mediaPager}
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => {
                      const pageWidth = event.nativeEvent.layoutMeasurement.width;
                      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                      setActiveAssetIndex(nextIndex);
                    }}
                  >
                    {mediaItems.map((asset) => (
                      <PostMedia key={asset.uri} uri={asset.uri} mediaType={asset.type} style={styles.media} mode="detail" />
                    ))}
                  </ScrollView>
                  {mediaItems.length > 1 ? (
                    <View style={styles.carouselDots}>
                      {mediaItems.map((asset, idx) => (
                        <View
                          key={`${asset.uri}-${idx}`}
                          style={[styles.carouselDot, idx === activeAssetIndex && styles.carouselDotActive]}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}
              <View style={styles.pollDetailWrap}>
                <Text style={styles.pollDetailBadge}>POLL</Text>
                <Text style={styles.pollDetailQuestion}>{post.poll.question}</Text>
                {post.poll.choices.map((choice, idx) => (
                  <View key={`${choice}-${idx}`} style={styles.pollDetailChoice}>
                    <Text style={styles.pollDetailChoiceText}>{choice}</Text>
                  </View>
                ))}
                <Text style={styles.pollDetailMeta}>
                  {post.poll.durationDays === 1 ? 'Runs for 1 day' : `Runs for ${post.poll.durationDays} days`}
                </Text>
              </View>
            </>
          ) : (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                style={styles.mediaPager}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const pageWidth = event.nativeEvent.layoutMeasurement.width;
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                  setActiveAssetIndex(nextIndex);
                }}
              >
                {mediaItems.map((asset) => (
                  <PostMedia key={asset.uri} uri={asset.uri} mediaType={asset.type} style={styles.media} mode="detail" />
                ))}
              </ScrollView>
              {mediaItems.length > 1 ? (
                <View style={styles.carouselDots}>
                  {mediaItems.map((asset, idx) => (
                    <View
                      key={`${asset.uri}-${idx}`}
                      style={[styles.carouselDot, idx === activeAssetIndex && styles.carouselDotActive]}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
          {post.isLive && (
            <View style={styles.liveBadge}>
              <Radio size={14} color="white" fill="white" />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.userRow}>
          <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
          <View style={styles.userText}>
            <Text style={styles.username}>@{post.user.username}</Text>
            <Text style={styles.userMeta}>{post.user.sport}</Text>
          </View>
        </View>

        {post.type !== 'text' && post.type !== 'poll' && post.caption.trim().length > 0 ? (
          <Text style={styles.caption}>{post.caption}</Text>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Heart size={18} color="white" />
            <Text style={styles.statText}>{formatCount(post.likes)}</Text>
          </View>
          <TouchableOpacity style={styles.statItem} onPress={commentsOpen} activeOpacity={0.85}>
            <MessageCircle size={18} color="white" />
            <Text style={styles.statText}>{formatCount(post.comments)}</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Share2 size={18} color="white" />
            <Text style={styles.statText}>{formatCount(post.shares)}</Text>
          </View>
        </View>

        <Text style={styles.timeAgo}>{postRelativeTime}</Text>
      </ScrollView>

      <Modal visible={commentsVisible} transparent animationType="none" onRequestClose={commentsClose}>
        <Pressable style={StyleSheet.absoluteFill} onPress={commentsClose}>
          <View style={styles.backdrop} />
        </Pressable>

        <Animated.View style={[styles.commentsPanel, { height: PANEL_HEIGHT, transform: [{ translateY: slideAnim }] }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.commentsHeader}>
              <View style={styles.grabber} />
              <View style={styles.commentsHeaderRow}>
                <Text style={styles.commentsTitle}>Comments</Text>
                <TouchableOpacity onPress={commentsClose} style={styles.closeBtn} accessibilityRole="button">
                  <X size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <Image source={{ uri: item.userAvatar }} style={styles.commentAvatar} />
                  <View style={styles.commentBodyWrap}>
                    <View style={styles.commentTopRow}>
                      <Text style={styles.commentUser}>{item.userName}</Text>
                      <Text style={styles.commentTime}>{item.timeAgo}</Text>
                    </View>
                    <Text style={styles.commentText}>{item.body}</Text>
                  </View>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.commentSeparator} />}
              contentContainerStyle={styles.commentsListContent}
              ListEmptyComponent={
                <View style={styles.commentsEmpty}>
                  <Text style={styles.commentsEmptyTitle}>No comments yet</Text>
                </View>
              }
            />
          </SafeAreaView>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  headerRightSpacer: {
    width: 40,
    height: 40,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  mediaWrap: {
    width: '100%',
    backgroundColor: Colors.card,
    position: 'relative',
  },
  media: {
    width: '100%',
    height: 360,
  },
  mediaPager: {
    width: '100%',
    height: 360,
  },
  carouselDots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  carouselDotActive: {
    width: 14,
    backgroundColor: 'white',
  },
  textOnlyWrap: {
    minHeight: 260,
    paddingHorizontal: 18,
    paddingVertical: 22,
    justifyContent: 'center',
  },
  textOnlyBody: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  pollDetailWrap: {
    minHeight: 320,
    paddingHorizontal: 18,
    paddingVertical: 22,
    justifyContent: 'center',
  },
  pollDetailBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.primary,
    marginBottom: 12,
  },
  pollDetailQuestion: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: 16,
  },
  pollDetailChoice: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: Colors.background,
  },
  pollDetailChoiceText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  pollDetailMeta: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.card,
  },
  userText: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    color: Colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  userMeta: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
    marginTop: 2,
  },
  caption: {
    paddingHorizontal: 16,
    paddingTop: 12,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statText: {
    color: Colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  timeAgo: {
    paddingHorizontal: 16,
    paddingTop: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontWeight: '800',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
  },
  commentsPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  commentsHeader: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  grabber: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentsTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
  },
  commentBodyWrap: {
    flex: 1,
    minWidth: 0,
  },
  commentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  commentUser: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  commentTime: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  commentText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 18,
  },
  commentSeparator: {
    height: 1,
    backgroundColor: Colors.border,
  },
  commentsEmpty: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  commentsEmptyTitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
});

