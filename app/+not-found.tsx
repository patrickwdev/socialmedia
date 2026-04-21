import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

export default function NotFoundScreen() {
  const bgStyle = useThemeBackgroundStyle();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, bgStyle]}>
        <Text style={styles.text}>This screen does not exist.</Text>
        <Link href="/" style={styles.link}>
          <Text>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: 600,
    color: Colors.text,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
    color: Colors.primary,
  },
});
