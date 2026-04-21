import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { useAuthDeepLinks } from '@/hooks/useAuthDeepLinks';
import { AuthProvider } from '@/context/AuthContext';
import { FeedPostsProvider } from '@/context/FeedPostsContext';
import { CreatePostProvider } from '@/context/CreatePostContext';
import { ThemeProvider, ThemeStatusBar, useTheme, useThemeBackgroundStyle } from '@/context/ThemeContext';

function AuthDeepLinksBridge() {
  useAuthDeepLinks();
  return null;
}

function ThemedStack() {
  const { theme } = useTheme();
  const bgStyle = useThemeBackgroundStyle();
  return (
    <View style={[{ flex: 1 }, bgStyle]}>
      <Stack key={theme} screenOptions={{ headerShown: false }} />
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ThemeProvider>
      <>
        <ThemeStatusBar />
        <AuthProvider>
          <AuthDeepLinksBridge />
          <FeedPostsProvider>
            <CreatePostProvider>
              <ThemedStack />
            </CreatePostProvider>
          </FeedPostsProvider>
        </AuthProvider>
      </>
    </ThemeProvider>
  );
}
