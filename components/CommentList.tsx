import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Flag, Share2, UserPlus } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { CommentItem } from '@/components/CommentItem';
import { useAuth } from '@/context/AuthContext';
import { useComments, type CommentMediaDraft, type CommentNode } from '@/hooks/useComments';
import { fetchTrendingGifs, searchGifs, type GifItem } from '@/lib/gifs';

type CommentListProps = {
  postId: string;
  onCommentCountDelta?: (delta: number) => void;
  onCommentCountSync?: (count: number) => void;
};

export function CommentList({ postId, onCommentCountDelta, onCommentCountSync }: CommentListProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentNode | null>(null);
  const [editingComment, setEditingComment] = useState<CommentNode | null>(null);
  const [pendingMedia, setPendingMedia] = useState<CommentMediaDraft | null>(null);
  const [pendingMediaTag, setPendingMediaTag] = useState<'gif' | null>(null);
  const [selectedComment, setSelectedComment] = useState<CommentNode | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GifItem[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const pageSize = 10;
  const {
    comments,
    repliesByParentId,
    expandedReplyThreads,
    isLoadingComments,
    isLoadingMoreComments,
    isSubmitting,
    isLoadingRepliesByParentId,
    canLoadMore,
    loadInitialComments,
    loadMoreComments,
    toggleReplies,
    addComment,
    editComment,
    toggleCommentLike,
  } = useComments({
    postId,
    pageSize,
    onPostCommentCountDelta: onCommentCountDelta,
    onServerCommentCountSync: onCommentCountSync,
  });

  useEffect(() => {
    void loadInitialComments();
  }, [loadInitialComments]);

  const isReplyingToSelf = Boolean(replyingTo && user?.id && replyingTo.userId === user.id);

  const inputPlaceholder = useMemo(() => {
    if (editingComment) return 'Edit your comment…';
    if (replyingTo) return 'Write a reply…';
    return 'Add a comment…';
  }, [editingComment, replyingTo]);

  const handleReplyPress = (comment: CommentNode) => {
    setEditingComment(null);
    setReplyingTo(comment);
    setInputValue('');
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleEditPress = (comment: CommentNode) => {
    setReplyingTo(null);
    setPendingMedia(null);
    setPendingMediaTag(null);
    setEditingComment(comment);
    setInputValue(comment.content);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const clearReplyMode = () => {
    setReplyingTo(null);
    setEditingComment(null);
    setInputValue('');
    setPendingMedia(null);
    setPendingMediaTag(null);
  };

  const handleAddMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings to attach media.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      selectionLimit: 1,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingMedia({
      uri: asset.uri,
      type: 'image',
    });
    setPendingMediaTag(null);
  };

  const loadTrendingGifResults = async () => {
    setLoadingGifs(true);
    setGifError(null);
    try {
      const results = await fetchTrendingGifs();
      setGifResults(results);
    } catch {
      setGifResults([]);
      setGifError('Unable to load GIFs. Please try again.');
    } finally {
      setLoadingGifs(false);
    }
  };

  const handleAddGif = () => {
    setGifPickerVisible(true);
    void loadTrendingGifResults();
  };

  const runGifSearch = async () => {
    const query = gifQuery.trim();
    if (!query) {
      await loadTrendingGifResults();
      return;
    }
    setLoadingGifs(true);
    setGifError(null);
    try {
      const results = await searchGifs(query);
      setGifResults(results);
    } catch {
      setGifResults([]);
      setGifError('GIF search failed. Try another keyword.');
    } finally {
      setLoadingGifs(false);
    }
  };

  const handlePickGif = (gif: GifItem) => {
    setPendingMedia({ uri: gif.fullUrl, type: 'image' });
    setPendingMediaTag('gif');
    setGifPickerVisible(false);
  };

  const closeOptionsSheet = () => {
    setOptionsVisible(false);
    setSelectedComment(null);
  };

  const openOptionsSheet = (comment: CommentNode) => {
    setSelectedComment(comment);
    setOptionsVisible(true);
  };

  const handleFollowPress = () => {
    closeOptionsSheet();
    if (!selectedComment) return;
    Alert.alert('Follow', `Follow @${selectedComment.author.username} coming soon.`);
  };

  const handleSharePress = () => {
    if (!selectedComment) return;
    closeOptionsSheet();
    const preview = selectedComment.content.trim();
    const text = preview ? `@${selectedComment.author.username}: ${preview}` : `Comment by @${selectedComment.author.username}`;
    void Share.share({ message: text });
  };

  const handleReportPress = () => {
    closeOptionsSheet();
    Alert.alert('Report', 'Thanks. We will review this comment.');
  };

  const handleSubmit = async () => {
    const body = inputValue.trim();
    if ((!body && !pendingMedia) || isSubmitting) return;
    if (editingComment) {
      const ok = await editComment(editingComment, body);
      if (ok) {
        setInputValue('');
        setEditingComment(null);
      } else {
        Alert.alert('Error', 'Could not save edit. Try again.');
      }
      return;
    }
    const u = replyingTo?.author.username.trim() ?? '';
    const value =
      replyingTo && !isReplyingToSelf ? `@${u} ${body}`.trim() : body;
    if (value.length > 500) return;
    const ok = await addComment(
      value,
      replyingTo
        ? {
            parentId: replyingTo.id,
            threadRootId: replyingTo.threadRootId ?? replyingTo.id,
          }
        : null,
      pendingMedia
    );
    if (ok) {
      setInputValue('');
      setReplyingTo(null);
      setPendingMedia(null);
      setPendingMediaTag(null);
    } else if (pendingMedia) {
      Alert.alert('Upload failed', 'Could not attach media to this comment. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {isLoadingComments ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                depth={0}
                replies={repliesByParentId[item.id] ?? []}
                isRepliesExpanded={Boolean(expandedReplyThreads[item.id])}
                isRepliesLoading={Boolean(isLoadingRepliesByParentId[item.id])}
                onReplyPress={handleReplyPress}
                onEditPress={handleEditPress}
                onToggleLike={(comment) =>
                  void toggleCommentLike({
                    commentId: comment.id,
                    currentLikedByUser: comment.likedByCurrentUser,
                    currentLikeCount: comment.likeCount,
                  })
                }
                onToggleReplies={(commentId) => void toggleReplies(commentId)}
                onOpenOptions={openOptionsSheet}
              />
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No comments yet.</Text>}
            onEndReached={() => {
              if (canLoadMore) {
                void loadMoreComments();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMoreComments ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={Colors.textSecondary} />
                </View>
              ) : null
            }
          />
        )}

        {replyingTo || editingComment ? (
          <View style={styles.replyingBadge}>
            <Text style={styles.replyingText}>
              {editingComment
                ? 'Editing your comment'
                : isReplyingToSelf
                  ? 'Replying to your comment'
                  : `Replying to @${replyingTo?.author.username ?? ''}`}
            </Text>
            <TouchableOpacity onPress={clearReplyMode}>
              <Text style={styles.replyingCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {pendingMedia ? (
          <View style={styles.pendingMediaRow}>
            <Image source={{ uri: pendingMedia.uri }} style={styles.pendingMediaThumb} resizeMode="cover" />
            <Text style={styles.pendingMediaText}>
              {pendingMediaTag === 'gif' ? 'GIF attached' : pendingMedia.type === 'video' ? 'Video attached' : 'Image attached'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setPendingMedia(null);
                setPendingMediaTag(null);
              }}
            >
              <Text style={styles.pendingMediaRemove}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <View style={styles.composerArea}>
            <View style={styles.composerTopRow}>
              <View style={styles.inputComposite}>
                {replyingTo && !isReplyingToSelf ? (
                  <Pressable
                    onPress={() => inputRef.current?.focus()}
                    style={({ pressed }) => [styles.mentionPressable, pressed && styles.mentionPressablePressed]}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Mention @${replyingTo.author.username.trim()}. Tap to edit reply.`}
                  >
                    <Text style={styles.mentionText}>
                      @{replyingTo.author.username.trim()}
                      <Text style={styles.mentionSpace}> </Text>
                    </Text>
                  </Pressable>
                ) : null}
                <TextInput
                  ref={inputRef}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder={inputPlaceholder}
                  placeholderTextColor={Colors.textSecondary}
                  style={[styles.input, replyingTo && !isReplyingToSelf && styles.inputWithLeadingMention]}
                  multiline
                  maxLength={
                    replyingTo && !isReplyingToSelf
                      ? Math.max(0, 500 - `@${replyingTo.author.username.trim()} `.length)
                      : 500
                  }
                />
              </View>
            </View>
            {!editingComment ? (
              <View style={styles.composerActionsRow}>
                <TouchableOpacity
                  style={styles.mediaButton}
                  onPress={() => void handleAddMedia()}
                  accessibilityRole="button"
                  accessibilityLabel="Attach media to comment"
                >
                  <Text style={styles.mediaButtonText}>Media</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mediaButton}
                  onPress={handleAddGif}
                  accessibilityRole="button"
                  accessibilityLabel="Attach GIF to comment"
                >
                  <Text style={styles.mediaButtonText}>GIF</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => void handleSubmit()}
            style={[styles.sendButton, (!inputValue.trim() && !pendingMedia) || isSubmitting ? styles.sendButtonDisabled : null]}
            disabled={(!inputValue.trim() && !pendingMedia) || isSubmitting}
          >
            <Text style={styles.sendButtonText}>{isSubmitting ? '...' : editingComment ? 'Save' : 'Post'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Modal visible={optionsVisible} transparent animationType="slide" onRequestClose={closeOptionsSheet}>
        <Pressable style={styles.optionsBackdrop} onPress={closeOptionsSheet}>
          <View />
        </Pressable>
        <View style={styles.optionsSheet}>
          <View style={styles.optionsGrabber} />
          {selectedComment?.userId !== user?.id ? (
            <TouchableOpacity style={styles.optionsButton} onPress={handleFollowPress}>
              <View style={styles.optionsButtonContent}>
                <UserPlus size={18} color={Colors.text} />
                <Text style={styles.optionsButtonText}>Follow</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.optionsButton} onPress={handleSharePress}>
            <View style={styles.optionsButtonContent}>
              <Share2 size={18} color={Colors.text} />
              <Text style={styles.optionsButtonText}>Share</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionsButton} onPress={handleReportPress}>
            <View style={styles.optionsButtonContent}>
              <Flag size={18} color={Colors.danger} />
              <Text style={styles.reportButtonText}>Report</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={gifPickerVisible} transparent animationType="slide" onRequestClose={() => setGifPickerVisible(false)}>
        <Pressable style={styles.optionsBackdrop} onPress={() => setGifPickerVisible(false)}>
          <View />
        </Pressable>
        <View style={styles.gifSheet}>
          <View style={styles.optionsGrabber} />
          <View style={styles.gifSearchRow}>
            <TextInput
              value={gifQuery}
              onChangeText={setGifQuery}
              placeholder="Search GIFs"
              placeholderTextColor={Colors.textSecondary}
              style={styles.gifSearchInput}
              onSubmitEditing={() => void runGifSearch()}
            />
            <TouchableOpacity style={styles.gifSearchButton} onPress={() => void runGifSearch()}>
              <Text style={styles.gifSearchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
          {loadingGifs ? (
            <View style={styles.gifStateWrap}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : gifError ? (
            <View style={styles.gifStateWrap}>
              <Text style={styles.emptyText}>{gifError}</Text>
            </View>
          ) : (
            <FlatList
              data={gifResults}
              numColumns={3}
              keyExtractor={(item) => item.id}
              columnWrapperStyle={styles.gifGridRow}
              contentContainerStyle={styles.gifListContent}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.gifTile} onPress={() => handlePickGif(item)}>
                  <Image source={{ uri: item.previewUrl }} style={styles.gifTileImage} resizeMode="cover" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  loaderWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    paddingVertical: 20,
    textAlign: 'center',
    fontSize: 13,
  },
  footerLoader: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  replyingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  replyingText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  replyingCancel: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  composerArea: {
    flex: 1,
    gap: 8,
  },
  composerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  composerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingMediaRow: {
    marginTop: 8,
    marginHorizontal: 12,
    padding: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingMediaThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  pendingMediaText: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  pendingMediaRemove: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  mediaButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  mediaButtonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  inputComposite: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    minHeight: 44,
    maxHeight: 100,
    overflow: 'hidden',
  },
  mentionPressable: {
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 2,
    paddingVertical: 10,
    maxHeight: 100,
  },
  mentionPressablePressed: {
    opacity: 0.75,
  },
  mentionText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
  },
  mentionSpace: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  input: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    backgroundColor: 'transparent',
  },
  inputWithLeadingMention: {
    paddingLeft: 4,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  optionsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  optionsSheet: {
    marginTop: 'auto',
    backgroundColor: Colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  gifSheet: {
    marginTop: 'auto',
    backgroundColor: Colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    maxHeight: '70%',
  },
  gifSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  gifSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.text,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  gifSearchButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  gifSearchButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  gifStateWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifListContent: {
    paddingBottom: 10,
  },
  gifGridRow: {
    gap: 8,
    marginBottom: 8,
  },
  gifTile: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    aspectRatio: 1,
  },
  gifTileImage: {
    width: '100%',
    height: '100%',
  },
  optionsGrabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginBottom: 10,
  },
  optionsButton: {
    paddingVertical: 14,
  },
  optionsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionsButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
  },
  reportButtonText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
  },
});
