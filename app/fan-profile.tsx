import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  FlatList,
  SafeAreaView,
  TextInput,
  Share,
  Alert,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { ProfileLinkDisplay } from '@/components/ProfileLinkDisplay';
import { MOCK_FOLLOWING, MOCK_FOLLOWERS, type FollowerItem } from '@/data/mock';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  MoreHorizontal,
  Share2,
  Pencil,
  Heart,
  Film,
  BadgeCheck,
  Search,
  UserPlus,
  MessageCircle,
  Send,
  Instagram,
  Twitter,
  Copy,
} from 'lucide-react-native';
import { Link as LinkIcon, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { MapPin } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

const { width, height } = Dimensions.get('window');
const CONNECTIONS_PANEL_HEIGHT = height * 0.85;
const COLUMN_WIDTH = (width - 32 - 20) / 3;
const SHARE_PANEL_HEIGHT = Math.min(height * 0.56, 440);

type ConnectionsTab = 'following' | 'followers';
const CONNECTIONS_CONFIG: Record<ConnectionsTab, { title: string; data: FollowerItem[] }> = {
  following: { title: 'Following', data: MOCK_FOLLOWING },
  followers: { title: 'Followers', data: MOCK_FOLLOWERS },
};
const CONNECTIONS_TABS: ConnectionsTab[] = ['following', 'followers'];
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop';

function capitalizeWords(s: string): string {
  return s.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

type ProfileLink = { id?: string; title?: string; url?: string };

export default function FanProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const [showConnectionsPanel, setShowConnectionsPanel] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<ConnectionsTab>('following');
  const [connectionsSearch, setConnectionsSearch] = useState('');
  const connectionsSlideAnim = useRef(new Animated.Value(CONNECTIONS_PANEL_HEIGHT)).current;
  const [showSharePanel, setShowSharePanel] = useState(false);
  const sharePanelSlideAnim = useRef(new Animated.Value(SHARE_PANEL_HEIGHT)).current;
  const bgStyle = useThemeBackgroundStyle();

  useEffect(() => {
    if (showConnectionsPanel) {
      Animated.spring(connectionsSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(connectionsSlideAnim, {
        toValue: CONNECTIONS_PANEL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showConnectionsPanel, connectionsSlideAnim]);

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

  const closeConnectionsPanel = () => {
    Animated.timing(connectionsSlideAnim, {
      toValue: CONNECTIONS_PANEL_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowConnectionsPanel(false));
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

  const meta = (user?.user_metadata || {}) as { profile_name?: string; full_name?: string };
  const linkMeta = (user?.user_metadata || {}) as { linkedin_link?: string; links?: ProfileLink[] };
  const displayName = profile?.name
    ?? capitalizeWords(meta.profile_name?.trim() || meta.full_name?.trim() || user?.email?.split('@')[0] || 'Fan');
  const username = profile?.username ?? meta.profile_name?.trim() ?? user?.email?.split('@')[0] ?? 'fan';
  const profileLink =
    linkMeta.linkedin_link?.trim()
    || linkMeta.links?.find((item) => typeof item?.url === 'string' && item.url.trim())?.url?.trim()
    || '';
  const normalizedProfileLink = profileLink && /^https?:\/\//i.test(profileLink) ? profileLink : `https://${profileLink}`;
  const hasBio = Boolean(profile?.bio);
  const hasLocation = Boolean(profile?.location);
  const hasLink = Boolean(profileLink);

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

  // Prevent a flash of placeholder/default avatar/banner while profile metadata loads.
  if (loading) {
    return (
      <View style={[styles.container, bgStyle, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, bgStyle]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover - match athlete; use profile banner when set */}
        <View style={styles.coverContainer}>
          {profile?.banner && profile.banner.trim() ? (
            <Image source={{ uri: profile.banner }} style={styles.coverImage} />
          ) : (
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=800&auto=format&fit=crop' }}
              style={styles.coverImage}
            />
          )}
          <LinearGradient
            colors={['transparent', Colors.background]}
            style={styles.coverGradient}
          />
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.iconButton}>
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/settings')}>
                <MoreHorizontal size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.contentContainer}>
          {/* Profile header - avatar left, actions right */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: profile?.avatar ?? DEFAULT_AVATAR }} style={styles.avatar} />
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
            <View style={styles.nameRow}>
              <Text style={styles.name}>{displayName}</Text>
            </View>
            <Text style={styles.username}>@{username}</Text>
            <View style={styles.detailsSection}>
              {hasBio ? <Text style={styles.bioInSubtitle}>{profile.bio}</Text> : null}

              {hasLocation ? (
                <View style={[styles.locationRow, hasBio && styles.locationRowCompact]}>
                  <MapPin size={14} color={Colors.textSecondary} style={styles.locationIcon} />
                  <Text style={styles.locationText}>{profile.location}</Text>
                </View>
              ) : null}
              {hasLink ? (
                <ProfileLinkDisplay
                  displayUrl={profileLink}
                  normalizedHref={normalizedProfileLink}
                  icon={<LinkIcon size={14} color={Colors.textSecondary} style={styles.profileLinkIcon} />}
                  rowStyle={[
                    styles.profileLinkRow,
                    !hasBio && hasLocation && styles.profileLinkRowNoBio,
                    hasBio && hasLink && styles.profileLinkRowAfterBio,
                  ]}
                  textStyle={styles.profileLinkText}
                />
              ) : null}
            </View>
          </View>

          {/* Stats - single row like athlete */}
          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statItem} onPress={() => openConnectionsPanel('following')} activeOpacity={0.7}>
              <Text style={styles.statValue}>{profile?.following ?? '0'}</Text>
              <Text style={styles.statLabel}>FOLLOWING</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => openConnectionsPanel('followers')} activeOpacity={0.7}>
              <Text style={styles.statValue}>{profile?.followers ?? '0'}</Text>
              <Text style={styles.statLabel}>FOLLOWERS</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.fans ?? '0'}</Text>
              <Text style={styles.statLabel}>LIKES</Text>
            </View>
          </View>

          {/* Content tabs - same style as athlete */}
          <View style={styles.contentTabs}>
            <View style={[styles.tab, styles.activeTab]}>
              <Heart size={24} color={Colors.primary} />
              <Text style={[styles.tabLabel, styles.activeTabLabel]}>LIKED</Text>
              <View style={styles.activeLine} />
            </View>
          </View>

          {/* Grid - 3 columns like athlete */}
          <View style={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <View key={item} style={styles.gridItem}>
                <Image
                  source={{ uri: `https://picsum.photos/300/400?random=${item + 20}` }}
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
                transform: [{ translateY: connectionsSlideAnim }],
              },
            ]}
          >
            <SafeAreaView style={styles.connectionsPanelInner}>
              <View style={styles.connectionsPanelHeader}>
                <TouchableOpacity onPress={closeConnectionsPanel} style={styles.connectionsPanelBack} hitSlop={12}>
                  <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.connectionsPanelTitle}>@{username}</Text>
                <TouchableOpacity style={styles.connectionsPanelClose} hitSlop={12}>
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

                <TouchableOpacity
                  style={styles.shareActionButton}
                  onPress={handleCopyLink}
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

const styles = StyleSheet.create({
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
    borderColor: Colors.card,
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
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  bioInSubtitle: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 0,
  },
  detailsSection: {
    marginTop: -2,
    gap: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationRowCompact: {
    marginTop: -4,
  },
  locationIcon: {
    marginRight: 6,
  },
  locationText: {
    color: Colors.text,
    fontSize: 14,
    flex: 1,
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
  profileLinkRowAfterBio: {
    marginTop: -6,
  },
  profileLinkIcon: {
    marginRight: 6,
  },
  profileLinkText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  bio: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 22,
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
