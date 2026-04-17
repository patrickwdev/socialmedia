import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useCreatePost } from '@/context/CreatePostContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

/**
 * Route /create-post opens the create-post slide-up panel and redirects to tabs.
 */
export default function CreatePostRoute() {
  const router = useRouter();
  const { open } = useCreatePost();

  useEffect(() => {
    open();
    router.replace('/(tabs)');
  }, [open, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
