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
import { Colors, primaryButtonGradient } from '@/constants/Colors';
import { Post } from '@/data/mock';
import { PostMedia } from '@/components/PostMedia';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
  Play,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Trash2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/context/AuthContext';
import { useFeedPosts } from '@/context/FeedPostsContext';
import { useRelativePostTime } from '@/hooks/useRelativePostTime';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';
import { captionWithoutMentionTokens, extractMentionUsernames } from '@/lib/parseCaptionMentions';

const TEXT_POST_BODY_FONT_SIZE = 13;
const TEXT_POST_BODY_MAX_WIDTH = Math.round(TEXT_POST_BODY_FONT_SIZE * 76 * 0.53);

interface FeedCardProps {
  post: Post;
  isVisible?: boolean;
  defaultMuted?: boolean;
}

export const FeedCard: React.FC<FeedCardProps> = ({ post, isVisible = true, defaultMuted = false }) => {
  const { user } = useAuth();
  const { deletePost } = useFeedPosts();
  const relativeTime = useRelativePostTime(post.createdAt, post.timeAgo);
  const locationLabel = post.location?.trim() ?? '';
  const mentionTags = useMemo(() => extractMentionUsernames(post.caption), [post.caption]);
  const captionBody = useMemo(() => captionWithoutMentionTokens(post.caption), [post.caption]);
  const isOwnPost = user?.id === post.user.id;
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);
  const [mediaWidth, setMediaWidth] = useState(0);
  const [isVideoMuted, setIsVideoMuted] = useState(defaultMuted);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuSlideAnim = useRef(new Animated.Value(260)).current;
  const menuBackdropAnim = useRef(new Animated.Value(0)).current;
  const bgStyle = useThemeBackgroundStyle();
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
  const showMediaUserOverlay = mediaItems.length > 0 && post.type !== 'poll';
  const hasMediaCaptionOverlay =
    showMediaUserOverlay && (captionBody.trim().length > 0 || mentionTags.length > 0);

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
        <View style={styles.headerOverlayStart}>
          {post.user.isVerified && !showMediaUserOverlay ? (
            <View style={styles.badgeContainer}>
              <LinearGradient
                colors={primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.verifiedBadge}
              >
                <Text style={styles.verifiedText}>✓ VERIFIED ATHLETE</Text>
              </LinearGradient>
            </View>
          ) : null}
        </View>
        <View style={styles.headerOverlayEnd}>
          {post.isLive ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>● LIVE</Text>
            </View>
          ) : null}
          {showMediaUserOverlay && isOwnPost ? (
            <TouchableOpacity
              style={styles.mediaOverlayMoreButton}
              onPress={openMenu}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open post options"
            >
              <BlurView intensity={24} style={styles.mediaOverlayMoreBlur}>
                <MoreHorizontal size={20} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {post.type === 'text' ? (
        <View style={styles.textPostContent}>
          <View style={styles.textPostBodyMeasure}>
            {captionBody.trim().length > 0 ? (
              <Text style={styles.textPostBody} numberOfLines={8}>
                {captionBody}
              </Text>
            ) : null}
            {mentionTags.length > 0 ? (
              <Text
                style={[styles.captionTagsLine, !captionBody.trim() && styles.captionTagsTightTop]}
                numberOfLines={3}
              >
                {mentionTags.map((u) => `@${u}`).join(' ')}
              </Text>
            ) : null}
          </View>
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
            {mentionTags.length > 0 ? (
              <Text
                style={[
                  styles.captionTagsLine,
                  styles.pollTagsLine,
                  !captionBody.trim() && styles.captionTagsTightTop,
                ]}
                numberOfLines={3}
              >
                {mentionTags.map((u) => `@${u}`).join(' ')}
              </Text>
            ) : null}
            {post.poll.choices.map((choice, idx) => (
              <View key={`${choice}-${idx}`} style={[styles.pollChoicePill, bgStyle]}>
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
            <View style={[styles.carouselDots, hasMediaCaptionOverlay && styles.carouselDotsAboveCaption]}>
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
          {showMediaUserOverlay ? (
            <View style={styles.mediaUserOverlay} pointerEvents="box-none">
              <Image source={{ uri: post.user.avatar }} style={styles.mediaOverlayAvatar} />
              <View style={styles.mediaOverlayTextCol}>
                <View style={styles.mediaOverlayUserLine}>
                  <Text style={styles.mediaOverlayUsername}>@{post.user.username}</Text>
                  {post.user.isVerified ? (
                    <View style={styles.mediaOverlayVerifiedBadge}>
                      <Text style={styles.mediaOverlayVerifiedCheck}>✓</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.mediaOverlayMeta} numberOfLines={1}>
                  <Text style={styles.postMetaSport}>{post.user.sport}</Text>
                  <Text style={styles.postMetaTime}> • {relativeTime}</Text>
                  {locationLabel ? (
                    <Text style={styles.postMetaTime}> • {locationLabel}</Text>
                  ) : null}
                </Text>
              </View>
            </View>
          ) : null}
          {hasMediaCaptionOverlay ? (
            <View style={styles.mediaCaptionOverlay} pointerEvents="none">
              {captionBody.trim().length > 0 ? (
                <Text style={styles.mediaOverlayCaption} numberOfLines={3}>
                  {captionBody}
                </Text>
              ) : null}
              {mentionTags.length > 0 ? (
                <Text
                  style={[styles.overlayTagsLine, !captionBody.trim() && styles.captionTagsTightTop]}
                  numberOfLines={2}
                >
                  {mentionTags.map((u) => `@${u}`).join(' ')}
                </Text>
              ) : null}
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
        {!(showMediaUserOverlay && isOwnPost) ? (
          <View style={styles.userInfoRow}>
            {!showMediaUserOverlay ? (
              <View style={styles.userLeft}>
                <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
                <View>
                  <Text style={styles.userName}>@{post.user.username}</Text>
                  <Text style={styles.userMeta} numberOfLines={1}>
                    <Text style={styles.postMetaSport}>{post.user.sport}</Text>
                    <Text style={styles.postMetaTime}> • {relativeTime}</Text>
                    {locationLabel ? (
                      <Text style={styles.postMetaTime}> • {locationLabel}</Text>
                    ) : null}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.userInfoRowSpacer} />
            )}
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
        ) : null}

        {post.type !== 'text' &&
        post.type !== 'poll' &&
        (captionBody.trim().length > 0 || mentionTags.length > 0) &&
        !hasMediaCaptionOverlay ? (
          <View style={styles.captionBlock}>
            {captionBody.trim().length > 0 ? <Text style={styles.caption}>{captionBody}</Text> : null}
            {mentionTags.length > 0 ? (
              <Text
                style={[styles.captionTagsLine, !captionBody.trim() && styles.captionTagsTightTop]}
                numberOfLines={3}
              >
                {mentionTags.map((u) => `@${u}`).join(' ')}
              </Text>
            ) : null}
          </View>
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
                <TouchableOpacity
                  style={styles.actionItem}
                  accessibilityRole="button"
                  accessibilityLabel="Repost"
                >
                  <Repeat2 size={24} color={Colors.textSecondary} />
                  <Text style={styles.actionText}>
                    {(post.reposts ?? 0) >= 1000
                      ? `${((post.reposts ?? 0) / 1000).toFixed(1)}k`
                      : String(post.reposts ?? 0)}
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
        <Animated.View style={[styles.menuSheet, bgStyle, { transform: [{ translateY: menuSlideAnim }] }]}>
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
    zIndex: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerOverlayStart: {
    flexShrink: 1,
    maxWidth: '62%',
  },
  headerOverlayEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  mediaOverlayMoreButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  mediaOverlayMoreBlur: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
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
    width: '100%',
    aspectRatio: 4 / 5,
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
    zIndex: 12,
  },
  carouselDotsAboveCaption: {
    bottom: 108,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textPostBodyMeasure: {
    width: '100%',
    maxWidth: TEXT_POST_BODY_MAX_WIDTH,
    alignSelf: 'center',
  },
  textPostBody: {
    color: Colors.text,
    fontSize: TEXT_POST_BODY_FONT_SIZE,
    lineHeight: 17,
    fontWeight: '400',
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
    zIndex: 15,
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
  mediaUserOverlay: {
    position: 'absolute',
    left: 16,
    right: 72,
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 9,
  },
  mediaOverlayAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'white',
  },
  mediaOverlayTextCol: {
    flex: 1,
    minWidth: 0,
  },
  mediaOverlayUserLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  mediaOverlayUsername: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    marginRight: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  mediaOverlayVerifiedBadge: {
    backgroundColor: Colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaOverlayVerifiedCheck: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  mediaOverlayMeta: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  /** Shared sport / create-time row (media overlay + footer) */
  postMetaSport: {
    fontSize: 12,
    fontWeight: '600',
  },
  postMetaTime: {
    fontSize: 12,
    fontWeight: '400',
  },
  mediaCaptionOverlay: {
    position: 'absolute',
    left: 16,
    right: 56,
    bottom: 18,
    zIndex: 9,
  },
  mediaOverlayCaption: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  userInfoRowSpacer: {
    flex: 1,
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
    lineHeight: 16,
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
  captionBlock: {
    marginBottom: 16,
  },
  caption: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  captionTagsLine: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  captionTagsTightTop: {
    marginTop: 0,
  },
  pollTagsLine: {
    marginTop: 6,
    marginBottom: 2,
  },
  overlayTagsLine: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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

