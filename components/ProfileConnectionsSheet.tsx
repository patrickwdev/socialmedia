import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, BadgeCheck, Search, UserPlus } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import type { FollowerItem } from '@/data/mock';
import { MOCK_CONNECT_PEOPLE, MOCK_SUGGESTED } from '@/data/mock';
import { useAuth } from '@/context/AuthContext';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';
import { fetchFansOfProfile, fetchFollowersOfProfile, fetchFollowingOfProfile } from '@/lib/fetchProfileFollowLists';
import { openUserProfile, viewerFanNavHint, viewerFollowNavHint } from '@/lib/openUserProfile';
import { useViewerFollows } from '@/context/ViewerFollowsContext';

const { width, height } = Dimensions.get('window');
const CONNECTIONS_PANEL_HEIGHT = height * 0.85;

export type ProfileConnectionTabKey = 'followers' | 'fans' | 'following' | 'likes';

export type ProfileConnectionsSheetTab = { key: ProfileConnectionTabKey; title: string };

type ProfileConnectionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  profileUsername: string;
  profileId: string;
  initialTab: ProfileConnectionTabKey;
  tabs: ProfileConnectionsSheetTab[];
};

export function ProfileConnectionsSheet({
  visible,
  onClose,
  profileUsername,
  profileId,
  initialTab,
  tabs,
}: ProfileConnectionsSheetProps) {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();
  const { user } = useAuth();
  const { isViewerFollowingUser, isViewerFanningUser } = useViewerFollows();
  const viewerId = user?.id;
  const slideUpAnim = useRef(new Animated.Value(CONNECTIONS_PANEL_HEIGHT)).current;
  const connectPanelSlideAnim = useRef(new Animated.Value(CONNECTIONS_PANEL_HEIGHT)).current;

  const [connectionsTab, setConnectionsTab] = useState<ProfileConnectionTabKey>(initialTab);
  const [connectionsSearch, setConnectionsSearch] = useState('');
  const [followersList, setFollowersList] = useState<FollowerItem[]>([]);
  const [followingList, setFollowingList] = useState<FollowerItem[]>([]);
  const [fansList, setFansList] = useState<FollowerItem[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [showConnectPanel, setShowConnectPanel] = useState(false);
  const [connectPanelSearch, setConnectPanelSearch] = useState('');

  const loadLists = useCallback(async () => {
    if (!profileId || profileId.startsWith('pending-')) {
      setFollowersList([]);
      setFollowingList([]);
      setFansList([]);
      return;
    }
    setListsLoading(true);
    try {
      const [followers, following, fans] = await Promise.all([
        fetchFollowersOfProfile(profileId),
        fetchFollowingOfProfile(profileId),
        fetchFansOfProfile(profileId),
      ]);
      setFollowersList(followers);
      setFollowingList(following);
      setFansList(fans);
    } catch {
      setFollowersList([]);
      setFollowingList([]);
      setFansList([]);
    } finally {
      setListsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (!visible) return;
    setConnectionsTab(initialTab);
    setConnectionsSearch('');
    void loadLists();
  }, [visible, initialTab, profileId, loadLists]);

  useEffect(() => {
    if (visible) {
      slideUpAnim.setValue(CONNECTIONS_PANEL_HEIGHT);
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
  }, [visible, slideUpAnim]);

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

  useEffect(() => {
    if (!visible) setShowConnectPanel(false);
  }, [visible]);

  const tabData = useMemo((): Record<ProfileConnectionTabKey, FollowerItem[]> => {
    return {
      followers: followersList,
      following: followingList,
      fans: fansList,
      likes: [],
    };
  }, [fansList, followersList, followingList]);

  const connectionsData = useMemo(() => {
    const data = tabData[connectionsTab] ?? [];
    const q = connectionsSearch.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.username.toLowerCase().includes(q)
    );
  }, [connectionsTab, connectionsSearch, tabData]);

  const connectPanelFilteredList = useMemo(() => {
    const q = connectPanelSearch.trim().toLowerCase();
    if (!q) return MOCK_SUGGESTED;
    return MOCK_CONNECT_PEOPLE.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.username.toLowerCase().includes(q)
    );
  }, [connectPanelSearch]);

  const closeConnectionsPanel = () => {
    Animated.timing(slideUpAnim, {
      toValue: CONNECTIONS_PANEL_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
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

  const handleRowAvatarPress = useCallback(
    (item: FollowerItem) => {
      onClose();
      openUserProfile(
        router,
        viewerId,
        {
          userId: item.id,
          username: item.username,
          avatar: item.avatar,
          displayName: item.displayName,
          banner: item.banner,
          followers: item.followers,
          following: item.following,
          ...viewerFollowNavHint(viewerId, item.id, isViewerFollowingUser),
          ...viewerFanNavHint(viewerId, item.id, isViewerFanningUser),
        },
        { alwaysPublicProfile: true }
      );
    },
    [onClose, router, viewerId, isViewerFollowingUser, isViewerFanningUser]
  );

  const renderConnectionsItem = ({ item }: { item: FollowerItem }) => {
    const isViewerRow = Boolean(viewerId && item.id === viewerId);
    return (
      <View style={styles.connectionsRow}>
        <TouchableOpacity
          onPress={() => handleRowAvatarPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Open @${item.username} profile`}
        >
          <Image source={{ uri: item.avatar }} style={styles.connectionsAvatar} />
        </TouchableOpacity>
        <View style={styles.connectionsInfo}>
          <View style={styles.connectionsNameRow}>
            <Text style={styles.connectionsName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isVerified && <BadgeCheck size={16} color={Colors.primary} fill={Colors.primary} />}
          </View>
          <TouchableOpacity
            onPress={() => handleRowAvatarPress(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open @${item.username} profile`}
          >
            <Text style={styles.connectionsUsername} numberOfLines={1}>
              @{item.username}
            </Text>
          </TouchableOpacity>
        </View>
        {isViewerRow ? (
          <View style={styles.followActionSpacer} accessibilityLabel="You" />
        ) : (
          <TouchableOpacity style={styles.connectionsFollowBtn}>
            <Text style={styles.connectionsFollowBtnText}>Follow</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderConnectPanelItem = ({ item }: { item: FollowerItem }) => {
    const isViewerRow = Boolean(viewerId && item.id === viewerId);
    return (
      <View style={styles.connectionsRow}>
        <TouchableOpacity
          onPress={() => handleRowAvatarPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Open @${item.username} profile`}
        >
          <Image source={{ uri: item.avatar }} style={styles.connectionsAvatar} />
        </TouchableOpacity>
        <View style={styles.connectionsInfo}>
          <View style={styles.connectionsNameRow}>
            <Text style={styles.connectionsName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isVerified && <BadgeCheck size={16} color={Colors.primary} fill={Colors.primary} />}
          </View>
          <TouchableOpacity
            onPress={() => handleRowAvatarPress(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open @${item.username} profile`}
          >
            <Text style={styles.connectionsUsername} numberOfLines={1}>
              @{item.username}
            </Text>
          </TouchableOpacity>
        </View>
        {isViewerRow ? (
          <View style={styles.followActionSpacer} accessibilityLabel="You" />
        ) : (
          <TouchableOpacity style={styles.connectionsFollowBtn}>
            <Text style={styles.connectionsFollowBtnText}>Follow</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const emptyMessage = useMemo(() => {
    if (
      listsLoading &&
      (connectionsTab === 'followers' || connectionsTab === 'following')
    ) {
      return 'Loading…';
    }
    if (connectionsTab === 'fans') return 'No fans yet.';
    if (connectionsTab === 'likes') return 'No list here yet — liked posts appear in activity.';
    const title = tabs.find((t) => t.key === connectionsTab)?.title.toLowerCase() ?? 'people';
    return `No ${title} yet.`;
  }, [connectionsTab, listsLoading, tabs]);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={() => closeConnectionsPanel()}
        statusBarTranslucent
      >
        <View style={[styles.panelOverlay, { width, height }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeConnectionsPanel()}>
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
                <TouchableOpacity onPress={() => closeConnectionsPanel()} style={styles.connectionsPanelBack} hitSlop={12}>
                  <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.connectionsPanelTitle}>@{profileUsername}</Text>
                <TouchableOpacity style={styles.connectionsPanelClose} hitSlop={12} onPress={openConnectPanel}>
                  <UserPlus size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.connectionsTabs}>
                {tabs.map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.connectionsTab, connectionsTab === tab.key && styles.connectionsTabActive]}
                    onPress={() => setConnectionsTab(tab.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.connectionsTabLabel, connectionsTab === tab.key && styles.connectionsTabLabelActive]}
                    >
                      {tab.title}
                    </Text>
                    {connectionsTab === tab.key && <View style={styles.connectionsTabIndicator} />}
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
                ListEmptyComponent={
                  <Text style={styles.connectPanelEmptyText}>{emptyMessage}</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
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
  connectionsPanelInner: { flex: 1 },
  connectionsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  connectionsPanelBack: { padding: 4, minWidth: 32 },
  connectionsPanelTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  connectionsPanelClose: { padding: 4, minWidth: 32, alignItems: 'flex-end' },
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
  connectionsSearchIcon: { marginRight: 10 },
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
    paddingHorizontal: 24,
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
  connectionsInfo: { flex: 1, minWidth: 0 },
  connectionsNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  /** Keeps row alignment when the viewer sees themselves (no self-follow). */
  followActionSpacer: {
    minWidth: 78,
    minHeight: 36,
  },
  connectionsFollowBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
