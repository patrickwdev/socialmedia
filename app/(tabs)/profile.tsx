import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useThemeBackgroundStyle, useThemedStylesheet } from '@/context/ThemeContext';
import { AthleteProfileLayout } from '@/components/AthleteProfileLayout';

const screenStyles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

export default function ProfileScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const styles = useThemedStylesheet(() => ({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
  }));
  const router = useRouter();
  const isTabFocused = useIsFocused();
  const { user } = useAuth();
  const { profile, loading, error, refetch } = useProfile();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const metadata = (user?.user_metadata as {
    role?: string;
    sport_level?: string;
    team?: string;
    school?: string;
    linkedin_link?: string;
    links?: Array<{ url?: string }>;
  } | undefined) ?? {};
  const role = metadata.role;
  const teamOrSchool = profile?.team?.trim() || metadata.team?.trim() || metadata.school?.trim() || '';
  const profileLink =
    metadata.linkedin_link?.trim()
    || metadata.links?.find((item) => typeof item?.url === 'string' && item.url.trim())?.url?.trim()
    || '';
  const normalizedProfileLink =
    profileLink && /^https?:\/\//i.test(profileLink) ? profileLink : `https://${profileLink}`;
  const sportSubtitle = teamOrSchool ? `Athlete · ${teamOrSchool}` : 'Athlete';

  useEffect(() => {
    if (role === 'scout') {
      router.replace('/scout-profile');
      return;
    }
    if (role === 'coach') {
      router.replace('/coach-profile');
      return;
    }
    if (role === 'fan') {
      router.replace('/fan-profile');
      return;
    }
  }, [role, router]);

  if (role === 'scout' || role === 'coach' || role === 'fan') {
    return (
      <View style={[styles.container, screenStyles.centered, bgStyle]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  if (loading) {
    return (
      <View style={[styles.container, screenStyles.centered, bgStyle]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  if (error || !profile) {
    return (
      <View style={[styles.container, screenStyles.centered, bgStyle]}>
        <Text style={screenStyles.errorText}>{error ?? 'Could not load profile.'}</Text>
      </View>
    );
  }

  return (
    <AthleteProfileLayout
      profile={profile}
      variant="self"
      sportSubtitle={sportSubtitle}
      profileLink={profileLink}
      normalizedProfileLink={normalizedProfileLink}
      isTabFocused={isTabFocused}
    />
  );
}
