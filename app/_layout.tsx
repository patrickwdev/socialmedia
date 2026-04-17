import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { useAuthDeepLinks } from '@/hooks/useAuthDeepLinks';
import { AuthProvider } from '@/context/AuthContext';
import { FeedPostsProvider } from '@/context/FeedPostsContext';
import { CreatePostProvider } from '@/context/CreatePostContext';

function AuthDeepLinksBridge() {
  useAuthDeepLinks();
  return null;
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <AuthDeepLinksBridge />
      <FeedPostsProvider>
        <CreatePostProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </CreatePostProvider>
      </FeedPostsProvider>
    </AuthProvider>
  );
}
