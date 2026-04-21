import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { MOCK_FOLLOWERS, MOCK_FANS, MOCK_FOLLOWING, type FollowerItem } from '@/data/mock';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, BadgeCheck } from 'lucide-react-native';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

export type ListType = 'followers' | 'fans' | 'following';

const LIST_CONFIG: Record<ListType, { title: string; data: FollowerItem[] }> = {
  followers: { title: 'Followers', data: MOCK_FOLLOWERS },
  fans: { title: 'Fans', data: MOCK_FANS },
  following: { title: 'Following', data: MOCK_FOLLOWING },
};

const TABS: ListType[] = ['following', 'fans', 'followers'];

export default function ListScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();
  const { list } = useLocalSearchParams<{ list?: string }>();
  const initialTab = (list === 'fans' || list === 'following' ? list : 'followers') as ListType;
  const [activeTab, setActiveTab] = useState<ListType>(initialTab);
  const { data } = useMemo(() => LIST_CONFIG[activeTab], [activeTab]);

  const renderItem = ({ item }: { item: FollowerItem }) => (
    <View style={styles.followerRow}>
      <Image source={{ uri: item.avatar }} style={styles.followerAvatar} />
      <View style={styles.followerInfo}>
        <View style={styles.followerNameRow}>
          <Text style={styles.followerName} numberOfLines={1}>{item.name}</Text>
          {item.isVerified && <BadgeCheck size={16} color={Colors.primary} fill={Colors.primary} />}
        </View>
        <Text style={styles.followerUsername} numberOfLines={1}>@{item.username}</Text>
      </View>
      <TouchableOpacity style={styles.followerFollowBtn}>
        <Text style={styles.followerFollowBtnText}>Follow</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connections</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {LIST_CONFIG[tab].title}
            </Text>
            {activeTab === tab && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
    minWidth: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: {
    width: 36,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  tabActive: {},
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -13,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  listContent: {
    paddingVertical: 12,
    paddingBottom: 40,
  },
  followerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  followerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
  },
  followerInfo: {
    flex: 1,
    minWidth: 0,
  },
  followerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  followerUsername: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  followerFollowBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followerFollowBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
