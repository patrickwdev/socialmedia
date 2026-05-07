import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Heart, MoreVertical } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { CommentContentText } from '@/components/CommentContentText';
import { PostMedia } from '@/components/PostMedia';
import { useAuth } from '@/context/AuthContext';
import { useRelativePostTime } from '@/hooks/useRelativePostTime';
import type { CommentNode } from '@/hooks/useComments';
import { useRouter } from 'expo-router';
import { openUserProfile, viewerFanNavHint, viewerFollowNavHint } from '@/lib/openUserProfile';
import { useViewerFollows } from '@/context/ViewerFollowsContext';

type CommentItemProps = {
  comment: CommentNode;
  depth: 0 | 1;
  isRepliesExpanded?: boolean;
  isRepliesLoading?: boolean;
  replies?: CommentNode[];
  onReplyPress: (comment: CommentNode) => void;
  onEditPress?: (comment: CommentNode) => void;
  onToggleLike: (comment: CommentNode) => void;
  onToggleReplies?: (commentId: string) => void;
  onOpenOptions?: (comment: CommentNode) => void;
  onOpenProfile?: (payload: {
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
  }) => void;
};

export function CommentItem({
  comment,
  depth,
  isRepliesExpanded = false,
  isRepliesLoading = false,
  replies = [],
  onReplyPress,
  onEditPress,
  onToggleLike,
  onToggleReplies,
  onOpenOptions,
  onOpenProfile,
}: CommentItemProps) {
  const { user } = useAuth();
  const { isViewerFollowingUser, isViewerFanningUser } = useViewerFollows();
  const router = useRouter();
  const timeLabel = useRelativePostTime(comment.createdAt, 'Just now', true);
  const isOwnComment = Boolean(user?.id && comment.userId === user.id);
  const displayReplyCount = replies.length > 0 ? replies.length : comment.replyCount;
  const canShowRepliesToggle =
    depth === 0 && (comment.replyCount > 0 || replies.length > 0 || isRepliesLoading);
  const repliesToggleText = isRepliesExpanded
    ? 'Hide replies'
    : `View replies (${displayReplyCount})`;

  const handleAvatarPress = () => {
    if (onOpenProfile) {
      onOpenProfile({
        userId: comment.userId,
        username: comment.author.username,
        avatar: comment.author.avatar,
        displayName: comment.author.name,
        banner: comment.author.banner,
        followers: comment.author.followers,
        fans: comment.author.fans,
        following: comment.author.following,
        role: comment.author.role,
        orgName: comment.author.orgName,
        roleTitle: comment.author.roleTitle,
        bio: comment.author.bio,
        location: comment.author.location,
        profileLink: comment.author.profileLink,
      });
      return;
    }
    openUserProfile(router, user?.id, {
      userId: comment.userId,
      username: comment.author.username,
      avatar: comment.author.avatar,
      displayName: comment.author.name,
      banner: comment.author.banner,
      followers: comment.author.followers,
      fans: comment.author.fans,
      following: comment.author.following,
      role: comment.author.role,
      orgName: comment.author.orgName,
      roleTitle: comment.author.roleTitle,
      bio: comment.author.bio,
      location: comment.author.location,
      profileLink: comment.author.profileLink,
      ...viewerFollowNavHint(user?.id, comment.userId, isViewerFollowingUser),
      ...viewerFanNavHint(user?.id, comment.userId, isViewerFanningUser),
    });
  };

  return (
    <View style={[styles.container, depth === 1 && styles.replyContainer]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleAvatarPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Open @${comment.author.username} profile`}
        >
          <Image source={{ uri: comment.author.avatar }} style={styles.avatar} />
        </TouchableOpacity>
        <View style={styles.headerMain}>
          <View style={styles.metaRow}>
            <TouchableOpacity
              onPress={handleAvatarPress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Open @${comment.author.username} profile`}
              style={styles.usernameWrap}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.username}
              >
                @{comment.author.username}
              </Text>
            </TouchableOpacity>
            <Text style={styles.timestamp}> · {timeLabel}</Text>
            {!comment.isPending ? (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => onOpenOptions?.(comment)}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Comment options"
              >
                <MoreVertical size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
      <CommentContentText content={comment.content} />
      {comment.mediaUrl && comment.mediaType ? (
        <View style={styles.mediaWrap}>
          <PostMedia
            uri={comment.mediaUrl}
            mediaType={comment.mediaType}
            style={styles.commentMedia}
            mode="preview"
            isMutedOverride={true}
            shouldPlayOverride={false}
          />
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => onReplyPress(comment)}>
          <Text style={styles.actionText}>Reply</Text>
        </TouchableOpacity>
        {isOwnComment ? (
          <TouchableOpacity style={styles.actionButton} onPress={() => onEditPress?.(comment)}>
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.actionButton} onPress={() => onToggleLike(comment)}>
          <Heart
            size={16}
            color={comment.likedByCurrentUser ? Colors.danger : Colors.textSecondary}
            fill={comment.likedByCurrentUser ? Colors.danger : 'transparent'}
          />
          <Text style={styles.actionText}>{comment.likeCount}</Text>
        </TouchableOpacity>

        {comment.isPending ? <Text style={styles.pendingText}>Posting...</Text> : null}
      </View>

      {canShowRepliesToggle ? (
        <TouchableOpacity
          style={styles.repliesToggleButton}
          onPress={() => onToggleReplies?.(comment.id)}
          disabled={isRepliesLoading}
        >
          {isRepliesLoading ? (
            <ActivityIndicator size="small" color={Colors.textSecondary} />
          ) : (
            <Text style={styles.repliesToggleText}>{repliesToggleText}</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {depth === 0 && isRepliesExpanded && replies.length > 0 ? (
        <View style={styles.repliesContainer}>
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={1}
              onReplyPress={onReplyPress}
              onEditPress={onEditPress}
              onToggleLike={onToggleLike}
              onOpenOptions={onOpenOptions}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  replyContainer: {
    marginLeft: 16,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    flexWrap: 'nowrap',
  },
  usernameWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  menuButton: {
    flexShrink: 0,
    paddingVertical: 2,
    paddingLeft: 2,
    marginLeft: 0,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
  },
  username: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  timestamp: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  actionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mediaWrap: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  commentMedia: {
    width: '100%',
    height: 180,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  repliesToggleButton: {
    marginTop: 8,
  },
  repliesToggleText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 8,
  },
  pendingText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
});
