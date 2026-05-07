import React, { useMemo, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, Film, Grid3X3, Link as LinkIcon, MapPin, MessageCircle, Repeat2, Share2, UserPlus, UserCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';
import type { User } from '@/data/mock';
import { useFeedPosts } from '@/context/FeedPostsContext';
import { FeedCard } from '@/components/FeedCard';
import { ProfileLinkDisplay } from '@/components/ProfileLinkDisplay';
import {
  ProfileConnectionsSheet,
  type ProfileConnectionTabKey,
  type ProfileConnectionsSheetTab,
} from '@/components/ProfileConnectionsSheet';

const COACH_CONNECTION_SHEET_TABS: ProfileConnectionsSheetTab[] = [
  { key: 'followers', title: 'Followers' },
  { key: 'fans', title: 'Fans' },
  { key: 'following', title: 'Following' },
];

type CoachTab = 'posts' | 'media' | 'reposts';

type PublicCoachProfileLayoutProps = {
  profile: User;
  onBackPress: () => void;
  isTabFocused: boolean;
  orgName?: string;
  roleTitle?: string;
  profileLink?: string;
  normalizedProfileLink?: string;
  isFollowing: boolean;
  followBusy: boolean;
  onFollowPress: () => void;
  onMessagePress: () => void;
};

export function PublicCoachProfileLayout({
  profile,
  onBackPress,
  isTabFocused,
  orgName,
  roleTitle,
  profileLink = '',
  normalizedProfileLink = '',
  isFollowing,
  followBusy,
  onFollowPress,
  onMessagePress,
}: PublicCoachProfileLayoutProps) {
  const bgStyle = useThemeBackgroundStyle();
  const { posts } = useFeedPosts();
  const [activeTab, setActiveTab] = useState<CoachTab>('posts');
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsInitialTab, setConnectionsInitialTab] = useState<ProfileConnectionTabKey>('followers');

  const openConnectionsPanel = (tab: ProfileConnectionTabKey) => {
    setConnectionsInitialTab(tab);
    setConnectionsOpen(true);
  };

  const profilePosts = useMemo(
    () => posts.filter((post) => post.user.id === profile.id).sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))),
    [posts, profile.id]
  );
  const mediaPosts = useMemo(() => profilePosts.filter((post) => post.type === 'video' || post.type === 'image'), [profilePosts]);
  const shareProfileUrl = useMemo(() => {
    const username = profile.username?.trim();
    if (!username) return '';
    return `https://championhighlights.com/profile/${encodeURIComponent(username)}`;
  }, [profile.username]);

  const handleShareProfile = async () => {
    if (!shareProfileUrl) return;
    try {
      await Share.share({
        message: `Check out @${profile.username}: ${shareProfileUrl}`,
        url: shareProfileUrl,
        title: 'Share profile',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.toLowerCase().includes('cancel')) return;
      Alert.alert('Error', 'Could not share profile.');
    }
  };

  return (
    <View style={[styles.container, bgStyle]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.coverContainer}>
          {profile.banner ? <Image source={{ uri: profile.banner }} style={styles.coverImage} /> : <View style={styles.coverPlaceholder} />}
          <LinearGradient colors={['transparent', Colors.background]} style={styles.coverGradient} />
          <SafeAreaView style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={onBackPress} accessibilityRole="button" accessibilityLabel="Go back">
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.headerRight} />
          </SafeAreaView>
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.profileHeader}>
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.followButton} onPress={handleShareProfile} disabled={!shareProfileUrl}>
                <Share2 size={20} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.followButton}
                onPress={onFollowPress}
                disabled={followBusy}
                accessibilityRole="button"
                accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
              >
                {isFollowing ? <UserCheck size={20} color={Colors.primary} /> : <UserPlus size={20} color={Colors.text} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.followButton}
                onPress={onMessagePress}
                accessibilityRole="button"
                accessibilityLabel="Message"
              >
                <MessageCircle size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.identityStack}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {[orgName, roleTitle].filter(Boolean).length > 0 ? <Text style={styles.subtitle}>{[orgName, roleTitle].filter(Boolean).join(' • ')}</Text> : null}
          </View>
          {(profile.bio || profile.location || profileLink) ? (
            <View style={styles.metaStack}>
              {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
              {profile.location ? (
                <View style={styles.row}>
                  <MapPin size={14} color={Colors.textSecondary} style={styles.locationIcon} />
                  <Text style={styles.locationText}>{profile.location}</Text>
                </View>
              ) : null}
              {profileLink ? (
                <ProfileLinkDisplay
                  displayUrl={profileLink}
                  normalizedHref={normalizedProfileLink}
                  icon={<LinkIcon size={14} color={Colors.textSecondary} style={styles.locationIcon} />}
                  rowStyle={styles.row}
                  textStyle={styles.profileLinkText}
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.val}>{String(profilePosts.length)}</Text>
              <Text style={styles.label}>POSTS</Text>
            </View>
            <TouchableOpacity style={styles.stat} activeOpacity={0.7} onPress={() => openConnectionsPanel('followers')}>
              <Text style={styles.val}>{profile.followers}</Text>
              <Text style={styles.label}>FOLLOWERS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stat} activeOpacity={0.7} onPress={() => openConnectionsPanel('following')}>
              <Text style={styles.val}>{profile.following}</Text>
              <Text style={styles.label}>FOLLOWING</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('posts')}><Grid3X3 size={20} color={activeTab === 'posts' ? Colors.primary : Colors.textSecondary} /></TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('media')}><Film size={20} color={activeTab === 'media' ? Colors.primary : Colors.textSecondary} /></TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => setActiveTab('reposts')}><Repeat2 size={20} color={activeTab === 'reposts' ? Colors.primary : Colors.textSecondary} /></TouchableOpacity>
          </View>

          {activeTab === 'posts' ? profilePosts.map((post) => <FeedCard key={post.id} post={post} isVisible={isTabFocused} />) : null}
          {activeTab === 'media' ? <Text style={styles.empty}>{mediaPosts.length} media posts</Text> : null}
          {activeTab === 'reposts' ? <Text style={styles.empty}>No reposts yet</Text> : null}
          {activeTab === 'posts' && profilePosts.length === 0 ? <Text style={styles.empty}>No posts yet</Text> : null}
        </View>
      </ScrollView>

      <ProfileConnectionsSheet
        visible={connectionsOpen}
        onClose={() => setConnectionsOpen(false)}
        profileUsername={profile.username}
        profileId={profile.id}
        initialTab={connectionsInitialTab}
        tabs={COACH_CONNECTION_SHEET_TABS}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  coverContainer: { height: 240, width: '100%', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: Colors.border },
  coverGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
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
  headerRight: { flexDirection: 'row', gap: 12 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: { marginTop: -40, paddingHorizontal: 16, paddingBottom: 100 },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  followButton: { backgroundColor: Colors.card, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  identityStack: { gap: 1 },
  name: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  username: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 15, lineHeight: 20 },
  metaStack: { marginTop: 1, gap: 1 },
  bio: { color: Colors.text, fontSize: 15, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center' },
  locationIcon: { marginRight: 6 },
  locationText: { color: Colors.text, fontSize: 14, flex: 1 },
  profileLinkText: { color: Colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  stats: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginTop: 12, marginBottom: 12 },
  stat: { flex: 1, alignItems: 'center' },
  val: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  label: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 10, marginBottom: 12 },
  tab: { flex: 1, alignItems: 'center' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginVertical: 24 },
});

