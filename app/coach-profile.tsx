import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  SafeAreaView,
  Share,
  Alert,
  Dimensions,
  FlatList,
  TextInput,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import {
  MOCK_FOLLOWERS,
  MOCK_FOLLOWING,
  MOCK_SUGGESTED,
  MOCK_CONNECT_PEOPLE,
  type FollowerItem,
  type Post,
} from '@/data/mock';
import { useRouter } from 'expo-router';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft,
  MoreHorizontal,
  Share2,
  Pencil,
  LayoutGrid,
  Video,
  Repeat,
  Film,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  Send,
  Instagram,
  Twitter,
  Copy,
  X,
  Search,
  UserPlus,
  BadgeCheck,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useFeedPosts } from '@/context/FeedPostsContext';
import { useProfile } from '@/hooks/useProfile';
import { FeedCard } from '@/components/FeedCard';
import { ProfileLinkDisplay } from '@/components/ProfileLinkDisplay';
import { PostMedia } from '@/components/PostMedia';
import { useThemeBackgroundStyle, useThemedStylesheet } from '@/context/ThemeContext';

type ProfileLink = { id?: string; title?: string; url?: string };

type CoachMetadata = {
  org_name?: string;
  role_title?: string;
  linkedin_link?: string;
  links?: ProfileLink[];
};

function capitalizeWords(s: string): string {
  return s.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200&auto=format&fit=crop';

const { width, height } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 32 - 20) / 3;
const CONNECTIONS_PANEL_HEIGHT = height * 0.85;
const SHARE_PANEL_HEIGHT = Math.min(height * 0.56, 440);

function coachPostGridMedia(post: Post): { uri: string; mediaType: 'video' | 'image' } | null {
  const first = post.assets?.[0];
  if (first?.uri?.trim()) {
    return { uri: first.uri.trim(), mediaType: first.type === 'video' ? 'video' : 'image' };
  }
  const uri = post.content?.trim();
  if (!uri) return null;
  if (post.type === 'video') return { uri, mediaType: 'video' };
  if (post.type === 'image') return { uri, mediaType: 'image' };
  return null;
}

type CoachConnectionsTab = 'followers' | 'following' | 'suggested';
const COACH_CONNECTIONS_CONFIG: Record<
  CoachConnectionsTab,
  { title: string; data: FollowerItem[] }
> = {
  followers: { title: 'Followers', data: MOCK_FOLLOWERS },
  following: { title: 'Following', data: MOCK_FOLLOWING },
  suggested: { title: 'Suggested', data: MOCK_SUGGESTED },
};
const COACH_CONNECTIONS_TABS: CoachConnectionsTab[] = ['followers', 'following', 'suggested'];

type CoachTab = 'posts' | 'media' | 'reposts';

