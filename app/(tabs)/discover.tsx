import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Search, Bell, BadgeCheck, Play, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { faker } from '@faker-js/faker';
import { useThemeBackgroundStyle, useThemedStylesheet } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

// --- Mock Data ---

const CATEGORIES = ['All', 'Basketball', 'Football', 'Track', 'Tennis', 'Volleyball'];

const SUGGESTED_ATHLETES = Array.from({ length: 5 }).map((_, i) => ({
  id: i,
  name: faker.person.fullName(),
  sport: faker.helpers.arrayElement(['Shooting Guard', 'Sprints', 'Keeper', 'Quarterback']),
  avatar: faker.image.avatar(),
  isVerified: true,
}));

const TRENDING_HIGHLIGHTS = Array.from({ length: 10 }).map((_, i) => ({
  id: i,
  title: faker.lorem.words(4),
  user: {
    name: faker.person.fullName(),
    avatar: faker.image.avatar(),
  },
  image: faker.image.urlPicsumPhotos({ width: 400, height: faker.number.int({ min: 400, max: 600 }) }),
  height: faker.number.int({ min: 200, max: 320 }), // Random height for masonry effect
  isLive: faker.datatype.boolean(0.2),
  isElite: faker.datatype.boolean(0.1),
}));

export default function DiscoverScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const styles = useThemedStylesheet(() => ({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    profileIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 2,
    },
    profileIcon: {
      width: '100%',
      height: '100%',
      borderRadius: 18,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: Colors.text,
    },
    iconButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 20,
      backgroundColor: Colors.card,
    },
    notificationDot: {
      position: 'absolute',
      top: 10,
      right: 12,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.danger,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.card,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 52,
      marginHorizontal: 16,
      marginBottom: 20,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      color: Colors.text,
      fontSize: 16,
    },
    categoriesContainer: {
      paddingHorizontal: 16,
      gap: 10,
      marginBottom: 24,
    },
    categoryPill: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: Colors.card,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    categoryPillActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    categoryText: {
      color: Colors.textSecondary,
      fontWeight: '600',
      fontSize: 14,
    },
    categoryTextActive: {
      color: 'white',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
    },
    seeAllText: {
      color: Colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    suggestedContainer: {
      paddingHorizontal: 16,
      gap: 12,
    },
    athleteCard: {
      width: 140,
      backgroundColor: Colors.card,
      borderRadius: 20,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
    },
    athleteImageContainer: {
      marginBottom: 10,
      padding: 2,
      borderWidth: 2,
      borderColor: Colors.primary,
      borderRadius: 40,
    },
    athleteImage: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    athleteInfo: {
      alignItems: 'center',
      marginBottom: 12,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    athleteName: {
      color: Colors.text,
      fontWeight: '700',
      fontSize: 14,
    },
    athleteSport: {
      color: Colors.textSecondary,
      fontSize: 10,
      fontWeight: '600',
    },
    followButton: {
      backgroundColor: Colors.primary,
      width: '100%',
      paddingVertical: 8,
      borderRadius: 12,
      alignItems: 'center',
    },
    followButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '700',
    },
    masonryContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 12,
    },
    masonryColumn: {
      flex: 1,
      gap: 12,
    },
    highlightCard: {
      borderRadius: 16,
      backgroundColor: Colors.card,
      overflow: 'hidden',
      position: 'relative',
    },
    highlightImage: {
      width: '100%',
      height: '100%',
    },
    highlightGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '60%',
    },
    cardBadges: {
      position: 'absolute',
      top: 10,
      right: 10,
      alignItems: 'flex-end',
      gap: 6,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.82)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      gap: 4,
    },
    liveText: {
      color: 'white',
      fontSize: 10,
      fontWeight: '800',
    },
    eliteBadge: {
      backgroundColor: '#F59E0B',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 100,
    },
    eliteText: {
      color: 'white',
      fontSize: 9,
      fontWeight: '800',
      fontStyle: 'italic',
    },
    highlightContent: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      right: 12,
    },
    highlightTitle: {
      color: 'white',
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 8,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    highlightUser: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    highlightAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.background,
    },
    highlightUserName: {
      color: '#E2E8F0',
      fontSize: 11,
      fontWeight: '500',
    },
  }));
  const [activeCategory, setActiveCategory] = useState('All');

  // Split highlights into two columns for Masonry layout
  const leftColumn = TRENDING_HIGHLIGHTS.filter((_, i) => i % 2 === 0);
  const rightColumn = TRENDING_HIGHLIGHTS.filter((_, i) => i % 2 !== 0);

  const renderHighlightCard = (item: typeof TRENDING_HIGHLIGHTS[0]) => (
    <TouchableOpacity key={item.id} style={[styles.highlightCard, { height: item.height }]}>
      <Image source={{ uri: item.image }} style={styles.highlightImage} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.highlightGradient}
      />
      
      {/* Badges */}
      <View style={styles.cardBadges}>
        {item.isLive && (
            <View style={styles.liveBadge}>
                <Play size={10} color="white" fill="white" />
                <Text style={styles.liveText}>LIVE</Text>
            </View>
        )}
        {item.isElite && (
            <View style={styles.eliteBadge}>
                <Text style={styles.eliteText}>ELITE ONLY</Text>
            </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.highlightContent}>
        <Text style={styles.highlightTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.highlightUser}>
            <Image source={{ uri: item.user.avatar }} style={styles.highlightAvatar} />
            <Text style={styles.highlightUserName} numberOfLines={1}>{item.user.name}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                <View style={styles.profileIconContainer}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop' }} style={styles.profileIcon} />
                </View>
                <Text style={styles.headerTitle}>Explore</Text>
            </View>
            <TouchableOpacity style={styles.iconButton}>
                <Bell size={24} color={Colors.text} />
                <View style={styles.notificationDot} />
            </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
            <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput 
                placeholder="Search athletes, sports, or teams" 
                placeholderTextColor={Colors.textSecondary}
                style={styles.searchInput}
            />
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
            {CATEGORIES.map((cat) => (
                <TouchableOpacity 
                    key={cat} 
                    style={[styles.categoryPill, activeCategory === cat && styles.categoryPillActive]}
                    onPress={() => setActiveCategory(cat)}
                >
                    <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>
                        {cat}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>

        {/* Suggested Athletes */}
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Suggested Athletes</Text>
            <TouchableOpacity>
                <Text style={styles.seeAllText}>View all</Text>
            </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedContainer}>
            {SUGGESTED_ATHLETES.map((athlete) => (
                <View key={athlete.id} style={styles.athleteCard}>
                    <View style={styles.athleteImageContainer}>
                        <Image source={{ uri: athlete.avatar }} style={styles.athleteImage} />
                    </View>
                    <View style={styles.athleteInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.athleteName} numberOfLines={1}>{athlete.name.split(' ')[0]} {athlete.name.split(' ')[1]?.[0]}.</Text>
                            {athlete.isVerified && <BadgeCheck size={14} color={Colors.primary} fill={Colors.primary} stroke="white" />}
                        </View>
                        <Text style={styles.athleteSport}>{athlete.sport.toUpperCase()}</Text>
                    </View>
                    <TouchableOpacity style={styles.followButton}>
                        <Text style={styles.followButtonText}>Follow</Text>
                    </TouchableOpacity>
                </View>
            ))}
        </ScrollView>

        {/* Trending Highlights (Masonry) */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginTop: 24, marginBottom: 12 }]}>Trending Highlights</Text>
        
        <View style={styles.masonryContainer}>
            <View style={styles.masonryColumn}>
                {leftColumn.map(renderHighlightCard)}
            </View>
            <View style={styles.masonryColumn}>
                {rightColumn.map(renderHighlightCard)}
            </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
