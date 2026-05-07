import React, { useRef, useMemo, useState, useEffect } from 'react';
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
  ActivityIndicator,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
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
import { useThemeBackgroundStyle, useThemedStylesheet } from '@/context/ThemeContext';
import { captionWithoutMentionTokens, extractMentionUsernames } from '@/lib/parseCaptionMentions';
import { CommentList } from '@/components/CommentList';
import { useRouter } from 'expo-router';
import { openUserProfile, viewerFanNavHint, viewerFollowNavHint } from '@/lib/openUserProfile';
import { useViewerFollows } from '@/context/ViewerFollowsContext';

const TEXT_POST_BODY_FONT_SIZE = 13;
const TEXT_POST_BODY_MAX_WIDTH = Math.round(TEXT_POST_BODY_FONT_SIZE * 76 * 0.53);

interface FeedCardProps {
  post: Post;
  isVisible?: boolean;
  defaultMuted?: boolean;
}

const META_SEP = ' · ';

type PostMetaSublineProps = {
  sport?: string;
  time: string;
  location: string;
  containerStyle: StyleProp<TextStyle>;
  sportEmphasisStyle: StyleProp<TextStyle>;
  secondaryStyle: StyleProp<TextStyle>;
};

function getProfileSubtitle(user: Post['user']): string | null {
  const raw = user as unknown as Record<string, unknown>;
  const role = typeof raw.role === 'string' ? raw.role.trim().toLowerCase() : '';
  const professionRaw = typeof raw.profession === 'string' ? raw.profession.trim() : '';
  const school = typeof raw.school === 'string' ? raw.school.trim() : '';
  const team = user.team?.trim() ?? '';
  const fallbackProfession =
    role === 'coach' ? 'Coach' : role === 'scout' ? 'Scout' : user.isAthlete ? user.sport.trim() || 'Athlete' : '';
  const profession = professionRaw || fallbackProfession;
  const org = team || school;
  if (!profession && !org) return null;
  if (!profession) return org;
  if (!org) return profession;
  return `${profession} · ${org}`;
}

/** Sport, time, and location on one line with a consistent middle dot. */
function PostMetaSubline({
  sport,
  time,
  location,
  containerStyle,
  sportEmphasisStyle,
  secondaryStyle,
}: PostMetaSublineProps) {
  const s = sport?.trim() ?? '';
  const t = time.trim();
  const l = location.trim();
  if (!s && !t && !l) return null;
  return (
    <Text style={containerStyle} numberOfLines={1}>
      {s ? <Text style={sportEmphasisStyle}>{s}</Text> : null}
      {s && (t || l) ? <Text style={secondaryStyle}>{META_SEP}</Text> : null}
      {t ? <Text style={secondaryStyle}>{t}</Text> : null}
      {t && l ? <Text style={secondaryStyle}>{META_SEP}</Text> : null}
      {l ? <Text style={secondaryStyle}>{l}</Text> : null}
    </Text>
  );
}

