import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  Shield, 
  Bell, 
  Lock, 
  LayoutGrid, 
  TrendingUp, 
  HelpCircle, 
  FileText,
  File,
  Bookmark,
  LogOut, 
  ChevronRight, 
  Zap,
  Binoculars,
  Heart,
  DollarSign,
  Info,
  MessageCircle,
  BadgeCheck,
  Users,
  Moon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useThemeBackgroundStyle, useThemedStylesheet } from '@/context/ThemeContext';

export default function SettingsScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const styles = useThemedStylesheet(() => ({
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
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
    },
    backButton: {
      padding: 4,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    section: {
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.textSecondary,
      marginBottom: 12,
      letterSpacing: 1,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: Colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
    },
    settingSubtitle: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    athleteHubContainer: {
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: Colors.primary,
      position: 'relative',
      overflow: 'hidden',
    },
    athleteHubBorder: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 1,
      borderColor: Colors.primary,
      borderRadius: 16,
      opacity: 0.5,
    },
    hubItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    hubItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    hubSubtitle: {
      fontSize: 10,
      fontWeight: '700',
      color: Colors.textSecondary,
      marginTop: 4,
      letterSpacing: 0.5,
    },
    divider: {
      height: 1,
      backgroundColor: Colors.border,
      marginVertical: 12,
      marginLeft: 56,
    },
    logoutButton: {
      marginHorizontal: 16,
      backgroundColor: Colors.card,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      gap: 8,
      marginTop: 10,
      marginBottom: 30,
    },
    logoutText: {
      color: Colors.danger,
      fontSize: 16,
      fontWeight: '700',
    },
    footerInfo: {
      alignItems: 'center',
      gap: 4,
    },
    footerBrand: {
      color: Colors.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    footerVersion: {
      color: Colors.textSecondary,
      fontSize: 10,
    },
  }));
  const router = useRouter();
  const { signOut, user } = useAuth();
  const role = (user?.user_metadata as { role?: string } | undefined)?.role;
  const isAthlete = role === 'athlete';
  const isScout = role === 'scout';
  const isCoach = role === 'coach';

  const renderSettingItem = (icon: React.ReactNode, label: string, showChevron = true, subtitle?: string, onPress?: () => void) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          {icon}
        </View>
        <View>
            <Text style={styles.settingLabel}>{label}</Text>
            {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showChevron && <ChevronRight size={20} color={Colors.textSecondary} />}
    </TouchableOpacity>
  );

  const handleLogout = async () => {
    await signOut();
    router.replace('/auth/welcome');
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 28 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ACCOUNT</Text>
          {renderSettingItem(<Shield size={20} color={Colors.primary} />, "Account Security")}
          {renderSettingItem(<Bookmark size={20} color={Colors.primary} />, "Bookmarks")}
          {renderSettingItem(
            <Moon size={20} color={Colors.primary} />,
            'Dark Mode',
            true,
            undefined,
            () => router.push('/dark-mode')
          )}
          {renderSettingItem(<Bell size={20} color={Colors.primary} />, "Notification Preferences")}
          {renderSettingItem(<Lock size={20} color={Colors.primary} />, "Privacy Settings")}
          {isScout
            ? renderSettingItem(
                <BadgeCheck size={20} color={Colors.primary} />,
                'Update scout status',
                true,
                undefined,
                () => router.push('/auth/scout-verification')
              )
            : null}
          {isCoach
            ? renderSettingItem(
                <BadgeCheck size={20} color={Colors.primary} />,
                'Update coach status',
                true,
                undefined,
                () => router.push('/auth/coach-verification')
              )
            : null}
          {isAthlete ? renderSettingItem(<TrendingUp size={20} color={Colors.primary} />, "Update Sports Level") : null}
        </View>

        {isScout ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>SCOUT HUB</Text>
            {renderSettingItem(<Bookmark size={20} color={Colors.primary} />, 'Recruiting board')}
            {renderSettingItem(<File size={20} color={Colors.primary} />, 'Offers')}
            {renderSettingItem(<FileText size={20} color={Colors.primary} />, 'Notes')}
          </View>
        ) : null}

        {isCoach ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>COACH HUB</Text>
            {renderSettingItem(<Users size={20} color={Colors.primary} />, 'Roster')}
            {renderSettingItem(<FileText size={20} color={Colors.primary} />, 'Notes')}
          </View>
        ) : null}

        {/* Monetization Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MONETIZATION</Text>
          {renderSettingItem(<DollarSign size={20} color={Colors.primary} />, "Earnings & Payouts")}
        </View>

        {/* Dev Tools Section (For Demo) */}
        <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: Colors.success }]}>DEV TOOLS</Text>
            {renderSettingItem(
                <Binoculars size={20} color={Colors.success} />, 
                "View Scout Profile", 
                true, 
                "Preview the recruiter interface",
                () => router.push('/scout-profile')
            )}
            {renderSettingItem(
                <Heart size={20} color={Colors.success} />, 
                "View Fan Profile", 
                true, 
                "Preview the non-athlete interface",
                () => router.push('/fan-profile')
            )}
            {renderSettingItem(
                <LayoutGrid size={20} color={Colors.success} />, 
                "View Coach Profile", 
                true, 
                "Preview the coach interface",
                () => router.push('/coach-profile')
            )}
        </View>

        {/* Athlete Hub Section (Scout Hub label when logged in as scout) */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: Colors.accent }]}>
            {isScout ? 'SCOUT HUB' : 'ATHLETE HUB'}
          </Text>
          <LinearGradient
            colors={['rgba(37, 99, 235, 0.3)', 'rgba(37, 99, 235, 0.1)']}
            style={styles.athleteHubContainer}
          >
            <View style={styles.athleteHubBorder} />
            
            <TouchableOpacity style={styles.hubItem}>
                <View style={styles.hubItemLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: Colors.primary }]}>
                        <LayoutGrid size={20} color="white" />
                    </View>
                    <View>
                        <Text style={styles.settingLabel}>{isScout ? 'Scout Dashboard' : 'Athlete Dashboard'}</Text>
                        <Text style={styles.hubSubtitle}>EXCLUSIVE HIGHLIGHT TOOLS</Text>
                    </View>
                </View>
                <Zap size={16} color={Colors.primary} fill={Colors.primary} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.hubItem}>
                <View style={styles.hubItemLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
                        <TrendingUp size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.settingLabel}>Performance Analytics</Text>
                </View>
                <ChevronRight size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SUPPORT</Text>
          {renderSettingItem(<HelpCircle size={20} color={Colors.textSecondary} />, "Help Center")}
          {renderSettingItem(<FileText size={20} color={Colors.textSecondary} />, "Terms & Conditions")}
          {renderSettingItem(<Info size={20} color={Colors.textSecondary} />, "About Us")}
          {renderSettingItem(<MessageCircle size={20} color={Colors.textSecondary} />, "Send Feedback")}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color={Colors.danger} />
            <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.footerInfo}>
            <Text style={styles.footerBrand}>CHAMPION HIGHLIGHTS</Text>
            <Text style={styles.footerVersion}>Version 2.4.0 (2025)</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
