import { Tabs, Redirect } from 'expo-router';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Search, Play, User, Bell, MessageCircle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';
import { isEmailVerified } from '@/lib/emailConfirmation';

const TAB_CONTENT_HEIGHT = Platform.OS === 'ios' ? 49 : 56;
const TAB_PADDING_TOP = 8;

export default function TabLayout() {
  const bgStyle = useThemeBackgroundStyle();
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarBottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);
  const tabBarHeight = TAB_CONTENT_HEIGHT + TAB_PADDING_TOP + tabBarBottomInset;

  if (loading) {
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, bgStyle]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/welcome" />;
  }

  if (!isEmailVerified(user)) {
    return <Redirect href={{ pathname: '/auth/confirm', params: { email: user.email ?? '' } }} />;
  }

  return (
    <View style={[{ flex: 1 }, bgStyle]}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: tabBarHeight,
          paddingTop: TAB_PADDING_TOP,
          paddingBottom: tabBarBottomInset,
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -5,
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clips"
        options={{
          title: 'Clips',
          tabBarIcon: ({ color, size }) => <Play size={size} color={color} style={{ marginLeft: 2 }} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
    </View>
  );
}
