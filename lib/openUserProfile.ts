import type { Router } from 'expo-router';

export type OpenUserProfileOptions = {
  /** When true, always open `/profile/[username]` (public stack), including for the signed-in user. */
  alwaysPublicProfile?: boolean;
};

/**
 * Spread into the `target` argument of {@link openUserProfile} so the public profile screen can show
 * the correct follow icon immediately, using `useViewerFollows().isViewerFollowingUser` (or any equivalent).
 */
export function viewerFollowNavHint(
  viewerId: string | undefined,
  targetUserId: string,
  isViewerFollowingUser: (userId: string) => boolean
): { initialIsFollowing: boolean } | Record<string, never> {
  if (!viewerId) return {};
  return { initialIsFollowing: isViewerFollowingUser(targetUserId) };
}

/**
 * Spread into the `target` argument of {@link openUserProfile} so the public profile screen can show
 * the correct fan icon immediately, before it verifies against `profile_fans`.
 */
export function viewerFanNavHint(
  viewerId: string | undefined,
  targetUserId: string,
  isViewerFanningUser: (userId: string) => boolean
): { initialIsFan: boolean } | Record<string, never> {
  if (!viewerId) return {};
  return { initialIsFan: isViewerFanningUser(targetUserId) };
}

/**
 * Navigate to a user profile. By default, the current user opens the tab profile; use `alwaysPublicProfile`
 * (e.g. from the connections sheet) to open the public profile route for everyone.
 */
export function openUserProfile(
  router: Router,
  currentUserId: string | undefined,
  target: {
    userId: string;
    username: string;
    avatar?: string;
    displayName?: string;
    banner?: string;
    followers?: string;
    fans?: string;
    following?: string;
    role?: string;
    orgName?: string;
    roleTitle?: string;
    bio?: string;
    location?: string;
    profileLink?: string;
    /** When known (e.g. from {@link viewerFollowNavHint}), avoids a wrong follow icon before the profile route verifies. */
    initialIsFollowing?: boolean;
    /** When known (e.g. from {@link viewerFanNavHint}), avoids a wrong fan icon before route verification. */
    initialIsFan?: boolean;
  },
  options?: OpenUserProfileOptions
): void {
  const username = target.username.replace(/^@+/, '').trim();
  const userId = target.userId.trim();
  const routeUsername = username || userId;
  if (!routeUsername) return;
  if (!options?.alwaysPublicProfile && currentUserId && target.userId === currentUserId) {
    router.push('/(tabs)/profile');
    return;
  }

  const isSelf = Boolean(currentUserId && target.userId === currentUserId);
  const initialFollowingParam =
    typeof target.initialIsFollowing === 'boolean'
      ? { initialFollowing: target.initialIsFollowing ? '1' : '0' }
      : {};
  const initialFanParam =
    typeof target.initialIsFan === 'boolean'
      ? { initialFan: target.initialIsFan ? '1' : '0' }
      : {};
  router.push({
    pathname: '/profile/[username]',
    params: {
      username: routeUsername,
      userId: target.userId,
      avatar: target.avatar ?? '',
      displayName: target.displayName ?? '',
      banner: target.banner ?? '',
      followers: target.followers ?? '',
      fans: target.fans ?? '',
      following: target.following ?? '',
      role: target.role ?? '',
      orgName: target.orgName ?? '',
      roleTitle: target.roleTitle ?? '',
      bio: target.bio ?? '',
      location: target.location ?? '',
      profileLink: target.profileLink ?? '',
      ...initialFollowingParam,
      ...initialFanParam,
      ...(options?.alwaysPublicProfile && isSelf ? { publicView: '1' } : {}),
    },
  });
}
