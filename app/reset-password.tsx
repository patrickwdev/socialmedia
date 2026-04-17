import React, { useEffect, useState } from 'react';
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
import * as Linking from 'expo-linking';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ChevronLeft, Lock, Eye, EyeOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  tryApplyPasswordRecoveryFromUrl,
  urlLooksLikePasswordRecoveryRoute,
} from '@/lib/passwordRecovery';

const MIN_LENGTH = 8;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { session, loading: authLoading, signOut } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [linkChecked, setLinkChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (session) {
      setLinkChecked(true);
      return;
    }
    let alive = true;
    (async () => {
      const url = await Linking.getInitialURL();
      if (alive && url && urlLooksLikePasswordRecoveryRoute(url)) {
        await tryApplyPasswordRecoveryFromUrl(url);
        await supabase.auth.getSession();
      }
      if (alive) setLinkChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, [authLoading, session]);

  const handleSubmit = async () => {
    setError(null);
    const p = password.trim();
    if (p.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password: p });
    setSubmitting(false);
    if (err) {
      setError(err.message ?? 'Could not update password.');
      return;
    }
    setDone(true);
    await signOut();
    setTimeout(() => {
      router.replace('/auth/login');
    }, 2200);
  };

  const showSpinner = authLoading || (!session && !linkChecked);
  const invalidLink = linkChecked && !session && !done;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Update password</Text>
            <Text style={styles.subtitle}>Choose a new password for your account.</Text>
          </View>

          {showSpinner ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.hint}>Verifying reset link…</Text>
            </View>
          ) : null}

          {invalidLink ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                This link is invalid or has expired. Request a new one from the sign-in screen.
              </Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/auth/forgot-password')}>
                <Text style={styles.secondaryBtnText}>Forgot password</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {done ? (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Password updated</Text>
              <Text style={styles.successText}>Taking you to sign in…</Text>
            </View>
          ) : null}

          {!showSpinner && !invalidLink && !done && session ? (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>NEW PASSWORD</Text>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="At least 8 characters"
                      placeholderTextColor={Colors.textSecondary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!submitting}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <EyeOff size={20} color={Colors.textSecondary} />
                      ) : (
                        <Eye size={20} color={Colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {submitting ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Save new password</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
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
    marginBottom: 28,
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
  centerBlock: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 16,
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: 15,
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
    lineHeight: 20,
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  successTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  successText: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  secondaryBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  secondaryBtnText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
