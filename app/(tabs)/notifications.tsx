import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Bell, CheckCircle2, MoreHorizontal, Play, Trash2 } from 'lucide-react-native';
import { useThemeBackgroundStyle, useThemedStylesheet } from '@/context/ThemeContext';
import { type AppNotificationItem, useAppNotifications } from '@/context/NotificationsContext';
import { PostMedia } from '@/components/PostMedia';

/** Same thumbnail path as profile grids: expo-av Video paused for video, Image for stills. */
function NotificationPostThumbnail({
  uri,
  kind,
  thumbStyle,
  thumbMediaStyle,
  playOverlayStyle,
}: {
  uri: string;
  kind: 'image' | 'video';
  thumbStyle: object;
  thumbMediaStyle: object;
  playOverlayStyle: object;
}) {
  return (
    <View style={thumbStyle}>
      <PostMedia uri={uri} mediaType={kind} style={thumbMediaStyle} mode="thumbnail" />
      {kind === 'video' ? (
        <View style={playOverlayStyle} pointerEvents="none">
          <Play size={16} color="white" fill="white" style={{ marginLeft: 1 }} />
        </View>
      ) : null}
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const bgStyle = useThemeBackgroundStyle();
  const { notifications, unreadCount, markNotificationRead, deleteNotification, reloadNotifications } = useAppNotifications();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const menuSlideAnim = useRef(new Animated.Value(260)).current;
  const menuBackdropAnim = useRef(new Animated.Value(0)).current;
  const styles = useThemedStylesheet(() => ({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    headerTitle: {
      color: Colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 2,
    },
    headerMeta: {
      color: Colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
      marginVertical: 0,
    },
    item: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
      paddingVertical: 12,
    },
    itemUnread: {
      borderLeftWidth: 3,
      borderLeftColor: Colors.primary,
    },
    leftIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    itemContent: {
      flex: 1,
      minWidth: 0,
    },
    itemTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
      flex: 1,
    },
    itemTitle: {
      color: Colors.text,
      fontSize: 14,
      fontWeight: '800',
      flex: 1,
      marginRight: 8,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.danger,
    },
    itemBody: {
      color: Colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 6,
    },
    itemTime: {
      color: Colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    itemMenuColumn: {
      justifyContent: 'flex-start',
      alignItems: 'center',
      flexShrink: 0,
      paddingLeft: 4,
    },
    itemMenuButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 0,
    },
    itemThumb: {
      width: 56,
      height: 56,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: Colors.border,
      flexShrink: 0,
    },
    itemThumbMedia: {
      width: '100%',
      height: '100%',
    },
    itemThumbPlayOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    empty: {
      marginTop: 24,
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    emptyTitle: {
      color: Colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 6,
    },
    emptyBody: {
      color: Colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    menuBackdropPressable: {
      flex: 1,
    },
    menuBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    menuSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.card,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 20,
      gap: 10,
    },
    menuGrabber: {
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: Colors.border,
      alignSelf: 'center',
      marginBottom: 6,
    },
    menuDeleteButton: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.background,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    menuDeleteText: {
      color: Colors.danger,
      fontSize: 15,
      fontWeight: '800',
    },
    menuCancelButton: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.card,
      paddingVertical: 12,
      alignItems: 'center',
    },
    menuCancelText: {
      color: Colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
  }));
  const openMenu = (notificationId: string) => {
    setSelectedNotificationId(notificationId);
    setMenuVisible(true);
    Animated.parallel([
      Animated.timing(menuSlideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(menuBackdropAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };
  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuSlideAnim, {
        toValue: 260,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(menuBackdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setMenuVisible(false);
        setSelectedNotificationId(null);
      }
    });
  };
  const handleDeleteSelected = () => {
    if (!selectedNotificationId) return;
    Alert.alert(
      'Delete notification?',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteNotification(selectedNotificationId);
            closeMenu();
          },
        },
      ]
    );
  };
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadNotifications();
    } finally {
      setRefreshing(false);
    }
  }, [reloadNotifications]);
  const renderItem = ({ item }: { item: AppNotificationItem }) => {
    return (
      <TouchableOpacity
        style={[styles.item, item.unread && styles.itemUnread]}
        activeOpacity={0.8}
        onPress={() => {
          markNotificationRead(item.id, item.postId);
          if (item.postId) {
            router.push(`/post/${item.postId}`);
          }
        }}
      >
        <View style={styles.leftIcon}>
          {item.unread ? <Bell size={18} color="white" /> : <CheckCircle2 size={18} color="white" />}
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.itemBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.itemTime}>{item.time}</Text>
        </View>
        {item.postMediaUri && item.postMediaKind ? (
          <NotificationPostThumbnail
            uri={item.postMediaUri}
            kind={item.postMediaKind}
            thumbStyle={styles.itemThumb}
            thumbMediaStyle={styles.itemThumbMedia}
            playOverlayStyle={styles.itemThumbPlayOverlay}
          />
        ) : null}
        <View style={styles.itemMenuColumn}>
          <TouchableOpacity
            style={styles.itemMenuButton}
            accessibilityRole="button"
            accessibilityLabel="Open notification options"
            onPress={(event) => {
              event.stopPropagation();
              openMenu(item.id);
            }}
          >
            <MoreHorizontal size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerMeta}>{unreadCount} unread</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyBody}>No notifications right now.</Text>
          </View>
        }
      />
      <Modal visible={menuVisible} transparent animationType="none" onRequestClose={closeMenu}>
        <Pressable style={styles.menuBackdropPressable} onPress={closeMenu}>
          <Animated.View style={[styles.menuBackdrop, { opacity: menuBackdropAnim }]} />
        </Pressable>
        <Animated.View style={[styles.menuSheet, { transform: [{ translateY: menuSlideAnim }] }]}>
          <View style={styles.menuGrabber} />
          <TouchableOpacity
            style={styles.menuDeleteButton}
            onPress={handleDeleteSelected}
            accessibilityRole="button"
            accessibilityLabel="Delete notification"
          >
            <Trash2 size={18} color={Colors.danger} />
            <Text style={styles.menuDeleteText}>Delete notification</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuCancelButton} onPress={closeMenu}>
            <Text style={styles.menuCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

