import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Modal,
  Animated,
  FlatList,
  Pressable,
  TextInput,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { MOCK_FOLLOWERS, MOCK_FANS, MOCK_FOLLOWING, MOCK_SUGGESTED, MOCK_CONNECT_PEOPLE, type FollowerItem, type Post } from '@/data/mock';
import { PostMedia } from '@/components/PostMedia';
import { ArrowLeft, Share2, MoreHorizontal, Pencil, BadgeCheck, Grid, Film, Repeat, Tag, UserPlus, Search, MapPin, User, MessageCircle, Send, Instagram, Twitter, Copy, BarChart3, Dumbbell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { useFeedPosts } from '@/context/FeedPostsContext';
import { FeedCard } from '@/components/FeedCard';
import { useProfile } from '@/hooks/useProfile';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';
import { ProfileLinkDisplay } from '@/components/ProfileLinkDisplay';
import * as Clipboard from 'expo-clipboard';
import { Link as LinkIcon, X } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 32 - 20) / 3; // 32 padding, 20 gap
const CONNECTIONS_PANEL_HEIGHT = height * 0.85;
const SHARE_PANEL_HEIGHT = Math.min(height * 0.5, 400);

type ProfileTab = 'posts' | 'clips' | 'grinds' | 'repost' | 'stats' | 'tagged';
type ConnectionsTab = 'followers' | 'fans' | 'following' | 'suggested';

const CONNECTIONS_CONFIG: Record<ConnectionsTab, { title: string; data: FollowerItem[] }> = {
  followers: { title: 'Followers', data: MOCK_FOLLOWERS },
  fans: { title: 'Fans', data: MOCK_FANS },
  following: { title: 'Following', data: MOCK_FOLLOWING },
  suggested: { title: 'Suggested', data: MOCK_SUGGESTED },
};
const CONNECTIONS_TABS: ConnectionsTab[] = ['followers', 'fans', 'following', 'suggested'];

