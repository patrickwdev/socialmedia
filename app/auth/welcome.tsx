import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Redirect } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { isEmailVerified } from '@/lib/emailConfirmation';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  if (user && isEmailVerified(user)) {
    return <Redirect href="/(tabs)" />;
  }
  if (user && !isEmailVerified(user)) {
    return <Redirect href={{ pathname: '/auth/confirm', params: { email: user.email ?? '' } }} />;
  }

  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1000&auto=format&fit=crop' }} 
        style={styles.backgroundImage} 
      />
      <LinearGradient
        colors={['transparent', 'rgba(11, 17, 33, 0.8)', Colors.background]}
        locations={[0, 0.4, 0.8]}
        style={styles.gradient}
      />

      <View style={styles.content}>
        <View style={styles.header}>
            <View style={styles.logoContainer}>
                <Text style={styles.logoText}>CH</Text>
            </View>
            <Text style={styles.title}>CHAMPION{'\n'}HIGHLIGHTS</Text>
            <Text style={styles.subtitle}>
                The exclusive network for elite athletes to showcase talent and get discovered.
            </Text>
        </View>

        <View style={styles.actions}>
            <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => router.push('/auth/signup')}
            >
                <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    <Text style={styles.primaryButtonText}>Get Started</Text>
                    <ArrowRight size={20} color="white" />
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => router.push('/auth/login')}
            >
                <Text style={styles.secondaryButtonText}>I already have an account</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={() => router.push('/auth/forgot-password')}
            >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backgroundImage: {
    width: width,
    height: height * 0.7,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 48,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    transform: [{ rotate: '-5deg' }],
  },
  logoText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: 'white',
    lineHeight: 48,
    marginBottom: 16,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    maxWidth: '90%',
  },
  actions: {
    gap: 16,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
