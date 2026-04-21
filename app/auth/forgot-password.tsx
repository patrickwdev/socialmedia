import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors, primaryButtonGradient } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { getPasswordRecoveryRedirectUrl } from '@/lib/passwordRecovery';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

function mapResetEmailError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('user not found') || m.includes('email not found') || m.includes('no user')) {
    return 'No account found for that email.';
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'Please enter a valid email address.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many requests. Try again in a few minutes.';
  }
  return message || 'Something went wrong. Please try again.';
}

export default function ForgotPasswordScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    setError(null);
    setSuccess(false);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    const redirectTo = getPasswordRecoveryRedirectUrl();
    const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });
    setLoading(false);
    if (err) {
      setError(mapResetEmailError(err.message ?? ''));
      return;
    }
    setSuccess(true);
  };

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
            <Text style={styles.title}>Forgot password</Text>
            <Text style={styles.subtitle}>
              {`Enter your email and we'll send you a link to choose a new password.`}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                {`If an account exists for that email, you'll receive reset instructions shortly. If the link opens Chrome but fails, use the code in the email below.`}
              </Text>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() =>
                  router.push({
                    pathname: '/auth/reset-code',
                    params: { email: email.trim() },
                  })
                }
              >
                <Text style={styles.secondaryBtnText}>Enter reset code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtnMuted} onPress={() => router.replace('/auth/login')}>
                <Text style={styles.secondaryBtnMutedText}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL</Text>
                <View style={styles.inputContainer}>
                  <Mail size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={Colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!loading}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleSend} disabled={loading}>
                <LinearGradient
                  colors={primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send reset link</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.codeLink}
                onPress={() =>
                  router.push({
                    pathname: '/auth/reset-code',
                    params: email.trim() ? { email: email.trim() } : {},
                  })
                }
                disabled={loading}
              >
                <Text style={styles.codeLinkText}>Have a code from your email?</Text>
              </TouchableOpacity>
            </View>
          )}
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
    marginBottom: 32,
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
    lineHeight: 22,
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
  primaryButton: {
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
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  successText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  secondaryBtnText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtnMuted: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  secondaryBtnMutedText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  codeLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  codeLinkText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});