export default function ProfileScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();
  const isTabFocused = useIsFocused();
  const { user } = useAuth();
  const { profile, loading, error } = useProfile();
  const { posts: feedPosts } = useFeedPosts();
  const myPostCount = useMemo(() => {
    if (!profile?.id) return 0;
    return feedPosts.filter((p) => p.user.id === profile.id).length;
  }, [feedPosts, profile?.id]);
  const myPosts = useMemo(() => {
    if (!profile?.id) return [];
    return feedPosts.filter((p) => p.user.id === profile.id);
  }, [feedPosts, profile?.id]);
  const myHighlightClips = useMemo(() => {
    if (!profile?.id) return [];
    return feedPosts
      .filter(
        (p) =>
          p.user.id === profile.id &&
          p.postType === 'clips' &&
          p.type === 'video' &&
          p.clipsSource !== 'grinds'
      )
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }, [feedPosts, profile?.id]);
  const myGrindsClips = useMemo(() => {
    if (!profile?.id) return [];
    return feedPosts
      .filter(
        (p) =>
          p.user.id === profile.id && p.postType === 'clips' && p.type === 'video' && p.clipsSource === 'grinds'
      )
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }, [feedPosts, profile?.id]);
  const metadata = (user?.user_metadata as {
    role?: string;
    sport_level?: string;
    linkedin_link?: string;
    links?: Array<{ url?: string }>;
  } | undefined) ?? {};
  const role = metadata.role;
  const sportLevel = metadata.sport_level?.trim() ?? '';
  const profileLink =
    metadata.linkedin_link?.trim()
    || metadata.links?.find((item) => typeof item?.url === 'string' && item.url.trim())?.url?.trim()
    || '';
  const normalizedProfileLink = profileLink && /^https?:\/\//i.test(profileLink) ? profileLink : `https://${profileLink}`;
  // Sport / level only (editable via metadata). Signup `team` is verification context — do not show as profile "bio" line.
  const sportSubtitle = [profile?.sport?.trim(), sportLevel].filter(Boolean).join(' • ');
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [showConnectionsPanel, setShowConnectionsPanel] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<ConnectionsTab>('followers');
  const [connectionsSearch, setConnectionsSearch] = useState('');
  const [showConnectPanel, setShowConnectPanel] = useState(false);
  const [connectPanelSearch, setConnectPanelSearch] = useState('');
  const slideUpAnim = useRef(new Animated.Value(CONNECTIONS_PANEL_HEIGHT)).current;
  const connectPanelSlideAnim = useRef(new Animated.Value(CONNECTIONS_PANEL_HEIGHT)).current;
  const [showSharePanel, setShowSharePanel] = useState(false);
  const sharePanelSlideAnim = useRef(new Animated.Value(SHARE_PANEL_HEIGHT)).current;

  const shareProfileUrl = useMemo(() => {
    const uname = profile?.username?.trim();
    if (!uname) return '';
    return `https://championhighlights.com/profile/${encodeURIComponent(uname)}`;
  }, [profile?.username]);

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

  useEffect(() => {
    if (role === 'scout') {
      router.replace('/scout-profile');
      return;
    }
    if (role === 'coach') {
      router.replace('/coach-profile');
      return;
    }
    if (role === 'fan') {
      router.replace('/fan-profile');
      return;
    }
  }, [role]);

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
    const data = CONNECTIONS_CONFIG[connectionsTab].data;
    const q = connectionsSearch.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.username.toLowerCase().includes(q)
    );
  }, [connectionsTab, connectionsSearch]);

  const openConnectionsPanel = (tab: ConnectionsTab) => {
    setConnectionsTab(tab);
    setConnectionsSearch('');
    setShowConnectionsPanel(true);
  };

  const closeConnectionsPanel = (onClosed?: () => void) => {
    Animated.timing(slideUpAnim, {
      toValue: CONNECTIONS_PANEL_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowConnectionsPanel(false);
      if (typeof onClosed === 'function') onClosed();
    });
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

  if (role === 'scout' || role === 'coach' || role === 'fan') {
    return (
      <View style={[styles.container, styles.centered, bgStyle]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  if (loading) {
    return (
      <View style={[styles.container, styles.centered, bgStyle]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  if (error || !profile) {
    return (
      <View style={[styles.container, styles.centered, bgStyle]}>
        <Text style={styles.errorText}>{error ?? 'Could not load profile.'}</Text>
      </View>
    );
  }

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

  return (
    <View style={[styles.container, bgStyle]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover / Banner */}
        <View style={styles.coverContainer}>
            {profile.banner ? (
              <Image source={{ uri: profile.banner }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <LinearGradient
                colors={['transparent', Colors.background]}
                style={styles.coverGradient}
            />
            
            {/* Header Actions */}
            <SafeAreaView style={styles.headerActions}>
                <TouchableOpacity style={styles.iconButton}>
                    <ArrowLeft size={24} color="white" />
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    <TouchableOpacity 
                        style={styles.iconButton}
                        onPress={() => router.push('/settings')}
                    >
                        <MoreHorizontal size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>

        <View style={styles.contentContainer}>
            {/* Profile Info Header */}
            <View style={styles.profileHeader}>
                <View style={styles.avatarContainer}>
                    {profile.avatar ? (
                      <Image source={{ uri: profile.avatar }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <User size={48} color={Colors.textSecondary} />
                      </View>
                    )}
                    {profile.isVerified && (
                        <View style={styles.verifiedBadge}>
                            <BadgeCheck size={20} color="white" fill={Colors.primary} />
                        </View>
                    )}
                </View>
                
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.followButton}
                        onPress={openSharePanel}
                    >
                        <Share2 size={20} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.followButton}
                        onPress={() => router.push('/edit-profile')}
                    >
                        <Pencil size={20} color={Colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.nameSection}>
                <View style={styles.nameRow}>
                    <Text style={styles.name}>{profile.name}</Text>
                </View>
                <Text style={styles.username}>@{profile.username}</Text>
                {sportSubtitle ? <Text style={styles.subtitle}>{sportSubtitle}</Text> : null}
                {(profile.location || profile.bio || profileLink) ? (
                  <View style={styles.locationAndBio}>
                    {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
                    {profile.location ? (
                      <View style={[styles.locationRow, !profile.bio && styles.locationRowNoBio, profile.bio && styles.locationRowAfterBio, profileLink && styles.locationRowAboveLink]}>
                        <MapPin size={14} color={Colors.textSecondary} style={styles.locationIcon} />
                        <Text style={styles.locationText}>{profile.location}</Text>
                      </View>
                    ) : null}
                    {profileLink ? (
                      <ProfileLinkDisplay
                        displayUrl={profileLink}
                        normalizedHref={normalizedProfileLink}
                        icon={<LinkIcon size={14} color={Colors.textSecondary} style={styles.locationIcon} />}
                        rowStyle={[
                          styles.profileLinkRow,
                          !profile.bio && profile.location && styles.profileLinkRowNoBio,
                          profile.location && styles.profileLinkRowAfterLocation,
                        ]}
                        textStyle={styles.profileLinkText}
                      />
                    ) : null}
                  </View>
                ) : null}
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {myPostCount >= 10000 ? `${(myPostCount / 1000).toFixed(1)}k` : String(myPostCount)}
                    </Text>
                    <Text style={styles.statLabel}>POSTS</Text>
                </View>
                <TouchableOpacity
                    style={styles.statItem}
                    onPress={() => openConnectionsPanel('followers')}
                    activeOpacity={0.7}
                >
                    <Text style={styles.statValue}>{profile.followers}</Text>
                    <Text style={styles.statLabel}>FOLLOWERS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.statItem}
                    onPress={() => openConnectionsPanel('fans')}
                    activeOpacity={0.7}
                >
                    <Text style={styles.statValue}>{profile.fans}</Text>
                    <Text style={styles.statLabel}>FANS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.statItem}
                    onPress={() => openConnectionsPanel('following')}
                    activeOpacity={0.7}
                >
                    <Text style={styles.statValue}>{profile.following}</Text>
                    <Text style={styles.statLabel}>FOLLOWING</Text>
                </TouchableOpacity>
            </View>

            {/* Content Tabs */}
            <View style={styles.contentTabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
                    onPress={() => setActiveTab('posts')}
                    activeOpacity={0.7}
                >
                    <Grid size={24} color={activeTab === 'posts' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabLabel, activeTab === 'posts' && styles.activeTabLabel]}>POSTS</Text>
                    {activeTab === 'posts' && <View style={styles.activeLine} />}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'clips' && styles.activeTab]}
                    onPress={() => setActiveTab('clips')}
                    activeOpacity={0.7}
                >
                    <Film size={24} color={activeTab === 'clips' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabLabel, activeTab === 'clips' && styles.activeTabLabel]}>HIGHLIGHTS</Text>
                    {activeTab === 'clips' && <View style={styles.activeLine} />}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'grinds' && styles.activeTab]}
                    onPress={() => setActiveTab('grinds')}
                    activeOpacity={0.7}
                >
                    <Dumbbell size={24} color={activeTab === 'grinds' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabLabel, activeTab === 'grinds' && styles.activeTabLabel]} numberOfLines={1}>GRINDS</Text>
                    {activeTab === 'grinds' && <View style={styles.activeLine} />}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'repost' && styles.activeTab]}
                    onPress={() => setActiveTab('repost')}
                    activeOpacity={0.7}
                >
                    <Repeat size={24} color={activeTab === 'repost' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabLabel, activeTab === 'repost' && styles.activeTabLabel]} numberOfLines={1}>REPOST</Text>
                    {activeTab === 'repost' && <View style={styles.activeLine} />}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
                    onPress={() => setActiveTab('stats')}
                    activeOpacity={0.7}
                >
                    <BarChart3 size={24} color={activeTab === 'stats' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabLabel, activeTab === 'stats' && styles.activeTabLabel]} numberOfLines={1}>STATS</Text>
                    {activeTab === 'stats' && <View style={styles.activeLine} />}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'tagged' && styles.activeTab]}
                    onPress={() => setActiveTab('tagged')}
                    activeOpacity={0.7}
                >
                    <Tag size={24} color={activeTab === 'tagged' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabLabel, activeTab === 'tagged' && styles.activeTabLabel]} numberOfLines={1}>TAGGED</Text>
                    {activeTab === 'tagged' && <View style={styles.activeLine} />}
                </TouchableOpacity>
            </View>

            {/* Posts (same card as home feed) */}
            {activeTab === 'posts' ? (
              myPosts.length === 0 ? (
                <View style={styles.postsEmptyWrap}>
                  <Text style={styles.postsEmptyText}>No posts yet</Text>
                </View>
              ) : (
                <View style={styles.postsFeedList}>
                  {myPosts.map((post) => (
                    <FeedCard key={post.id} post={post} isVisible={isTabFocused} />
                  ))}
                </View>
              )
            ) : activeTab === 'clips' ? (
              myHighlightClips.length === 0 ? (
                <View style={styles.postsEmptyWrap}>
                  <Text style={styles.postsEmptyText}>No highlights yet</Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {myHighlightClips.map((post: Post) => (
                    <TouchableOpacity
                      key={post.id}
                      style={styles.gridItem}
                      activeOpacity={0.85}
                      onPress={() => router.push(`/clips?id=${post.id}`)}
                    >
                      <PostMedia
                        uri={post.content || post.assets?.[0]?.uri || ''}
                        mediaType="video"
                        style={styles.gridImage}
                        mode="preview"
                        shouldPlayOverride={false}
                        isMutedOverride
                      />
                      <View style={styles.videoIcon}>
                        <Film size={16} color="white" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            ) : activeTab === 'grinds' ? (
              myGrindsClips.length === 0 ? (
                <View style={styles.postsEmptyWrap}>
                  <Text style={styles.postsEmptyText}>No grinds yet</Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {myGrindsClips.map((post: Post) => (
                    <TouchableOpacity
                      key={post.id}
                      style={styles.gridItem}
                      activeOpacity={0.85}
                      onPress={() => router.push(`/clips?id=${post.id}`)}
                    >
                      <PostMedia
                        uri={post.content || post.assets?.[0]?.uri || ''}
                        mediaType="video"
                        style={styles.gridImage}
                        mode="preview"
                        shouldPlayOverride={false}
                        isMutedOverride
                      />
                      <View style={styles.videoIcon}>
                        <Film size={16} color="white" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            ) : activeTab === 'stats' ? (
              <View style={styles.statsTabSection}>
                <View style={styles.statsTabCard}>
                  <Text style={styles.statsTabCardTitle}>Overview</Text>
                  <View style={styles.statsTabRow}>
                    <Text style={styles.statsTabLabel}>Posts</Text>
                    <Text style={styles.statsTabValue}>
                      {myPostCount >= 10000 ? `${(myPostCount / 1000).toFixed(1)}k` : String(myPostCount)}
                    </Text>
                  </View>
                  <View style={styles.statsTabDivider} />
                  <TouchableOpacity
                    style={styles.statsTabRow}
                    onPress={() => openConnectionsPanel('followers')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.statsTabLabel}>Followers</Text>
                    <Text style={styles.statsTabValue}>{profile.followers}</Text>
                  </TouchableOpacity>
                  <View style={styles.statsTabDivider} />
                  <TouchableOpacity
                    style={styles.statsTabRow}
                    onPress={() => openConnectionsPanel('fans')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.statsTabLabel}>Fans</Text>
                    <Text style={styles.statsTabValue}>{profile.fans}</Text>
                  </TouchableOpacity>
                  <View style={styles.statsTabDivider} />
                  <TouchableOpacity
                    style={styles.statsTabRow}
                    onPress={() => openConnectionsPanel('following')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.statsTabLabel}>Following</Text>
                    <Text style={styles.statsTabValue}>{profile.following}</Text>
                  </TouchableOpacity>
                </View>
                {(sportSubtitle || profile.team) ? (
                  <View style={styles.statsTabCard}>
                    <Text style={styles.statsTabCardTitle}>Athlete</Text>
                    {sportSubtitle ? (
                      <View style={styles.statsTabRow}>
                        <Text style={styles.statsTabLabel}>Sport</Text>
                        <Text style={[styles.statsTabValue, styles.statsTabValueShrink]} numberOfLines={2}>
                          {sportSubtitle}
                        </Text>
                      </View>
                    ) : null}
                    {sportSubtitle && profile.team ? <View style={styles.statsTabDivider} /> : null}
                    {profile.team ? (
                      <View style={styles.statsTabRow}>
                        <Text style={styles.statsTabLabel}>Team</Text>
                        <Text style={[styles.statsTabValue, styles.statsTabValueShrink]} numberOfLines={2}>
                          {profile.team}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : activeTab === 'repost' || activeTab === 'tagged' ? (
              <View style={styles.grid}>
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <View key={item} style={styles.gridItem}>
                    <Image
                      source={{ uri: `https://picsum.photos/300/400?random=${item}` }}
                      style={styles.gridImage}
                    />
                    {item % 2 === 0 && (
                      <View style={styles.videoIcon}>
                        <Film size={16} color="white" />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
        </View>
      </ScrollView>

      {/* Connections slide-up panel */}
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
                <Text style={styles.connectionsPanelTitle}>@{profile.username}</Text>
                <TouchableOpacity
                  style={styles.connectionsPanelClose}
                  hitSlop={12}
                  onPress={openConnectPanel}
                >
                  <UserPlus size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.connectionsTabs}>
                {CONNECTIONS_TABS.map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.connectionsTab, connectionsTab === tab && styles.connectionsTabActive]}
                    onPress={() => setConnectionsTab(tab)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.connectionsTabLabel, connectionsTab === tab && styles.connectionsTabLabelActive]}>
                      {CONNECTIONS_CONFIG[tab].title}
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

      {/* Connect slide-up panel */}
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

      {/* Share profile slide-up panel */}
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
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
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
    borderWidth: 4,
    borderColor: Colors.background,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.background,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 2,
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
  nameSection: {
    marginBottom: 24,
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
    marginTop: -2,
    marginBottom: 0,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginTop: -2,
    marginBottom: 10,
  },
  locationAndBio: {
    marginTop: -10,
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationRowNoBio: {
    marginTop: -4,
  },
  locationRowAfterBio: {
    marginTop: -4,
  },
  locationRowAboveLink: {
    marginBottom: 2,
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
    marginTop: -2,
  },
  profileLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: -4,
  },
  profileLinkRowNoBio: {
    marginTop: -6,
  },
  profileLinkRowAfterLocation: {
    marginTop: -8,
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
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
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
    minWidth: 0,
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
    bottom: -17, // Align with border
    width: '60%',
    height: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  statsTabSection: {
    gap: 16,
    paddingBottom: 8,
  },
  statsTabCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsTabCardTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 14,
  },
  statsTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  statsTabLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  statsTabValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  statsTabValueShrink: {
    flex: 1,
    textAlign: 'right',
  },
  statsTabDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  postsEmptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  postsEmptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
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
  textGridPreview: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  textGridPreviewText: {
    color: Colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  pollGridBadge: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.primary,
    marginBottom: 6,
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
});
