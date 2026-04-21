import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Colors, primaryButtonGradient } from '@/constants/Colors';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getSignupEmailRedirectUrl, isEmailVerified } from '@/lib/emailConfirmation';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

const RESEND_COOLDOWN_SEC = 60;

function normalizeEmailParam(v: string | string[] | undefined): string {
  if (v == null) return '';
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/**
 * Shown after signUp when Supabase "Confirm email" is enabled (no session until verified).
 *
 * Supabase Dashboard:
 * - Authentication → Providers → Email → Confirm email: ON
 * - Authentication → URL Configuration → Redirect URLs: must include getSignupEmailRedirectUrl()
 *   (see console in __DEV__ or `lib/emailConfirmation.ts`; e.g. myapp://auth/confirm for release builds)
 */
export default function EmailConfirmationScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = useMemo(() => normalizeEmailParam(emailParam).trim(), [emailParam]);
  const { user, refreshSession } = useAuth();

  const [resendLoading, setResendLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  const displayEmail = initialEmail || user?.email || '';

  useEffect(() => {
    if (resendCooldownSec <= 0) return;
    const t = setTimeout(() => setResendCooldownSec((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldownSec]);

  const handleResend = async () => {
    if (!displayEmail || resendCooldownSec > 0 || resendLoading) return;
    setError(null);
    setResendSuccess(false);
    setResendLoading(true);
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: displayEmail.trim(),
      options: {
        emailRedirectTo: getSignupEmailRedirectUrl(),
      },
    });
    setResendLoading(false);
    if (err) {
      setError(err.message ?? 'Could not resend email.');
      return;
    }
    setResendSuccess(true);
    setResendCooldownSec(RESEND_COOLDOWN_SEC);
  };

  const handleAlreadyVerified = async () => {
    setError(null);
    setCheckLoading(true);
    await refreshSession();
    const { data: { user: u } } = await supabase.auth.getUser();
    setCheckLoading(false);
    if (u && isEmailVerified(u)) {
      router.replace('/(tabs)');
    } else {
      setError(
        'We still do not see a verified session. Open the link in your confirmation email on this device, or sign in after verifying.'
      );
    }
  };

  const openMailApp = useCallback(() => {
    const e = displayEmail.trim();
    void Linking.openURL(e ? `mailto:${encodeURIComponent(e)}` : 'mailto:');
  }, [displayEmail]);

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            onPress={() => router.replace('/auth/welcome')}
            style={styles.backButton}
          >
            <ChevronLeft size={28} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Almost there!</Text>
            <Text style={styles.subtitle}>
              We sent a confirmation link to your email. You need to verify before you can use the app.
            </Text>
          </View>

          <View style={styles.emailCard}>
            <Mail size={22} color={Colors.primary} style={styles.emailIcon} />
            <Text style={styles.emailLabel}>Sent to</Text>
            <Text style={styles.emailValue} selectable>
              {displayEmail || '—'}
            </Text>
          </View>

          <Text style={styles.hint}>
            Check your inbox (and spam). If the confirmation link opens Chrome but does not return to this app, open the link on the same device running the app, or sign in here after you have verified.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {resendSuccess ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>If an account exists, a new email is on the way.</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleResend}
            disabled={resendLoading || !displayEmail || resendCooldownSec > 0}
          >
            <LinearGradient
              colors={primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              {resendLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {resendCooldownSec > 0 ? `Resend in ${resendCooldownSec}s` : 'Resend confirmation email'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleAlreadyVerified}
            disabled={checkLoading}
          >
            {checkLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>{`I've already verified`}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.tertiaryButton} onPress={openMailApp}>
            <Text style={styles.tertiaryButtonText}>Open mail app</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signInLink} onPress={() => router.replace('/auth/login')}>
            <Text style={styles.signInLinkText}>Back to sign in</Text>
          </TouchableOpacity>
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
    marginBottom: 24,
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
  emailCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  emailIcon: {
    marginBottom: 8,
  },
  emailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
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
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  tertiaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  tertiaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  signInLink: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signInLinkText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
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
    lineHeight: 20,
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
    color: Colors.success,
    fontSize: 14,
    fontWeight: '600',
  },
});