export const FeedCard: React.FC<FeedCardProps> = ({ post, isVisible = true, defaultMuted = false }) => {
  const { user } = useAuth();
  const router = useRouter();
  const { deletePost, retryFailedMediaPost, togglePostLike } = useFeedPosts();
  const { isViewerFollowingUser, isViewerFanningUser } = useViewerFollows();
  const relativeTime = useRelativePostTime(post.createdAt, post.timeAgo ?? '', true);
  const locationLabel = post.location?.trim() ?? '';
  const mentionTags = useMemo(() => extractMentionUsernames(post.caption), [post.caption]);
  const captionBody = useMemo(() => captionWithoutMentionTokens(post.caption), [post.caption]);
  const profileSubtitle = useMemo(() => getProfileSubtitle(post.user), [post.user]);
  const postUserRole = useMemo(() => {
    const rawUser = post.user as unknown as Record<string, unknown>;
    const roleValue = rawUser.role;
    return typeof roleValue === 'string' ? roleValue.trim().toLowerCase() : '';
  }, [post.user]);
  const isOwnPost = user?.id === post.user.id;
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);
  const [mediaWidth, setMediaWidth] = useState(0);
  const [isVideoMuted, setIsVideoMuted] = useState(defaultMuted);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [optimisticCommentDelta, setOptimisticCommentDelta] = useState(0);
  const [liveCommentCount, setLiveCommentCount] = useState(post.comments ?? 0);
  const [menuVisible, setMenuVisible] = useState(false);
  const commentsSlideAnim = useRef(new Animated.Value(640)).current;
  const commentsBackdropAnim = useRef(new Animated.Value(0)).current;
  const menuSlideAnim = useRef(new Animated.Value(260)).current;
  const menuBackdropAnim = useRef(new Animated.Value(0)).current;
  const bgStyle = useThemeBackgroundStyle();
  const styles = useThemedStylesheet(() => ({
    container: {
      backgroundColor: Colors.card,
      borderRadius: 0,
      marginBottom: 0,
      overflow: 'hidden',
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
      padding: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    /** Own-post ⋯ on text/poll (readable on `Colors.card` body). */
    headerOwnMoreButton: {
      padding: 8,
      alignItems: 'center',
      justifyContent: 'center',
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
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      backgroundColor: Colors.card,
      alignItems: 'stretch',
    },
    textPostUserRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      width: '100%',
      marginBottom: 10,
    },
    textPostCornerAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    textPostUserTextCol: {
      flex: 1,
      minWidth: 0,
    },
    textPostUserLine: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
      flexWrap: 'wrap',
    },
    textPostUsername: {
      color: Colors.text,
      fontWeight: '700',
      fontSize: 16,
      marginRight: 6,
    },
    textPostInlineVerifiedBadge: {
      backgroundColor: Colors.primary,
      width: 14,
      height: 14,
      borderRadius: 7,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textPostInlineVerifiedCheck: {
      color: 'white',
      fontSize: 8,
      fontWeight: 'bold',
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
    },
    /** Text-only: sits above like/comment/share; bleeds past footer padding to card edges. */
    textPostActionsDivider: {
      height: 1,
      backgroundColor: Colors.border,
      alignSelf: 'stretch',
      marginHorizontal: -16,
      marginTop: 4,
      marginBottom: 4,
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
    /** Poll without media: sits under `textPostContent` (horizontal padding from parent). */
    pollBodyNoMedia: {
      paddingTop: 2,
      paddingBottom: 10,
      minHeight: 0,
      justifyContent: 'flex-start',
      backgroundColor: Colors.card,
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
      lineHeight: 16,
    },
    pollMetaEmphasis: {
      fontWeight: '600',
    },
    pollMetaSecondary: {
      fontWeight: '400',
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
      padding: 8,
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
    mediaOverlaySubtitle: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
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
    profileSubtitle: {
      color: Colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      marginBottom: 1,
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
    commentsSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '78%',
      backgroundColor: Colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
    },
    commentsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    commentsGrabber: {
      width: 42,
      height: 5,
      borderRadius: 999,
      alignSelf: 'center',
      backgroundColor: 'rgba(255,255,255,0.25)',
      marginTop: 10,
      marginBottom: 8,
    },
    commentsHeaderTitle: {
      color: Colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    commentsHeaderLeftSpacer: {
      width: 44,
    },
    commentsHeaderRightSpacer: {
      width: 44,
    },
    commentsBody: {
      flex: 1,
    },
    pendingCard: {
      backgroundColor: Colors.card,
      borderRadius: 20,
      marginBottom: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    pendingThumb: {
      width: 58,
      height: 58,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: Colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingBody: {
      flex: 1,
      gap: 8,
    },
    pendingTitle: {
      color: Colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    pendingSubtitle: {
      color: Colors.textSecondary,
      fontSize: 12,
      marginTop: -4,
    },
    pendingProgressTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      overflow: 'hidden',
    },
    pendingProgressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: Colors.primary,
    },
    pendingRetryButton: {
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: Colors.primary,
    },
    pendingRetryText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
  }));
  const mediaItems = useMemo(() => {
    if (post.type === 'text') return [];
    if (post.assets && post.assets.length > 0) return post.assets;
    if (!post.content) return [];
    const mediaType = post.type === 'video' ? 'video' : 'image';
    return [{ uri: post.content, type: mediaType }] as const;
  }, [post.assets, post.content, post.type]);
  const activeMediaType = mediaItems[activeAssetIndex]?.type;
  const isActiveVideoPlaying = activeMediaType === 'video' && isVisible;
  const hasImageMedia = mediaItems.some((asset) => asset.type === 'image');
  const showMediaUserOverlay = mediaItems.length > 0;
  const hasMediaCaptionOverlay =
    showMediaUserOverlay &&
    post.type !== 'poll' &&
    (captionBody.trim().length > 0 || mentionTags.length > 0);

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

  const openCommentsPanel = () => {
    setIsCommentsOpen(true);
    Animated.parallel([
      Animated.timing(commentsSlideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(commentsBackdropAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeCommentsPanel = () => {
    Animated.parallel([
      Animated.timing(commentsSlideAnim, {
        toValue: 640,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(commentsBackdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setIsCommentsOpen(false));
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

  const handleAvatarPress = () => {
    openUserProfile(router, user?.id, {
      userId: post.user.id,
      username: post.user.username,
      avatar: post.user.avatar,
      displayName: post.user.name,
      banner: post.user.banner,
      followers: post.user.followers,
      following: post.user.following,
      role: postUserRole,
      ...viewerFollowNavHint(user?.id, post.user.id, isViewerFollowingUser),
      ...viewerFanNavHint(user?.id, post.user.id, isViewerFanningUser),
    });
  };

  const renderPollCardBody = () => {
    if (!post.poll) return null;
    return (
      <>
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
        <Text style={styles.pollMeta} numberOfLines={2}>
          <Text style={styles.pollMetaEmphasis}>
            {post.poll.durationDays === 1 ? '1 day' : `${post.poll.durationDays} days`}
          </Text>
          <Text style={styles.pollMetaSecondary}>
            {META_SEP}Tap an option to vote (coming soon)
          </Text>
        </Text>
      </>
    );
  };

  const pollHasNoMedia = post.type === 'poll' && mediaItems.length === 0;

  const uploadStatus = post.uploadStatus;
  const uploadInteractionLocked =
    uploadStatus === 'uploading' || uploadStatus === 'processing' || uploadStatus === 'failed';
  const uploadPendingVisual = uploadStatus === 'uploading' || uploadStatus === 'processing';

  const uploadStatusTitle =
    uploadStatus === 'failed'
      ? "Couldn't post"
      : uploadStatus === 'processing'
        ? 'Processing video…'
        : uploadStatus
          ? post.type === 'poll'
            ? 'Posting poll…'
            : 'Posting…'
          : '';
  const isPendingPostCard = post.id.startsWith('temp-') && uploadInteractionLocked;
  useEffect(() => {
    setLiveCommentCount(post.comments ?? 0);
  }, [post.comments, post.id]);

  const displayedCommentCount = Math.max(0, liveCommentCount + optimisticCommentDelta);

  if (isPendingPostCard) {
    const pendingAsset = mediaItems[0];
    return (
      <View style={styles.pendingCard}>
        <View style={styles.pendingThumb}>
          {pendingAsset ? (
            <PostMedia
              uri={pendingAsset.uri}
              mediaType={pendingAsset.type}
              style={{ width: '100%', height: '100%' }}
              mode="feed"
              shouldPlayOverride={false}
              isMutedOverride
            />
          ) : null}
        </View>
        <View style={styles.pendingBody}>
          <Text style={styles.pendingTitle}>{uploadStatusTitle || 'Posting…'}</Text>
          {uploadPendingVisual ? (
            <Text style={styles.pendingSubtitle}>
              {typeof post.uploadProgress === 'number'
                ? `${Math.min(100, Math.max(0, post.uploadProgress))}% uploaded`
                : 'Uploading media...'}
            </Text>
          ) : (
            <Text style={styles.pendingSubtitle}>Upload failed. Retry to continue.</Text>
          )}
          {uploadPendingVisual ? (
            <View style={styles.pendingProgressTrack}>
              <View
                style={[
                  styles.pendingProgressFill,
                  { width: `${Math.min(100, Math.max(0, post.uploadProgress ?? 0))}%` },
                ]}
              />
            </View>
          ) : null}
          {uploadStatus === 'failed' ? (
            <TouchableOpacity
              style={styles.pendingRetryButton}
              onPress={() => retryFailedMediaPost(post)}
              accessibilityRole="button"
              accessibilityLabel="Retry upload"
            >
              <Text style={styles.pendingRetryText}>Retry</Text>
            </TouchableOpacity>
          ) : (
            <ActivityIndicator size="small" color={Colors.primary} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Overlay */}
      <View style={styles.headerOverlay}>
        <View style={styles.headerOverlayStart}>
          {post.user.isVerified &&
          !showMediaUserOverlay &&
          post.type !== 'text' &&
          !pollHasNoMedia ? (
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
          {isOwnPost ? (
            <TouchableOpacity
              style={showMediaUserOverlay ? styles.mediaOverlayMoreButton : styles.headerOwnMoreButton}
              onPress={openMenu}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open post options"
            >
              {showMediaUserOverlay ? (
                <MoreHorizontal size={20} color="#fff" />
              ) : (
                <MoreHorizontal size={20} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {post.type === 'text' ? (
        <View style={styles.textPostContent}>
          <View style={styles.textPostUserRow}>
            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Open @${post.user.username} profile`}>
              <Image source={{ uri: post.user.avatar }} style={styles.textPostCornerAvatar} />
            </TouchableOpacity>
            <View style={styles.textPostUserTextCol}>
              <View style={styles.textPostUserLine}>
                <TouchableOpacity
                  onPress={handleAvatarPress}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Open @${post.user.username} profile`}
                >
                  <Text style={styles.textPostUsername}>@{post.user.username}</Text>
                </TouchableOpacity>
                {post.user.isVerified ? (
                  <View style={styles.textPostInlineVerifiedBadge}>
                    <Text style={styles.textPostInlineVerifiedCheck}>✓</Text>
                  </View>
                ) : null}
              </View>
              {profileSubtitle ? <Text style={styles.profileSubtitle}>{profileSubtitle}</Text> : null}
              <PostMetaSubline
                sport={post.user.sport}
                time={relativeTime}
                location={locationLabel}
                containerStyle={styles.userMeta}
                sportEmphasisStyle={styles.postMetaSport}
                secondaryStyle={styles.postMetaTime}
              />
            </View>
          </View>
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
            <>
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
                    {isVideoMuted ? <VolumeX color="#fff" size={18} /> : <Volume2 color="#fff" size={18} />}
                  </TouchableOpacity>
                ) : null}
                {showMediaUserOverlay ? (
                  <View style={styles.mediaUserOverlay} pointerEvents="box-none">
                    <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Open @${post.user.username} profile`}>
                      <Image source={{ uri: post.user.avatar }} style={styles.mediaOverlayAvatar} />
                    </TouchableOpacity>
                    <View style={styles.mediaOverlayTextCol}>
                      <View style={styles.mediaOverlayUserLine}>
                        <TouchableOpacity
                          onPress={handleAvatarPress}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Open @${post.user.username} profile`}
                        >
                          <Text style={styles.mediaOverlayUsername}>@{post.user.username}</Text>
                        </TouchableOpacity>
                        {post.user.isVerified ? (
                          <View style={styles.mediaOverlayVerifiedBadge}>
                            <Text style={styles.mediaOverlayVerifiedCheck}>✓</Text>
                          </View>
                        ) : null}
                      </View>
                      {profileSubtitle ? <Text style={styles.mediaOverlaySubtitle}>{profileSubtitle}</Text> : null}
                      <PostMetaSubline
                        sport={post.user.sport}
                        time={relativeTime}
                        location={locationLabel}
                        containerStyle={styles.mediaOverlayMeta}
                        sportEmphasisStyle={styles.postMetaSport}
                        secondaryStyle={styles.postMetaTime}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
              <View style={styles.pollBody}>{renderPollCardBody()}</View>
            </>
          ) : (
            <View style={styles.textPostContent}>
              <View style={styles.textPostUserRow}>
                <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Open @${post.user.username} profile`}>
                  <Image source={{ uri: post.user.avatar }} style={styles.textPostCornerAvatar} />
                </TouchableOpacity>
                <View style={styles.textPostUserTextCol}>
                  <View style={styles.textPostUserLine}>
                    <TouchableOpacity
                      onPress={handleAvatarPress}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Open @${post.user.username} profile`}
                    >
                      <Text style={styles.textPostUsername}>@{post.user.username}</Text>
                    </TouchableOpacity>
                    {post.user.isVerified ? (
                      <View style={styles.textPostInlineVerifiedBadge}>
                        <Text style={styles.textPostInlineVerifiedCheck}>✓</Text>
                      </View>
                    ) : null}
                  </View>
                  {profileSubtitle ? <Text style={styles.profileSubtitle}>{profileSubtitle}</Text> : null}
                  <PostMetaSubline
                    sport={post.user.sport}
                    time={relativeTime}
                    location={locationLabel}
                    containerStyle={styles.userMeta}
                    sportEmphasisStyle={styles.postMetaSport}
                    secondaryStyle={styles.postMetaTime}
                  />
                </View>
              </View>
              <View style={styles.pollBodyNoMedia}>{renderPollCardBody()}</View>
            </View>
          )}
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
              <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Open @${post.user.username} profile`}>
                <Image source={{ uri: post.user.avatar }} style={styles.mediaOverlayAvatar} />
              </TouchableOpacity>
              <View style={styles.mediaOverlayTextCol}>
                <View style={styles.mediaOverlayUserLine}>
                  <TouchableOpacity
                    onPress={handleAvatarPress}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Open @${post.user.username} profile`}
                  >
                    <Text style={styles.mediaOverlayUsername}>@{post.user.username}</Text>
                  </TouchableOpacity>
                  {post.user.isVerified ? (
                    <View style={styles.mediaOverlayVerifiedBadge}>
                      <Text style={styles.mediaOverlayVerifiedCheck}>✓</Text>
                    </View>
                  ) : null}
                </View>
                {profileSubtitle ? <Text style={styles.mediaOverlaySubtitle}>{profileSubtitle}</Text> : null}
                <PostMetaSubline
                  sport={post.user.sport}
                  time={relativeTime}
                  location={locationLabel}
                  containerStyle={styles.mediaOverlayMeta}
                  sportEmphasisStyle={styles.postMetaSport}
                  secondaryStyle={styles.postMetaTime}
                />
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
              {isVideoMuted ? <VolumeX color="#fff" size={18} /> : <Volume2 color="#fff" size={18} />}
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      {post.type === 'poll' && !pollHasNoMedia ? <View style={styles.textPostSeparator} /> : null}

      {/* Footer Info */}
      <View
        style={[
          styles.footer,
          (post.type === 'text' || pollHasNoMedia) && styles.textPostFooterCompact,
        ]}
      >
        {!(showMediaUserOverlay && isOwnPost) ? (
          <View style={styles.userInfoRow}>
            {!showMediaUserOverlay ? (
              post.type === 'text' || pollHasNoMedia ? (
                <View style={styles.userInfoRowSpacer} />
              ) : (
                <View style={styles.userLeft}>
                  <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Open @${post.user.username} profile`}>
                    <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
                  </TouchableOpacity>
                  <View>
                    <TouchableOpacity
                      onPress={handleAvatarPress}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Open @${post.user.username} profile`}
                    >
                      <Text style={styles.userName}>@{post.user.username}</Text>
                    </TouchableOpacity>
                  {profileSubtitle ? <Text style={styles.profileSubtitle}>{profileSubtitle}</Text> : null}
                    <PostMetaSubline
                      sport={post.user.sport}
                      time={relativeTime}
                      location={locationLabel}
                      containerStyle={styles.userMeta}
                      sportEmphasisStyle={styles.postMetaSport}
                      secondaryStyle={styles.postMetaTime}
                    />
                  </View>
                </View>
              )
            ) : (
              <View style={styles.userInfoRowSpacer} />
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

        {post.type === 'text' || pollHasNoMedia ? <View style={styles.textPostActionsDivider} /> : null}

        {/* Action Bar */}
        <View
          style={[styles.actionBar, uploadInteractionLocked && { opacity: 0.42 }]}
          pointerEvents={uploadInteractionLocked ? 'none' : 'auto'}
        >
            <View style={styles.actionLeft}>
                <TouchableOpacity
                  style={styles.actionItem}
                  accessibilityRole="button"
                  accessibilityLabel={post.likedByCurrentUser ? 'Unlike post' : 'Like post'}
                  onPress={() => void togglePostLike(post)}
                >
                    <Heart
                      size={24}
                      color={post.likedByCurrentUser ? Colors.danger : Colors.textSecondary}
                      fill={post.likedByCurrentUser ? Colors.danger : 'transparent'}
                    />
                    <Text style={styles.actionText}>
                      {post.likes >= 1000 ? `${(post.likes / 1000).toFixed(1)}k` : String(post.likes)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionItem}
                  accessibilityRole="button"
                  accessibilityLabel={isCommentsOpen ? 'Hide comments' : 'Show comments'}
                  onPress={() => (isCommentsOpen ? closeCommentsPanel() : openCommentsPanel())}
                >
                    <MessageCircle size={24} color={Colors.textSecondary} />
                    <Text style={styles.actionText}>
                      {displayedCommentCount >= 1000
                        ? `${(displayedCommentCount / 1000).toFixed(1)}k`
                        : String(displayedCommentCount)}
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
      <Modal visible={isCommentsOpen} transparent animationType="none" onRequestClose={closeCommentsPanel}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeCommentsPanel}>
          <Animated.View style={[styles.menuBackdrop, { opacity: commentsBackdropAnim }]} />
        </Pressable>
        <Animated.View style={[styles.commentsSheet, bgStyle, { transform: [{ translateY: commentsSlideAnim }] }]}>
          <View style={styles.commentsGrabber} />
          <View style={styles.commentsHeader}>
            <View style={styles.commentsHeaderLeftSpacer} />
            <Text style={styles.commentsHeaderTitle}>{`Comments (${displayedCommentCount})`}</Text>
            <View style={styles.commentsHeaderRightSpacer} />
          </View>
          <View style={styles.commentsBody}>
            <CommentList
              postId={post.id}
              onCommentCountDelta={(delta) => setOptimisticCommentDelta((prev) => prev + delta)}
              onCommentCountSync={(count) => {
                setLiveCommentCount(count);
                setOptimisticCommentDelta(0);
              }}
              onNavigateToProfile={closeCommentsPanel}
            />
          </View>
        </Animated.View>
      </Modal>
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
