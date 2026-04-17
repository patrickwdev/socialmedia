import React, { useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Pressable,
  Alert,
  type LayoutChangeEvent,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Post } from '@/data/mock';
import { PostMedia } from '@/components/PostMedia';
import { Heart, MessageCircle, Share2, Bookmark, Play, Volume2, VolumeX, MoreHorizontal, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/context/AuthContext';
import { useFeedPosts } from '@/context/FeedPostsContext';
import { useRelativePostTime } from '@/hooks/useRelativePostTime';

interface FeedCardProps {
  post: Post;
  isVisible?: boolean;
}

export const FeedCard: React.FC<FeedCardProps> = ({ post, isVisible = true }) => {
  const { user } = useAuth();
  const { deletePost } = useFeedPosts();
  const relativeTime = useRelativePostTime(post.createdAt, post.timeAgo);
  const isOwnPost = user?.id === post.user.id;
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);
  const [mediaWidth, setMediaWidth] = useState(0);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuSlideAnim = useRef(new Animated.Value(260)).current;
  const menuBackdropAnim = useRef(new Animated.Value(0)).current;
  const mediaItems = useMemo(() => {
    if (post.type === 'text') return [];
    if (post.assets && post.assets.length > 0) return post.assets;
    if (post.type === 'poll') return [];
    if (!post.content) return [];
    return [{ uri: post.content, type: post.type === 'video' ? 'video' : 'image' }] as const;
  }, [post.assets, post.content, post.type]);
  const activeMediaType = mediaItems[activeAssetIndex]?.type;
  const isActiveVideoPlaying = activeMediaType === 'video' && isVisible;
  const hasImageMedia = mediaItems.some((asset) => asset.type === 'image');

  const onMediaLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== mediaWidth) {
      setMediaWidth(nextWidth);
    }
  };

  const openMenu = () => {
    setMenuVisible(true);
    Animated.parallel([
      Animated.timing(menuSlideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(menuBackdropAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuSlideAnim, {
        toValue: 260,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(menuBackdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setMenuVisible(false));
  };

  const handleDeletePost = () => {
    Alert.alert('Delete post?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          closeMenu();
          deletePost(post.id);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header Overlay */}
      <View style={styles.headerOverlay}>
        {post.user.isVerified && (
          <View style={styles.badgeContainer}>
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.verifiedBadge}
            >
              <Text style={styles.verifiedText}>✓ VERIFIED ATHLETE</Text>
            </LinearGradient>
          </View>
        )}
        {post.isLive && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>● LIVE</Text>
          </View>
        )}
      </View>

      {/* Content */}
      {post.type === 'text' ? (
        <View style={styles.textPostContent}>
          <Text style={styles.textPostBody} numberOfLines={8}>
            {post.caption}
          </Text>
        </View>
      ) : post.type === 'poll' && post.poll ? (
        <>
          {mediaItems.length > 0 ? (
            <View style={styles.contentContainer} onLayout={onMediaLayout}>
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
                  <PostMedia
                    key={asset.uri}
                    uri={asset.uri}
                    mediaType={asset.type}
                    style={[styles.media, mediaWidth > 0 ? { width: mediaWidth } : null]}
                    mode="feed"
                    shouldPlayOverride={
                      asset.type === 'video' ? isVisible && mediaItems[activeAssetIndex]?.uri === asset.uri : undefined
                    }
                    isMutedOverride={
                      asset.type === 'video'
                        ? isVideoMuted || mediaItems[activeAssetIndex]?.uri !== asset.uri
                        : undefined
                    }
                  />
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
              {!hasImageMedia && activeMediaType === 'video' && !isActiveVideoPlaying ? (
                <View style={styles.playButtonContainer}>
                  <BlurView intensity={20} style={styles.playButtonBlur}>
                    <Play fill="#fff" color="#fff" size={24} style={{ marginLeft: 4 }} />
                  </BlurView>
                </View>
              ) : null}
              {activeMediaType === 'video' ? (
                <TouchableOpacity
                  style={styles.muteToggleButton}
                  onPress={() => setIsVideoMuted((prev) => !prev)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isVideoMuted ? 'Unmute video' : 'Mute video'}
                >
                  <BlurView intensity={20} style={styles.muteToggleBlur}>
                    {isVideoMuted ? (
                      <VolumeX color="#fff" size={18} />
                    ) : (
                      <Volume2 color="#fff" size={18} />
                    )}
                  </BlurView>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          <View style={styles.pollBody}>
            <Text style={styles.pollBadge}>POLL</Text>
            <Text style={styles.pollQuestion}>{post.poll.question}</Text>
            {post.poll.choices.map((choice, idx) => (
              <View key={`${choice}-${idx}`} style={styles.pollChoicePill}>
                <Text style={styles.pollChoiceText}>{choice}</Text>
              </View>
            ))}
            <Text style={styles.pollMeta}>
              {post.poll.durationDays === 1 ? '1 day' : `${post.poll.durationDays} days`} · Tap an option to vote (coming soon)
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.contentContainer} onLayout={onMediaLayout}>
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
              <PostMedia
                key={asset.uri}
                uri={asset.uri}
                mediaType={asset.type}
                style={[styles.media, mediaWidth > 0 ? { width: mediaWidth } : null]}
                mode="feed"
                shouldPlayOverride={
                  asset.type === 'video' ? isVisible && mediaItems[activeAssetIndex]?.uri === asset.uri : undefined
                }
                isMutedOverride={
                  asset.type === 'video'
                    ? isVideoMuted || mediaItems[activeAssetIndex]?.uri !== asset.uri
                    : undefined
                }
              />
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
          {!hasImageMedia && activeMediaType === 'video' && !isActiveVideoPlaying ? (
            <View style={styles.playButtonContainer}>
              <BlurView intensity={20} style={styles.playButtonBlur}>
                <Play fill="#fff" color="#fff" size={24} style={{ marginLeft: 4 }} />
              </BlurView>
            </View>
          ) : null}
          {activeMediaType === 'video' ? (
            <TouchableOpacity
              style={styles.muteToggleButton}
              onPress={() => setIsVideoMuted((prev) => !prev)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isVideoMuted ? 'Unmute video' : 'Mute video'}
            >
              <BlurView intensity={20} style={styles.muteToggleBlur}>
                {isVideoMuted ? (
                  <VolumeX color="#fff" size={18} />
                ) : (
                  <Volume2 color="#fff" size={18} />
                )}
              </BlurView>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      {post.type === 'text' || post.type === 'poll' ? <View style={styles.textPostSeparator} /> : null}
      
      {/* Footer Info */}
      <View style={[styles.footer, (post.type === 'text' || post.type === 'poll') && styles.textPostFooterCompact]}>
        <View style={styles.userInfoRow}>
            <View style={styles.userLeft}>
                <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
                <View>
                    <Text style={styles.userName}>{post.user.name}</Text>
                    <Text style={styles.userMeta}>{post.user.sport} • {relativeTime}</Text>
                </View>
            </View>
            {isOwnPost ? (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={openMenu}
                accessibilityRole="button"
                accessibilityLabel="Open post options"
              >
                <MoreHorizontal size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.followButton}>
                <Text style={styles.followButtonText}>Follow</Text>
              </TouchableOpacity>
            )}
        </View>

        {post.type !== 'text' && post.type !== 'poll' && post.caption.trim().length > 0 ? (
          <Text style={styles.caption}>{post.caption}</Text>
        ) : null}

        {/* Action Bar */}
        <View style={styles.actionBar}>
            <View style={styles.actionLeft}>
                <TouchableOpacity style={styles.actionItem}>
                    <Heart size={24} color={Colors.textSecondary} />
                    <Text style={styles.actionText}>
                      {post.likes >= 1000 ? `${(post.likes / 1000).toFixed(1)}k` : String(post.likes)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem}>
                    <MessageCircle size={24} color={Colors.textSecondary} />
                    <Text style={styles.actionText}>
                      {post.comments >= 1000
                        ? `${(post.comments / 1000).toFixed(1)}k`
                        : String(post.comments)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem}>
                    <Share2 size={24} color={Colors.textSecondary} />
                    <Text style={styles.actionText}>{post.shares}</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity>
                <Bookmark size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
        </View>
      </View>
      <Modal visible={menuVisible} transparent animationType="none" onRequestClose={closeMenu}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu}>
          <Animated.View style={[styles.menuBackdrop, { opacity: menuBackdropAnim }]} />
        </Pressable>
        <Animated.View style={[styles.menuSheet, { transform: [{ translateY: menuSlideAnim }] }]}>
          <View style={styles.menuGrabber} />
          <TouchableOpacity
            style={styles.menuDeleteButton}
            onPress={handleDeletePost}
            accessibilityRole="button"
            accessibilityLabel="Delete post"
          >
            <Trash2 size={18} color="#EF4444" />
            <Text style={styles.menuDeleteText}>Delete post</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuCancelButton} onPress={closeMenu}>
            <Text style={styles.menuCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeContainer: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  verifiedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  verifiedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
  },
  contentContainer: {
    height: 400,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  mediaPager: {
    width: '100%',
    height: '100%',
  },
  carouselDots: {
    position: 'absolute',
    bottom: 12,
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
  textPostContent: {
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.card,
    justifyContent: 'center',
  },
  textPostBody: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  textPostSeparator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  textPostFooterCompact: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  pollBody: {
    minHeight: 220,
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: Colors.card,
    justifyContent: 'center',
  },
  pollBadge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.primary,
    marginBottom: 10,
  },
  pollQuestion: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 14,
  },
  pollChoicePill: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: Colors.background,
  },
  pollChoiceText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  pollMeta: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  playButtonContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonBlur: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  muteToggleButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
  },
  muteToggleBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  footer: {
    padding: 16,
  },
  userInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  userName: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  userMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  followButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionLeft: {
    flexDirection: 'row',
    gap: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
  },
  menuGrabber: {
    width: 42,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 14,
  },
  menuDeleteButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  menuDeleteText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  menuCancelButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCancelText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
