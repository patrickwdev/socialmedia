import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import type { User } from '@/data/mock';
import { AthleteProfileLayout } from '@/components/AthleteProfileLayout';
import { PublicFanProfileLayout } from '@/components/PublicFanProfileLayout';
import { PublicCoachProfileLayout } from '@/components/PublicCoachProfileLayout';
import { PublicScoutProfileLayout } from '@/components/PublicScoutProfileLayout';
import { useAuth } from '@/context/AuthContext';
import { useViewerFollows } from '@/context/ViewerFollowsContext';
import { useProfileFollow } from '@/hooks/useProfileFollow';
import { useProfileFan } from '@/hooks/useProfileFan';
import { useThemeBackgroundStyle, useThemedStylesheet } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { userFromPostSnapshot } from '@/lib/userFromPostSnapshot';
import type { Json } from '@/types/database';

type RemoteProfile = {
  id: string;
  username: string;
  display_name: string | null;
  role: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  sport: string | null;
  team: string | null;
  bio: string | null;
  location: string | null;
  org_name: string | null;
  role_title: string | null;
  linkedin_link: string | null;
  birthday: string | null;
  links: Json | null;
  followers_count?: number | null;
  following_count?: number | null;
  fans_count?: number | null;
};

type ProfileRole = 'athlete' | 'fan' | 'coach' | 'scout';

function normalizeRole(value: unknown): ProfileRole | null {
  if (typeof value !== 'string') return null;
  const role = value.trim().toLowerCase();
  if (role === 'athlete' || role === 'fan' || role === 'coach' || role === 'scout') return role;
  return null;
}

type ProfileMeta = {
  orgName?: string;
  roleTitle?: string;
  profileLink?: string;
};

function optimisticUserFromParams(params: {
  userId: string;
  username: string;
  avatar: string;
  displayName: string;
  banner: string;
  followers: string;
  fans: string;
  following: string;
  bio: string;
  location: string;
  role?: string;
}): User {
  const { userId, username, avatar, displayName, banner, followers, fans, following, bio, location, role } = params;
  const normalizedFollowers = followers.trim() || '0';
  const normalizedFans = fans.trim() || '0';
  const normalizedFollowing = following.trim() || '0';
  const resolvedRole = normalizeRole(role);
  return {
    id: userId || `pending-${username}`,
    name: displayName.trim() || username,
    username,
    avatar: avatar || '',
    banner: banner.trim() || undefined,
    isVerified: false,
    isAthlete: resolvedRole !== 'fan',
    sport: '',
    team: undefined,
    bio: bio.trim() || undefined,
    location: location.trim() || undefined,
    followers: normalizedFollowers,
    fans: normalizedFans,
    following: normalizedFollowing,
    highlightsCount: 0,
  };
}

