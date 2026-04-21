import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Colors, primaryButtonGradient } from '@/constants/Colors';
import { useRouter, Redirect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Lock, Eye, EyeOff, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { isEmailVerified } from '@/lib/emailConfirmation';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

export default function LoginScreen() {
  const router = useRouter();
  const { verified } = useLocalSearchParams<{ verified?: string | string[] }>();
  const verifiedFromEmail = verified === '1' || verified === 'true' || (Array.isArray(verified) && verified[0] === '1');
  const { signIn, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bgStyle = useThemeBackgroundStyle();

  const handleLogin = async () => {
    setError(null);
    const trimmed = emailOrUsername.trim();
    if (!trimmed || !password) {
      setError('Please enter your email or username and password.');
      return;
    }
    setLoading(true);
    let emailToUse = trimmed;
    if (!looksLikeEmail(trimmed)) {
      const { data, error: lookupError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', trimmed)
        .maybeSingle();
      if (lookupError || !data?.email) {
        setLoading(false);
        setError('Username not found. Try your email address.');
        return;
      }
      emailToUse = data.email;
    }
    const { error: err } = await signIn(emailToUse, password);
    setLoading(false);
    if (err) {
      const msg = err.message ?? '';
      if (/email not confirmed|confirm your email|email address is not confirmed|not verified/i.test(msg)) {
        router.replace({ pathname: '/auth/confirm', params: { email: emailToUse } });
        return;
      }
      setError(msg || 'Sign in failed.');
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user && !isEmailVerified(userData.user)) {
      router.replace({ pathname: '/auth/confirm', params: { email: userData.user.email ?? emailToUse } });
      return;
    }
    router.replace('/(tabs)');
  };

  if (user && isEmailVerified(user)) {
    return <Redirect href="/(tabs)" />;
  }
  if (user && !isEmailVerified(user)) {
    return <Redirect href={{ pathname: '/auth/confirm', params: { email: user.email ?? '' } }} />;
  }

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your journey.</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {verifiedFromEmail ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                {`Your email is confirmed. Sign in with your password to continue.`}
              </Text>
            </View>
          ) : null}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL OR USERNAME</Text>
                <View style={styles.inputContainer}>
                    <User size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput 
                        style={styles.input}
                        placeholder="Email or username"
                        placeholderTextColor={Colors.textSecondary}
                        value={emailOrUsername}
                        onChangeText={setEmailOrUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                    />
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.inputContainer}>
                    <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput 
                        style={styles.input}
                        placeholder="Enter your password"
                        placeholderTextColor={Colors.textSecondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        {showPassword ? (
                            <EyeOff size={20} color={Colors.textSecondary} />
                        ) : (
                            <Eye size={20} color={Colors.textSecondary} />
                        )}
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    style={styles.forgotPassword}
                    onPress={() => router.push('/auth/forgot-password')}
                >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.loginButtonText}>Sign In</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialButton}>
                    <Text style={styles.socialButtonText}>G</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton}>
                    <Text style={styles.socialButtonText}></Text>
                </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -12,
    marginBottom: 24,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  gradientButton: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 16,
    letterSpacing: 1,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  socialButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialButtonText: {
    fontSize: 24,
    color: Colors.text,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  footerLink: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  successText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});

