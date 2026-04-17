import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Bell, CheckCircle2 } from 'lucide-react-native';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Welcome to Athlete Social',
    body: 'Start following athletes and posting your best highlights.',
    time: 'Just now',
    unread: true,
  },
  {
    id: '2',
    title: 'New follower',
    body: 'Jordan K. started following you.',
    time: '2h',
    unread: true,
  },
  {
    id: '3',
    title: 'Your highlight is live',
    body: 'Your latest clip has been published.',
    time: 'Yesterday',
    unread: false,
  },
];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications]);

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[styles.item, item.unread && styles.itemUnread]}
      activeOpacity={0.8}
      onPress={() => markRead(item.id)}
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyBody}>No notifications right now.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 12,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
  },
  itemUnread: {
    borderWidth: 1,
    borderColor: Colors.primary,
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
});