function userFromProfileRowOnly(row: RemoteProfile, avatarFallback: string): User {
  const avatar =
    row.avatar_url?.trim() ||
    avatarFallback ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(row.username)}`;
  return {
    id: row.id,
    name: row.display_name?.trim() || row.username,
    username: row.username,
    avatar,
    banner: row.banner_url?.trim() || undefined,
    isVerified: false,
    isAthlete: normalizeRole(row.role) !== 'fan',
    sport: row.sport?.trim() || '',
    team: row.team?.trim() || undefined,
    bio: row.bio?.trim() || undefined,
    location: row.location?.trim() || undefined,
    followers: String(row.followers_count ?? 0),
    fans: String(row.fans_count ?? 0),
    following: String(row.following_count ?? 0),
    highlightsCount: 0,
  };
}

export default function PublicProfileScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();
  const isTabFocused = useIsFocused();
  const params = useLocalSearchParams<{
    username?: string;
    userId?: string;
    avatar?: string;
    displayName?: string;
    banner?: string;
    followers?: string;
    fans?: string;
    following?: string;
    role?: string;
    publicView?: string;
    initialFollowing?: string;
    initialFan?: string;
    orgName?: string;
    roleTitle?: string;
    bio?: string;
    location?: string;
    profileLink?: string;
  }>();
  const { user } = useAuth();
  const { patchViewerFollows, patchViewerFans } = useViewerFollows();

  const routeUsername = (params.username ?? '').replace(/^@+/, '').trim();
  const routeAvatar = typeof params.avatar === 'string' ? params.avatar : '';
  const routeDisplayName = typeof params.displayName === 'string' ? params.displayName : '';
  const routeBanner = typeof params.banner === 'string' ? params.banner : '';
  const routeFollowers = typeof params.followers === 'string' ? params.followers : '';
  const routeFans = typeof params.fans === 'string' ? params.fans : '';
  const routeFollowing = typeof params.following === 'string' ? params.following : '';
  const routeUserId = typeof params.userId === 'string' ? params.userId : '';
  const routeRoleParam = typeof params.role === 'string' ? params.role : '';
  const routeOrgName = typeof params.orgName === 'string' ? params.orgName : '';
  const routeRoleTitle = typeof params.roleTitle === 'string' ? params.roleTitle : '';
  const routeBio = typeof params.bio === 'string' ? params.bio : '';
  const routeLocation = typeof params.location === 'string' ? params.location : '';
  const routeProfileLink = typeof params.profileLink === 'string' ? params.profileLink : '';
  const routeRole = normalizeRole(routeRoleParam);
  /** When set (e.g. from connections sheet), show this user on the public stack even if it is the signed-in user. */
  const routePublicSelf = params.publicView === '1';

  const routeInitialFollowingParam =
    typeof params.initialFollowing === 'string' ? params.initialFollowing : '';
  const initialFollowFromRoute = useMemo((): boolean | undefined => {
    if (routeInitialFollowingParam === '1') return true;
    if (routeInitialFollowingParam === '0') return false;
    return undefined;
  }, [routeInitialFollowingParam]);
  const routeInitialFanParam = typeof params.initialFan === 'string' ? params.initialFan : '';
  const initialFanFromRoute = useMemo((): boolean | undefined => {
    if (routeInitialFanParam === '1') return true;
    if (routeInitialFanParam === '0') return false;
    return undefined;
  }, [routeInitialFanParam]);

  const styles = useThemedStylesheet(() => ({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      color: Colors.textSecondary,
      fontSize: 16,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
  }));

  const [profile, setProfile] = useState<User | null>(() =>
    routeUsername
      ? optimisticUserFromParams({
          userId: routeUserId,
          username: routeUsername,
          avatar: routeAvatar,
          displayName: routeDisplayName,
          banner: routeBanner,
          followers: routeFollowers,
          fans: routeFans,
          following: routeFollowing,
          bio: routeBio,
          location: routeLocation,
          role: routeRoleParam,
        })
      : null
  );
  const [profileRole, setProfileRole] = useState<ProfileRole | null>(routeRole ?? null);
  const [profileMeta, setProfileMeta] = useState<ProfileMeta>({
    orgName: routeOrgName.trim() || undefined,
    roleTitle: routeRoleTitle.trim() || undefined,
    profileLink: routeProfileLink.trim() || undefined,
  });
  const [optimisticFanDelta, setOptimisticFanDelta] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const profileRef = useRef(profile);
  profileRef.current = profile;

  const refetchTargetCounts = useCallback(async () => {
    const id = profileRef.current?.id;
    if (!id || id.startsWith('pending-')) return;
    const { data, error: countError } = await supabase
      .from('profiles')
      .select('followers_count, following_count, fans_count')
      .eq('id', id)
      .maybeSingle();
    if (countError || !data) return;
    const rowCounts = data as {
      followers_count?: number | null;
      following_count?: number | null;
      fans_count?: number | null;
    };
    setProfile((p) =>
      p && p.id === id
        ? {
            ...p,
            followers: String(rowCounts.followers_count ?? 0),
            following: String(rowCounts.following_count ?? 0),
            fans: String(rowCounts.fans_count ?? 0),
          }
        : p
    );
    setOptimisticFanDelta(0);
  }, []);

  const onFollowChange = useCallback(
    (targetUserId: string, following: boolean) => {
      patchViewerFollows(targetUserId, following);
    },
    [patchViewerFollows]
  );

  const followHookOptions = useMemo(
    () => ({
      initialIsFollowing: initialFollowFromRoute,
      onCountsChanged: refetchTargetCounts,
      onFollowChange,
    }),
    [initialFollowFromRoute, refetchTargetCounts, onFollowChange]
  );

  const { isFollowing, followBusy, toggleFollow } = useProfileFollow(profile?.id, followHookOptions);
  const { isFan, fanBusy, toggleFan } = useProfileFan(profile?.id, profileRole, {
    onCountsChanged: refetchTargetCounts,
    initialIsFan: initialFanFromRoute,
    onFanChange: (nextIsFan) => {
      if (profile?.id) patchViewerFans(profile.id, nextIsFan);
      setOptimisticFanDelta(nextIsFan ? 1 : -1);
    },
  });

  const profileWithOptimisticFans = useMemo(() => {
    if (!profile) return null;
    const baseFans = Number.parseInt(profile.fans, 10);
    const safeBaseFans = Number.isNaN(baseFans) ? 0 : baseFans;
    return {
      ...profile,
      fans: String(Math.max(0, safeBaseFans + optimisticFanDelta)),
    };
  }, [optimisticFanDelta, profile]);

  useEffect(() => {
    setOptimisticFanDelta(0);
  }, [profile?.id]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!routeUsername && !routeUserId) {
        setError('Profile not found.');
        return;
      }

      setError(null);
      setProfile(
        optimisticUserFromParams({
          userId: routeUserId,
          username: routeUsername || routeUserId || 'user',
          avatar: routeAvatar,
          displayName: routeDisplayName,
          banner: routeBanner,
          followers: routeFollowers,
          fans: routeFans,
          following: routeFollowing,
          bio: routeBio,
          location: routeLocation,
          role: routeRoleParam,
        })
      );
      setProfileMeta({
        orgName: routeOrgName.trim() || undefined,
        roleTitle: routeRoleTitle.trim() || undefined,
        profileLink: routeProfileLink.trim() || undefined,
      });

      try {
        const usernameQuery = routeUsername
          ? supabase
              .from('profiles')
              .select(
                `
                  id,
                  username,
                  display_name,
                  role,
                  avatar_url,
                  banner_url,
                  sport,
                  team,
                  bio,
                  location,
                  org_name,
                  role_title,
                  linkedin_link,
                  birthday,
                  links,
                  followers_count,
                  following_count,
                  fans_count
                `
              )
              .eq('username', routeUsername)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null });
        const idQuery = routeUserId
          ? supabase
              .from('profiles')
              .select(
                `
                  id,
                  username,
                  display_name,
                  role,
                  avatar_url,
                  banner_url,
                  sport,
                  team,
                  bio,
                  location,
                  org_name,
                  role_title,
                  linkedin_link,
                  birthday,
                  links,
                  followers_count,
                  following_count,
                  fans_count
                `
              )
              .eq('id', routeUserId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null });

        const [byUsername, byId] = await Promise.all([usernameQuery, idQuery]);
        const row = (byUsername.data ?? byId.data) as RemoteProfile | null;
        const profileError = byUsername.error ?? byId.error;

        if (profileError) throw profileError;
        if (!row) {
          if (!cancelled) setError('Profile not found.');
          return;
        }

        if (user?.id && row.id === user.id && !routePublicSelf) {
          router.replace('/(tabs)/profile');
          return;
        }

        const roleFromRow = normalizeRole(row.role);
        const hasLinkInLinks =
          Array.isArray(row.links) &&
          row.links.some((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
            const url = (item as Record<string, unknown>).url;
            return typeof url === 'string' && url.trim().length > 0;
          });
        const hasMetaFromRow = Boolean(
          row.org_name?.trim() || row.role_title?.trim() || row.linkedin_link?.trim() || hasLinkInLinks
        );
        const shouldFetchSnapshot = !routeRole && (!roleFromRow || !hasMetaFromRow);

        const profileLinkFromLinks = Array.isArray(row.links)
          ? row.links.find((item) => {
              if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
              const url = (item as Record<string, unknown>).url;
              return typeof url === 'string' && url.trim().length > 0;
            })
          : null;
        const profileLinkFromLinksUrl =
          profileLinkFromLinks && typeof profileLinkFromLinks === 'object'
            ? ((profileLinkFromLinks as Record<string, unknown>).url as string).trim()
            : '';

        if (!cancelled) {
          const layoutRole = routeRole ?? roleFromRow;
          if (layoutRole) {
            setProfileRole(layoutRole);
          }
          setProfile(userFromProfileRowOnly(row, routeAvatar));
          setProfileMeta({
            orgName: row.org_name?.trim(),
            roleTitle: row.role_title?.trim(),
            profileLink: row.linkedin_link?.trim() || profileLinkFromLinksUrl || undefined,
          });
        }

        let rawSnapshot: Json | null = null;
        if (shouldFetchSnapshot) {
          const latestSnapshotRes = await supabase
            .from('posts')
            .select('user_snapshot')
            .eq('user_id', row.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestSnapshotRes.error) throw latestSnapshotRes.error;
          const snapRow = latestSnapshotRes.data as { user_snapshot: Json | null } | null;
          rawSnapshot = snapRow?.user_snapshot ?? null;
        }

        const snapshotRole =
          rawSnapshot && typeof rawSnapshot === 'object' && !Array.isArray(rawSnapshot)
            ? (() => {
                const blob = rawSnapshot as Record<string, unknown>;
                const fromRoot = normalizeRole(blob.role);
                if (fromRoot) return fromRoot;
                if (blob.user_metadata && typeof blob.user_metadata === 'object' && !Array.isArray(blob.user_metadata)) {
                  return normalizeRole((blob.user_metadata as Record<string, unknown>).role);
                }
                return null;
              })()
            : null;
        const snapshotMeta = rawSnapshot && typeof rawSnapshot === 'object' && !Array.isArray(rawSnapshot)
          ? (() => {
              const blob = rawSnapshot as Record<string, unknown>;
              const metadataCandidate =
                blob.user_metadata && typeof blob.user_metadata === 'object' && !Array.isArray(blob.user_metadata)
                  ? (blob.user_metadata as Record<string, unknown>)
                  : blob;
              const profileLink =
                typeof metadataCandidate.linkedin_link === 'string'
                  ? metadataCandidate.linkedin_link.trim()
                  : '';
              return {
                orgName:
                  typeof metadataCandidate.org_name === 'string'
                    ? metadataCandidate.org_name.trim()
                    : undefined,
                roleTitle:
                  typeof metadataCandidate.role_title === 'string'
                    ? metadataCandidate.role_title.trim()
                    : undefined,
                profileLink: profileLink || undefined,
              } as ProfileMeta;
            })()
          : {};
        const mapped = userFromPostSnapshot(rawSnapshot, row.id);
        const base = mapped ?? userFromProfileRowOnly(row, routeAvatar);
        const followersCount = row.followers_count ?? 0;
        const followingCount = row.following_count ?? 0;
        const fansCount = row.fans_count ?? 0;
        const next: User = {
          ...base,
          followers: String(followersCount),
          fans: String(fansCount),
          following: String(followingCount),
        };

        if (!cancelled) {
          setProfile(next);
          setProfileRole(
            routeRole ?? roleFromRow ?? snapshotRole ?? (mapped?.isAthlete === false ? 'fan' : 'athlete')
          );
          setProfileMeta({
            orgName: row.org_name?.trim() || snapshotMeta.orgName,
            roleTitle: row.role_title?.trim() || snapshotMeta.roleTitle,
            profileLink: row.linkedin_link?.trim() || profileLinkFromLinksUrl || snapshotMeta.profileLink,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unable to load profile.');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    routeUsername,
    routeUserId,
    routeAvatar,
    routeDisplayName,
    routeBanner,
    routeFollowers,
    routeFans,
    routeFollowing,
    routeBio,
    routeLocation,
    routeProfileLink,
    routeRole,
    routeRoleParam,
    routeOrgName,
    routeRoleTitle,
    routePublicSelf,
    router,
    user?.id,
  ]);

  const sportSubtitle = useMemo(() => {
    const parts = [profile?.sport?.trim()].filter(Boolean) as string[];
    return parts.join(' \u00b7 ');
  }, [profile?.sport]);

  const profileLink = profileMeta.profileLink ?? '';
  const normalizedProfileLink = profileLink && /^https?:\/\//i.test(profileLink) ? profileLink : profileLink ? `https://${profileLink}` : '';
  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const handleMessagePress = useCallback(() => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Sign in to send messages.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }
    router.push('/messages');
  }, [router, user?.id]);

  if (error && !profile) {
    return (
      <View style={[styles.container, styles.centered, bgStyle]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centered, bgStyle]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!profileRole) {
    return (
      <View style={[styles.container, styles.centered, bgStyle]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (profileRole === 'fan') {
    return (
      <PublicFanProfileLayout
        profile={profileWithOptimisticFans ?? profile}
        isTabFocused={isTabFocused}
        onBackPress={handleBackPress}
        profileLink={profileLink}
        normalizedProfileLink={normalizedProfileLink}
        isFollowing={isFollowing}
        followBusy={followBusy}
        onFollowPress={toggleFollow}
        onMessagePress={handleMessagePress}
      />
    );
  }

  if (profileRole === 'coach') {
    return (
      <PublicCoachProfileLayout
        profile={profileWithOptimisticFans ?? profile}
        isTabFocused={isTabFocused}
        onBackPress={handleBackPress}
        orgName={profileMeta.orgName}
        roleTitle={profileMeta.roleTitle}
        profileLink={profileLink}
        normalizedProfileLink={normalizedProfileLink}
        isFollowing={isFollowing}
        followBusy={followBusy}
        onFollowPress={toggleFollow}
        onMessagePress={handleMessagePress}
      />
    );
  }

  if (profileRole === 'scout') {
    return (
      <PublicScoutProfileLayout
        profile={profileWithOptimisticFans ?? profile}
        isTabFocused={isTabFocused}
        onBackPress={handleBackPress}
        orgName={profileMeta.orgName}
        roleTitle={profileMeta.roleTitle}
        profileLink={profileLink}
        normalizedProfileLink={normalizedProfileLink}
        isFollowing={isFollowing}
        followBusy={followBusy}
        onFollowPress={toggleFollow}
        onMessagePress={handleMessagePress}
      />
    );
  }

  return (
    <AthleteProfileLayout
      profile={profileWithOptimisticFans ?? profile}
      variant="public"
      sportSubtitle={sportSubtitle}
      profileLink={profileLink}
      normalizedProfileLink={normalizedProfileLink}
      isTabFocused={isTabFocused}
      onBackPress={handleBackPress}
      isFollowing={isFollowing}
      followBusy={followBusy}
      onFollowPress={toggleFollow}
      isFan={isFan}
      fanBusy={fanBusy}
      onFanPress={toggleFan}
      onMessagePress={handleMessagePress}
    />
  );
}
