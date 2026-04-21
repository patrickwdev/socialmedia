import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ChevronLeft, Search } from 'lucide-react-native';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

export default function SearchScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();
  const [query, setQuery] = useState('');

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchRow}>
        <Search size={20} color={Colors.textSecondary} style={styles.searchGlyph} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find athletes or sports..."
          placeholderTextColor={Colors.textSecondary}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search athletes or sports"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            {query.trim().length > 0
              ? 'No results yet — search will connect to your feed and profiles soon.'
              : 'Type to search athletes, sports, and clips.'}
          </Text>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: {
    width: 28,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  searchGlyph: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  hint: {
    paddingVertical: 24,
  },
  hintText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
});
