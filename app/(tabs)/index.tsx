import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useFeedPosts } from '@/context/FeedPostsContext';
import { FeedCard } from '@/components/FeedCard';
import type { Post } from '@/data/mock';
import { Search, Plus, MoreHorizontal } from 'lucide-react-native';
import { useCreatePost } from '@/context/CreatePostContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useThemeBackgroundStyle, useThemedStylesheet } from '@/context/ThemeContext';

export default function HomeScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const styles = useThemedStylesheet(() => ({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
      paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
    },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: Colors.background,
      zIndex: 10,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 0,
      marginTop: 10,
    },
    headerSeparator: {
      height: 1,
      backgroundColor: Colors.border,
      marginHorizontal: -16,
      marginTop: 12,
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: Colors.text,
    },
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 20,
      backgroundColor: Colors.card,
    },
    tabsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 40,
    },
    tabItem: {
      paddingVertical: 8,
    },
    tabItemActive: {
      paddingVertical: 8,
      position: 'relative',
    },
    tabText: {
      color: Colors.textSecondary,
      fontSize: 16,
      fontWeight: '500',
    },
    tabTextActive: {
      color: Colors.success,
      fontSize: 16,
      fontWeight: '700',
    },
    activeIndicator: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: '#10B981',
      borderRadius: 2,
    },
    scrollContent: {
      paddingHorizontal: 0,
      paddingBottom: 16,
      paddingTop: 8,
    },
    feedLoading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 48,
    },
    postDivider: {
      height: 2,
      backgroundColor: Colors.border,
    },
  }));
  const router = useRouter();
  const isTabFocused = useIsFocused();
  const { open, visible: isCreatePostOpen } = useCreatePost();
  const { posts, reloadFeed, feedInitialLoadComplete } = useFeedPosts();
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const role = (user?.user_metadata as { role?: string } | undefined)?.role;
  const canCreatePost = role !== 'fan' && role !== 'scout';
  const isFan = role === 'fan';
  const [visiblePostIds, setVisiblePostIds] = useState<string[]>([]);
  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 60,
      minimumViewTime: 80,
    }),
    []
  );
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const nextVisiblePostIds = viewableItems
        .filter((v) => v.isViewable)
        .map((v) => {
          const post = v.item as Post | undefined;
          return post?.id;
        })
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      setVisiblePostIds(nextVisiblePostIds);
    }
  ).current;
  const renderPost = useCallback(
    ({ item }: { item: (typeof posts)[number] }) => (
      <FeedCard
        post={item}
        isVisible={isTabFocused && !isCreatePostOpen && visiblePostIds.includes(item.id)}
      />
    ),
    [isCreatePostOpen, isTabFocused, visiblePostIds]
  );

  const onReload = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadFeed();
    } finally {
      setRefreshing(false);
    }
  }, [reloadFeed]);

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Clips</Text>
            <View style={styles.headerIcons}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => router.push('/search')}
                  accessibilityRole="button"
                  accessibilityLabel="Open search"
                >
                    <Search size={24} color={Colors.text} />
                </TouchableOpacity>
                {isFan ? (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => router.push('/settings')}
                    accessibilityRole="button"
                    accessibilityLabel="Open settings"
                  >
                    <MoreHorizontal size={24} color={Colors.text} />
                  </TouchableOpacity>
                ) : null}
                {canCreatePost ? (
                  <TouchableOpacity style={styles.iconButton} onPress={open} accessibilityRole="button" accessibilityLabel="Create a new highlight">
                    <Plus size={24} color={Colors.primary} />
                  </TouchableOpacity>
                ) : null}
            </View>
        </View>
        <View style={styles.headerSeparator} />

        <View style={styles.tabsContainer}>
            <TouchableOpacity style={styles.tabItemActive}>
                <Text style={styles.tabTextActive}>Trending</Text>
                <View style={styles.activeIndicator} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabItem}>
                <Text style={styles.tabText}>Following</Text>
            </TouchableOpacity>
        </View>
      </View>

      {!feedInitialLoadComplete ? (
        <View style={styles.feedLoading} accessibilityLabel="Loading feed">
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ItemSeparatorComponent={() => <View style={styles.postDivider} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onReload}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