export default function CoachProfileScreen() {
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch } = useProfile();
  const { posts: feedPosts } = useFeedPosts();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const meta = (user?.user_metadata || {}) as CoachMetadata & { profile_name?: string; full_name?: string };
  const [activeTab, setActiveTab] = useState<CoachTab>('posts');
  const [showConnectionsPanel, setShowConnectionsPanel] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<CoachConnectionsTab>('followers');
  const [connectionsSearch, setConnectionsSearch] = useState('');
  const slideUpAnim = useRef(new Animated.Value(CONNECTIONS_PANEL_HEIGHT)).current;
  const [showConnectPanel, setShowConnectPanel] = useState(false);
  const [connectPanelSearch, setConnectPanelSearch] = useState('');
  const connectPanelSlideAnim = useRef(new Animated.Value(CONNECTIONS_PANEL_HEIGHT)).current;
  const [showSharePanel, setShowSharePanel] = useState(false);
  const sharePanelSlideAnim = useRef(new Animated.Value(SHARE_PANEL_HEIGHT)).current;
  const bgStyle = useThemeBackgroundStyle();

  useEffect(() => {
    if (showConnectionsPanel) {
      Animated.spring(slideUpAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideUpAnim, {
        toValue: CONNECTIONS_PANEL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showConnectionsPanel, slideUpAnim]);

  useEffect(() => {
    if (showConnectPanel) {
      Animated.spring(connectPanelSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(connectPanelSlideAnim, {
        toValue: CONNECTIONS_PANEL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showConnectPanel, connectPanelSlideAnim]);

  const connectPanelFilteredList = useMemo(() => {
    const q = connectPanelSearch.trim().toLowerCase();
    if (!q) return MOCK_SUGGESTED;
    return MOCK_CONNECT_PEOPLE.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.username.toLowerCase().includes(q)
    );
  }, [connectPanelSearch]);

  const connectionsData = useMemo(() => {
    const data = COACH_CONNECTIONS_CONFIG[connectionsTab].data;
    const q = connectionsSearch.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.username.toLowerCase().includes(q)
    );
  }, [connectionsTab, connectionsSearch]);

  const myCoachPosts = useMemo(() => {
    if (!profile?.id) return [];
    return feedPosts
      .filter((p) => p.user.id === profile.id)
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }, [feedPosts, profile?.id]);

  const myCoachMediaPosts = useMemo(
    () => myCoachPosts.filter((p) => coachPostGridMedia(p) !== null),
    [myCoachPosts]
  );

  const coachPostCountLabel =
    myCoachPosts.length >= 10000 ? `${(myCoachPosts.length / 1000).toFixed(1)}k` : String(myCoachPosts.length);

  const openConnectionsPanel = (tab: CoachConnectionsTab) => {
    setConnectionsTab(tab);
    setConnectionsSearch('');
    setShowConnectionsPanel(true);
  };

  const closeConnectionsPanel = () => {
    Animated.timing(slideUpAnim, {
      toValue: CONNECTIONS_PANEL_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowConnectionsPanel(false));
  };

  const openConnectPanel = () => {
    setConnectPanelSearch('');
    setShowConnectPanel(true);
  };

  const closeConnectPanel = () => {
    Animated.timing(connectPanelSlideAnim, {
      toValue: CONNECTIONS_PANEL_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowConnectPanel(false));
  };

  const renderConnectionsItem = ({ item }: { item: FollowerItem }) => (
    <View style={styles.connectionsRow}>
      <Image source={{ uri: item.avatar }} style={styles.connectionsAvatar} />
      <View style={styles.connectionsInfo}>
        <View style={styles.connectionsNameRow}>
          <Text style={styles.connectionsName} numberOfLines={1}>{item.name}</Text>
          {item.isVerified && <BadgeCheck size={16} color={Colors.primary} fill={Colors.primary} />}
        </View>
        <Text style={styles.connectionsUsername} numberOfLines={1}>@{item.username}</Text>
      </View>
      <TouchableOpacity style={styles.connectionsFollowBtn}>
        <Text style={styles.connectionsFollowBtnText}>Follow</Text>
      </TouchableOpacity>
    </View>
  );

  const renderConnectPanelItem = ({ item }: { item: FollowerItem }) => (
    <View style={styles.connectionsRow}>
      <Image source={{ uri: item.avatar }} style={styles.connectionsAvatar} />
      <View style={styles.connectionsInfo}>
        <View style={styles.connectionsNameRow}>
          <Text style={styles.connectionsName} numberOfLines={1}>{item.name}</Text>
          {item.isVerified && <BadgeCheck size={16} color={Colors.primary} fill={Colors.primary} />}
        </View>
        <Text style={styles.connectionsUsername} numberOfLines={1}>@{item.username}</Text>
      </View>
      <TouchableOpacity style={styles.connectionsFollowBtn}>
        <Text style={styles.connectionsFollowBtnText}>Follow</Text>
      </TouchableOpacity>
    </View>
  );

  const displayName = profile?.name
    ?? capitalizeWords(meta.profile_name?.trim() || meta.full_name?.trim() || user?.email?.split('@')[0] || 'Coach');
  const username = profile?.username ?? meta.profile_name?.trim() ?? user?.email?.split('@')[0] ?? 'coach';
  const teamName = meta.org_name?.trim();
  const roleTitle = meta.role_title?.trim();
  const displayLink =
    meta.linkedin_link?.trim()
    || meta.links?.find((item) => typeof item?.url === 'string' && item.url.trim())?.url?.trim()
    || '';
  const normalizedDisplayLink =
    displayLink && /^https?:\/\//i.test(displayLink) ? displayLink : displayLink ? `https://${displayLink}` : '';
  const showProfileDetails = !!(profile?.bio || profile?.location || displayLink);

  const shareProfileUrl = useMemo(() => {
    const u = username?.trim();
    if (!u) return '';
    return `https://championhighlights.com/profile/${encodeURIComponent(u)}`;
  }, [username]);

  const openSharePanel = () => {
    if (!shareProfileUrl) return;
    setShowSharePanel(true);
    sharePanelSlideAnim.setValue(SHARE_PANEL_HEIGHT);
    Animated.spring(sharePanelSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeSharePanel = () => {
    Animated.timing(sharePanelSlideAnim, {
      toValue: SHARE_PANEL_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowSharePanel(false));
  };

  const handleShareProfile = async () => {
    if (!shareProfileUrl) return;
    try {
      await Share.share({
        message: `Check out my profile: ${shareProfileUrl}`,
        url: shareProfileUrl,
        title: 'Share profile',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.toLowerCase().includes('cancel')) return;
      Alert.alert('Error', 'Could not share profile.');
    } finally {
      closeSharePanel();
    }
  };

  const handleCopyLink = async (closePanel = true) => {
    if (!shareProfileUrl) return;
    try {
      await Clipboard.setStringAsync(shareProfileUrl);
      Alert.alert('Copied', 'Profile link copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Could not copy link.');
    } finally {
      if (closePanel) closeSharePanel();
    }
  };

  const styles = useThemedStylesheet(() => ({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverContainer: {
    height: 240,
    width: '100%',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.border,
  },
  coverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  headerActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    marginTop: -40,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  followButton: {
    backgroundColor: Colors.card,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButton: {
    backgroundColor: Colors.card,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameSection: {
    marginBottom: 24,
  },
  identityStack: {
    gap: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 0,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  username: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
  },
  locationAndBio: {
    marginTop: 1,
    gap: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    marginRight: 6,
  },
  locationText: {
    color: Colors.text,
    fontSize: 14,
    flex: 1,
  },
  bio: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  profileLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  profileLinkText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  contentTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 16,
  },
  tab: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  activeTab: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabLabel: {
    color: Colors.primary,
  },
  activeLine: {
    position: 'absolute',
    bottom: -17,
    width: '60%',
    height: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tabContent: {
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  postsFeedList: {
    width: '100%',
    paddingTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 1.3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  videoIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 100,
  },
  panelOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  panelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  connectionsPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  connectionsPanelInner: {
    flex: 1,
  },
  connectionsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  connectionsPanelBack: {
    padding: 4,
    minWidth: 32,
  },
  connectionsPanelTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  connectionsPanelClose: {
    padding: 4,
    minWidth: 32,
    alignItems: 'flex-end',
  },
  connectionsTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  connectionsTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  connectionsTabActive: {},
  connectionsTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  connectionsTabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  connectionsTabIndicator: {
    position: 'absolute',
    bottom: -13,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  connectionsSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectionsSearchIcon: {
    marginRight: 10,
  },
  connectionsSearchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 0,
  },
  connectionsListContent: {
    paddingVertical: 12,
    paddingBottom: 40,
  },
  connectPanelSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginHorizontal: 20,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  connectPanelEmptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
  connectionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  connectionsAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
  },
  connectionsInfo: {
    flex: 1,
    minWidth: 0,
  },
  connectionsNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectionsName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  connectionsUsername: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  connectionsFollowBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  connectionsFollowBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  sharePanelBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  shareLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  quickShareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickShareRowSecondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  quickShareOption: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quickShareSpacer: {
    flex: 1,
  },
  quickShareIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickShareText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  shareLinkBox: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareSectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  shareLinkText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  inlineCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  inlineCopyButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  shareActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
  },
  shareActionLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
}));

  // Match fan/scout profile: show loader while useProfile initial load runs so we don’t flash
  // default banner/avatar or stale layout; refetches after edit-profile don’t set loading (see useProfile).
  if (profileLoading) {
    return (
      <View style={[styles.container, bgStyle, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, bgStyle]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover - match athlete */}
        <View style={styles.coverContainer}>
          {profile?.banner && profile.banner.trim() ? (
            <Image source={{ uri: profile.banner }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          <LinearGradient
            colors={['transparent', Colors.background]}
            style={styles.coverGradient}
          />
          <SafeAreaView style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.iconButton}>
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/settings')}>
                <MoreHorizontal size={24} color="white" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.contentContainer}>
          {/* Profile header - avatar left, actions right (match athlete) */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: profile?.avatar && profile.avatar.trim() ? profile.avatar : DEFAULT_AVATAR }}
                style={styles.avatar}
              />
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.followButton} onPress={openSharePanel} activeOpacity={0.7}>
                <Share2 size={20} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.messageButton} onPress={() => router.push('/edit-profile')}>
                <Pencil size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.nameSection}>
            <View style={styles.identityStack}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{displayName}</Text>
              </View>
              <Text style={styles.username}>@{username}</Text>
              {[teamName, roleTitle].filter(Boolean).length > 0 ? (
                <Text style={styles.subtitle}>{[teamName, roleTitle].filter(Boolean).join(' • ')}</Text>
              ) : null}
            </View>
            {showProfileDetails ? (
              <View style={styles.locationAndBio}>
                {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
                {profile?.location ? (
                  <View style={styles.locationRow}>
                    <MapPin size={14} color={Colors.textSecondary} style={styles.locationIcon} />
                    <Text style={styles.locationText}>{profile.location}</Text>
                  </View>
                ) : null}
                {displayLink ? (
                  <ProfileLinkDisplay
                    displayUrl={displayLink}
                    normalizedHref={normalizedDisplayLink}
                    icon={<LinkIcon size={14} color={Colors.textSecondary} style={styles.locationIcon} />}
                    rowStyle={styles.profileLinkRow}
                    textStyle={styles.profileLinkText}
                  />
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Stats - posts, followers, following, liked */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.text }]}>{coachPostCountLabel}</Text>
              <Text style={styles.statLabel}>POSTS</Text>
            </View>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => openConnectionsPanel('followers')}
              activeOpacity={0.7}
            >
              <Text style={[styles.statValue, { color: Colors.text }]}>{profile?.followers ?? '0'}</Text>
              <Text style={styles.statLabel}>FOLLOWERS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => openConnectionsPanel('following')}
              activeOpacity={0.7}
            >
              <Text style={[styles.statValue, { color: Colors.text }]}>{profile?.following ?? '0'}</Text>
              <Text style={styles.statLabel}>FOLLOWING</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.text }]}>0</Text>
              <Text style={styles.statLabel}>LIKED</Text>
            </View>
          </View>

          {/* Content tabs - same style as athlete */}
          <View style={styles.contentTabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
              onPress={() => setActiveTab('posts')}
              activeOpacity={0.7}
            >
              <LayoutGrid size={24} color={activeTab === 'posts' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.tabLabel, activeTab === 'posts' && styles.activeTabLabel]}>POSTS</Text>
              {activeTab === 'posts' && <View style={styles.activeLine} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'media' && styles.activeTab]}
              onPress={() => setActiveTab('media')}
              activeOpacity={0.7}
            >
              <Video size={24} color={activeTab === 'media' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.tabLabel, activeTab === 'media' && styles.activeTabLabel]}>MEDIA</Text>
              {activeTab === 'media' && <View style={styles.activeLine} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'reposts' && styles.activeTab]}
              onPress={() => setActiveTab('reposts')}
              activeOpacity={0.7}
            >
              <Repeat size={24} color={activeTab === 'reposts' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.tabLabel, activeTab === 'reposts' && styles.activeTabLabel]}>REPOSTS</Text>
              {activeTab === 'reposts' && <View style={styles.activeLine} />}
            </TouchableOpacity>
          </View>

          {/* Tab content */}
          {activeTab === 'posts' && (
            <View style={styles.tabContent}>
              {myCoachPosts.length === 0 ? (
                <View style={styles.emptyState}>
                  <LayoutGrid size={48} color={Colors.textSecondary} />
                  <Text style={styles.emptyStateText}>No posts yet</Text>
                  <Text style={styles.emptyStateSubtext}>Share updates and highlights here</Text>
                </View>
              ) : (
                <View style={styles.postsFeedList}>
                  {myCoachPosts.map((post) => (
                    <FeedCard key={post.id} post={post} isVisible={isScreenFocused} defaultMuted />
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'media' && (
            <View style={styles.tabContent}>
              {myCoachMediaPosts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Video size={48} color={Colors.textSecondary} />
                  <Text style={styles.emptyStateText}>No media yet</Text>
                  <Text style={styles.emptyStateSubtext}>Photos and videos will appear here</Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {myCoachMediaPosts.map((post) => {
                    const gm = coachPostGridMedia(post);
                    if (!gm) return null;
                    return (
                      <TouchableOpacity
                        key={post.id}
                        style={styles.gridItem}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/post/${post.id}`)}
                      >
                        <PostMedia
                          uri={gm.uri}
                          mediaType={gm.mediaType}
                          style={styles.gridImage}
                          mode="preview"
                          shouldPlayOverride={false}
                          isMutedOverride
                        />
                        {gm.mediaType === 'video' ? (
                          <View style={styles.videoIcon}>
                            <Film size={16} color="white" />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {activeTab === 'reposts' && (
            <View style={styles.tabContent}>
              <View style={styles.emptyState}>
                <Repeat size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyStateText}>No reposts yet</Text>
                <Text style={styles.emptyStateSubtext}>Reposts from athletes will appear here</Text>
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      <Modal
        visible={showConnectionsPanel}
        transparent
        animationType="none"
        onRequestClose={closeConnectionsPanel}
        statusBarTranslucent
      >
        <View style={[styles.panelOverlay, { width, height }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeConnectionsPanel}>
            <View style={styles.panelBackdrop} />
          </Pressable>
          <Animated.View
            style={[
              styles.connectionsPanel,
              bgStyle,
              {
                height: CONNECTIONS_PANEL_HEIGHT,
                transform: [{ translateY: slideUpAnim }],
              },
            ]}
          >
            <SafeAreaView style={styles.connectionsPanelInner}>
              <View style={styles.connectionsPanelHeader}>
                <TouchableOpacity onPress={closeConnectionsPanel} style={styles.connectionsPanelBack} hitSlop={12}>
                  <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.connectionsPanelTitle}>@{username}</Text>
                <TouchableOpacity
                  style={styles.connectionsPanelClose}
                  hitSlop={12}
                  onPress={openConnectPanel}
                >
                  <UserPlus size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.connectionsTabs}>
                {COACH_CONNECTIONS_TABS.map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.connectionsTab, connectionsTab === tab && styles.connectionsTabActive]}
                    onPress={() => setConnectionsTab(tab)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.connectionsTabLabel,
                        connectionsTab === tab && styles.connectionsTabLabelActive,
                      ]}
                    >
                      {COACH_CONNECTIONS_CONFIG[tab].title}
                    </Text>
                    {connectionsTab === tab && <View style={styles.connectionsTabIndicator} />}
                  </TouchableOpacity>
                ))}
              </View>
              <FlatList
                data={connectionsData}
                keyExtractor={(item) => item.id}
                renderItem={renderConnectionsItem}
                ListHeaderComponent={
                  <View style={styles.connectionsSearchWrap}>
                    <Search size={20} color={Colors.textSecondary} style={styles.connectionsSearchIcon} />
                    <TextInput
                      style={styles.connectionsSearchInput}
                      value={connectionsSearch}
                      onChangeText={setConnectionsSearch}
                      placeholder="Search connections..."
                      placeholderTextColor={Colors.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                }
                contentContainerStyle={styles.connectionsListContent}
                showsVerticalScrollIndicator={false}
              />
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showConnectPanel}
        transparent
        animationType="none"
        onRequestClose={closeConnectPanel}
        statusBarTranslucent
      >
        <View style={[styles.panelOverlay, { width, height }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeConnectPanel}>
            <View style={styles.panelBackdrop} />
          </Pressable>
          <Animated.View
            style={[
              styles.connectionsPanel,
              bgStyle,
              {
                height: CONNECTIONS_PANEL_HEIGHT,
                transform: [{ translateY: connectPanelSlideAnim }],
              },
            ]}
          >
            <SafeAreaView style={styles.connectionsPanelInner}>
              <View style={styles.connectionsPanelHeader}>
                <TouchableOpacity onPress={closeConnectPanel} style={styles.connectionsPanelBack} hitSlop={12}>
                  <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.connectionsPanelTitle}>Connect</Text>
                <View style={styles.connectionsPanelClose} />
              </View>
              <FlatList
                data={connectPanelFilteredList}
                keyExtractor={(item) => item.id}
                renderItem={renderConnectPanelItem}
                ListHeaderComponent={
                  <View>
                    <View style={styles.connectionsSearchWrap}>
                      <Search size={20} color={Colors.textSecondary} style={styles.connectionsSearchIcon} />
                      <TextInput
                        style={styles.connectionsSearchInput}
                        value={connectPanelSearch}
                        onChangeText={setConnectPanelSearch}
                        placeholder="Find someone..."
                        placeholderTextColor={Colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <Text style={styles.connectPanelSectionTitle}>
                      {connectPanelSearch.trim() ? 'Results' : 'Suggested for you'}
                    </Text>
                  </View>
                }
                contentContainerStyle={styles.connectionsListContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text style={styles.connectPanelEmptyText}>No people found. Try a different search.</Text>
                }
              />
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showSharePanel}
        transparent
        animationType="none"
        onRequestClose={closeSharePanel}
        statusBarTranslucent
      >
        <View style={[styles.panelOverlay, { width, height }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSharePanel}>
            <View style={styles.panelBackdrop} />
          </Pressable>
          <Animated.View
            style={[
              styles.connectionsPanel,
              bgStyle,
              {
                height: SHARE_PANEL_HEIGHT,
                transform: [{ translateY: sharePanelSlideAnim }],
              },
            ]}
          >
            <SafeAreaView style={styles.connectionsPanelInner}>
              <View style={styles.connectionsPanelHeader}>
                <TouchableOpacity onPress={closeSharePanel} style={styles.connectionsPanelBack} hitSlop={12}>
                  <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.connectionsPanelTitle}>Share profile</Text>
                <TouchableOpacity style={styles.connectionsPanelClose} hitSlop={12} onPress={closeSharePanel}>
                  <X size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.sharePanelBody}>
                <Text style={styles.shareLabel}>Profile link</Text>
                <View style={styles.shareLinkBox}>
                  <Text style={styles.shareLinkText} numberOfLines={1}>{shareProfileUrl || '—'}</Text>
                  <TouchableOpacity
                    style={styles.inlineCopyButton}
                    onPress={() => handleCopyLink(false)}
                    activeOpacity={0.7}
                    disabled={!shareProfileUrl}
                  >
                    <Copy size={16} color={Colors.primary} />
                    <Text style={styles.inlineCopyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.shareSectionDivider} />

                <Text style={styles.shareLabel}>Share to</Text>
                <View style={styles.quickShareRow}>
                  <TouchableOpacity
                    style={styles.quickShareOption}
                    onPress={handleShareProfile}
                    activeOpacity={0.7}
                    disabled={!shareProfileUrl}
                  >
                    <View style={styles.quickShareIconWrap}>
                      <MessageCircle size={18} color={Colors.primary} />
                    </View>
                    <Text style={styles.quickShareText}>Messages</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickShareOption}
                    onPress={handleShareProfile}
                    activeOpacity={0.7}
                    disabled={!shareProfileUrl}
                  >
                    <View style={styles.quickShareIconWrap}>
                      <Send size={18} color={Colors.primary} />
                    </View>
                    <Text style={styles.quickShareText}>DM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickShareOption}
                    onPress={handleShareProfile}
                    activeOpacity={0.7}
                    disabled={!shareProfileUrl}
                  >
                    <View style={styles.quickShareIconWrap}>
                      <Instagram size={18} color={Colors.primary} />
                    </View>
                    <Text style={styles.quickShareText}>Instagram</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickShareOption}
                    onPress={handleShareProfile}
                    activeOpacity={0.7}
                    disabled={!shareProfileUrl}
                  >
                    <View style={styles.quickShareIconWrap}>
                      <Twitter size={18} color={Colors.primary} />
                    </View>
                    <Text style={styles.quickShareText}>X</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.quickShareRowSecondary}>
                  <TouchableOpacity
                    style={styles.quickShareOption}
                    onPress={handleShareProfile}
                    activeOpacity={0.7}
                    disabled={!shareProfileUrl}
                  >
                    <View style={styles.quickShareIconWrap}>
                      <Share2 size={18} color={Colors.primary} />
                    </View>
                    <Text style={styles.quickShareText}>Other</Text>
                  </TouchableOpacity>
                  <View style={styles.quickShareSpacer} />
                  <View style={styles.quickShareSpacer} />
                  <View style={styles.quickShareSpacer} />
                </View>

                <TouchableOpacity
                  style={styles.shareActionButton}
                  onPress={() => handleCopyLink()}
                  activeOpacity={0.7}
                  disabled={!shareProfileUrl}
                >
                  <LinkIcon size={20} color={Colors.primary} />
                  <Text style={styles.shareActionLabel}>Copy link</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}


