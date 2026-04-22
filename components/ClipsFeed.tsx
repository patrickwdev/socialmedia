import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Platform, StatusBar, Text, TouchableOpacity, View, type ViewToken } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, MessageCircle, MoreHorizontal, Plus, Music, Share2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useFeedPosts } from '@/context/FeedPostsContext';
import { useTheme, useThemeBackgroundStyle, useThemedStylesheet } from '@/context/ThemeContext';
import { PostMedia } from '@/components/PostMedia';
import type { Post } from '@/data/mock';

const { height: windowHeight } = Dimensions.get('window');

export default function ClipsFeed({
  initialClipId,
  onPressClip,
}: {
  initialClipId?: string;
  onPressClip?: (id: string) => void;
}) {
  const isTabFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const bgStyle = useThemeBackgroundStyle();
  const styles = useThemedStylesheet(() => ({
    container: {
      flex: 1,
    },
    item: {
      width: '100%',
      position: 'relative',
      justifyContent: 'center',
    },
    media: {
      width: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    gradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '50%',
    },
    centerEmpty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rightActions: {
      position: 'absolute',
      right: 12,
      bottom: 100,
      alignItems: 'center',
      zIndex: 20,
    },
    avatarStack: {
      marginBottom: 8,
      position: 'relative',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: 'white',
    },
    plusBadge: {
      position: 'absolute',
      bottom: -8,
      alignSelf: 'center',
      backgroundColor: Colors.primary,
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'white',
    },
    actionBlock: {
      alignItems: 'center',
      marginTop: 16,
    },
    actionCount: {
      color: 'white',
      fontSize: 11,
      fontWeight: '500',
      marginTop: 4,
    },
    bottomInfo: {
      position: 'absolute',
      bottom: 20,
      left: 16,
      right: 80,
      zIndex: 10,
    },
    userLine: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    username: {
      color: 'white',
      fontWeight: '700',
      fontSize: 16,
      marginRight: 6,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    verifiedBadge: {
      backgroundColor: Colors.primary,
      width: 14,
      height: 14,
      borderRadius: 7,
      justifyContent: 'center',
      alignItems: 'center',
    },
    verifiedCheck: {
      color: 'white',
      fontSize: 8,
      fontWeight: 'bold',
    },
    caption: {
      color: 'white',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    musicRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    musicText: {
      color: 'white',
      fontSize: 13,
      fontWeight: '500',
      marginLeft: 8,
    },
    emptyState: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      zIndex: 2,
    },
    emptyTitle: {
      color: Colors.text,
      fontSize: 20,
      fontWeight: '700',
    },
    emptyText: {
      color: Colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
    },
  }));

  const screenHeight =
    Platform.OS === 'ios'
      ? windowHeight - tabBarHeight
      : windowHeight - tabBarHeight + (StatusBar.currentHeight || 0);
  const { clipsPosts } = useFeedPosts();

  const initialIndex = useMemo(() => {
    if (!initialClipId) return 0;
    const idx = clipsPosts.findIndex((c) => c.id === initialClipId);
    return idx >= 0 ? idx : 0;
  }, [clipsPosts, initialClipId]);

  const listRef = useRef<FlatList<Post>>(null);
  const [visibleClipIds, setVisibleClipIds] = useState<string[]>([]);
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 70 }), []);

  useEffect(() => {
    // Ensures correct scroll position when initialClipId changes.
    if (clipsPosts.length > 0) {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }
  }, [clipsPosts.length, initialIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const nextVisibleClipIds = viewableItems
      .filter((v) => v.isViewable)
      .map((v) => {
        const post = v.item as Post | undefined;
        return post?.id;
      })
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    setVisibleClipIds(nextVisibleClipIds);
  }).current;

  const getItemLayout = (_data: ArrayLike<Post> | null | undefined, index: number) => ({
    length: screenHeight,
    offset: screenHeight * index,
    index,
  });

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPressClip?.(item.id)}
      style={[styles.item, bgStyle, { height: screenHeight }]}
    >
      <PostMedia
        uri={item.content}
        mediaType="video"
        style={[styles.media, { height: screenHeight }]}
        mode="feed"
        shouldPlayOverride={isTabFocused && visibleClipIds.includes(item.id)}
        isMutedOverride={false}
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
        locations={[0, 0.6, 1]}
        style={styles.gradient}
      />

      <View style={styles.centerEmpty} />

      <View style={styles.rightActions}>
        <View style={styles.avatarStack}>
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} />

          <View style={styles.plusBadge}>
            <Plus size={10} color="white" strokeWidth={4} />
          </View>
        </View>

        <View style={styles.actionBlock}>
          <Heart size={26} color="white" />
          <Text style={styles.actionCount}>
            {item.likes >= 1000 ? `${(item.likes / 1000).toFixed(1)}k` : String(item.likes)}
          </Text>
        </View>

        <View style={styles.actionBlock}>
          <MessageCircle size={26} color="white" />
          <Text style={styles.actionCount}>{item.comments}</Text>
        </View>

        <View style={styles.actionBlock}>
          <Share2 size={26} color="white" />
          <Text style={styles.actionCount}>{item.shares}</Text>
        </View>

        <View style={styles.actionBlock}>
          <MoreHorizontal size={26} color="white" />
        </View>
      </View>

      <View style={styles.bottomInfo}>
        <View style={styles.userLine}>
          <Text style={styles.username}>
            @{item.user.username}
          </Text>

          {item.user.isVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedCheck}>✓</Text>
            </View>
          )}
        </View>

        <Text style={styles.caption} numberOfLines={2}>
          {item.caption}
        </Text>

        <View style={styles.musicRow}>
          <Music size={14} color="white" />
          <Text style={styles.musicText}>Original audio</Text>
        </View>
      </View>
    </TouchableOpacity>
    ),
    [isTabFocused, onPressClip, screenHeight, visibleClipIds, bgStyle, styles]
  );

  return (
    <View style={[styles.container, bgStyle]}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      {clipsPosts.length === 0 ? (
        <View style={[styles.emptyState, bgStyle]}>
          <Text style={styles.emptyTitle}>No clips yet</Text>
          <Text style={styles.emptyText}>Post from Highlights or Grinds to publish your first clip.</Text>
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        data={clipsPosts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={screenHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialScrollIndex={clipsPosts.length > 0 ? initialIndex : undefined}
        getItemLayout={getItemLayout}
      />
    </View>
  );
}

