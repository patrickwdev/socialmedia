import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ChevronLeft, Sun, Moon, Check } from 'lucide-react-native';
import { useTheme, useThemeBackgroundStyle } from '@/context/ThemeContext';
import type { ThemeMode } from '@/constants/Colors';

export default function DarkModeScreen() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const bgStyle = useThemeBackgroundStyle();

  // Recreate styles when `theme` changes — `Colors` is mutated in place, so a deps-empty useMemo would freeze palette.
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        headerTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: Colors.text,
        },
        backButton: {
          padding: 4,
        },
        section: {
          paddingHorizontal: 16,
          paddingTop: 8,
        },
        sectionHeader: {
          fontSize: 12,
          fontWeight: '700',
          color: Colors.textSecondary,
          marginBottom: 8,
          letterSpacing: 1,
        },
        hint: {
          fontSize: 14,
          color: Colors.textSecondary,
          lineHeight: 20,
          marginBottom: 20,
        },
        optionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 16,
          paddingHorizontal: 14,
          marginBottom: 12,
          borderRadius: 16,
          backgroundColor: Colors.card,
          borderWidth: 1,
          borderColor: Colors.border,
        },
        optionRowSelected: {
          borderColor: Colors.primary,
          borderWidth: 2,
        },
        optionLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        },
        iconWrap: {
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: Colors.background,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: Colors.border,
        },
        iconWrapSelected: {
          backgroundColor: Colors.card,
          borderColor: Colors.primary,
        },
        optionLabel: {
          fontSize: 16,
          fontWeight: '600',
          color: Colors.text,
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- theme drives palette refresh (Colors is mutable).
    [theme]
  );

  const select = async (mode: ThemeMode) => {
    await setTheme(mode);
  };

  const renderOption = (mode: ThemeMode, label: string, icon: React.ReactNode) => {
    const selected = theme === mode;
    return (
      <TouchableOpacity
        style={[styles.optionRow, selected && styles.optionRowSelected]}
        onPress={() => select(mode)}
        activeOpacity={0.7}
      >
        <View style={styles.optionLeft}>
          <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>{icon}</View>
          <Text style={styles.optionLabel}>{label}</Text>
        </View>
        {selected ? <Check size={22} color={Colors.primary} strokeWidth={2.5} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dark mode</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>APPEARANCE</Text>
        <Text style={styles.hint}>
          Light mode uses a white background. Dark mode uses a black background.
        </Text>
        {renderOption(
          'light',
          'Light mode',
          <Sun size={20} color={theme === 'light' ? Colors.primary : Colors.textSecondary} />
        )}
        {renderOption(
          'dark',
          'Dark mode',
          <Moon size={20} color={theme === 'dark' ? Colors.primary : Colors.textSecondary} />
        )}
      </View>
    </SafeAreaView>
  );
}
