import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal, Pressable, Image } from 'react-native';
import { Colors, primaryButtonGradient } from '@/constants/Colors';
import { useRouter, Redirect } from 'expo-router';
import { ChevronLeft, User, Mail, Lock, AtSign, ChevronDown, Upload, Link as LinkIcon, Building2, Briefcase, Camera, Image as ImageIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { isEmailVerified } from '@/lib/emailConfirmation';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';
import { savePendingSignupMedia } from '@/lib/pendingSignupMedia';
import { uploadUserProfileImage } from '@/lib/profileMediaUpload';

const AVATARS_BUCKET = 'avatars';
const BANNERS_BUCKET = 'banners';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, user, setUserFromUpdate, refreshSession } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9>(1);
  const [role, setRole] = useState<'athlete' | 'scout' | 'fan' | 'coach' | null>(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  // Verification (athlete)
  const [competitionLevel, setCompetitionLevel] = useState('Professional');
  const [affiliationName, setAffiliationName] = useState('');
  const [athleteProofUri, setAthleteProofUri] = useState<string | null>(null);
  const [rosterLink, setRosterLink] = useState('');
  const affiliationLabel = (() => {
    if (competitionLevel === 'Middle School' || competitionLevel === 'High School') return 'school';
    if (competitionLevel === 'Professional' || competitionLevel === 'Semi Pro') return 'team';
    if (competitionLevel === 'College') return 'college';
    if (competitionLevel === 'University') return 'university';
    if (competitionLevel === 'Club / Elite') return 'team';
    return 'team';
  })();
  // Verification (scout)
  const [orgType, setOrgType] = useState('Professional Team');
  const [orgName, setOrgName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [linkedInLink, setLinkedInLink] = useState('');
  // Verification (coach)
  const [coachOrgType, setCoachOrgType] = useState('High School');
  const [coachProofLink, setCoachProofLink] = useState('');
  const [coachProofUri, setCoachProofUri] = useState<string | null>(null);
  const coachOrgTypes = [
    'Middle School',
    'High School',
    'College',
    'University',
    'Club / Travel',
    'Semi Pro',
    'Professional',
  ] as const;

  const coachAffiliationLabel = (() => {
    if (coachOrgType === 'Middle School' || coachOrgType === 'High School') return 'school';
    if (coachOrgType === 'College') return 'college';
    if (coachOrgType === 'University') return 'university';
    if (coachOrgType === 'Club / Travel') return 'team';
    if (coachOrgType === 'Semi Pro' || coachOrgType === 'Professional') return 'team';
    return 'team';
  })();

  const roleOptions: { value: 'athlete' | 'scout' | 'fan' | 'coach'; label: string }[] = [
    { value: 'athlete', label: 'Athlete' },
    { value: 'scout', label: 'Scout' },
    { value: 'coach', label: 'Coach' },
    { value: 'fan', label: 'User' },
  ];
  const roleLabel = role == null ? '' : roleOptions.find((o) => o.value === role)?.label ?? role;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileName, setProfileName] = useState('');
  const [username, setUsername] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [bannerImageUri, setBannerImageUri] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bgStyle = useThemeBackgroundStyle();

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  if (user && isEmailVerified(user)) {
    return <Redirect href="/(tabs)" />;
  }
  // Do not Redirect unverified users here: after signUp, `handleSignUp` navigates to /auth/confirm.
  // A Redirect + the same async handler racing caused `router.replace('/(tabs)')` to run after navigation
  // and send users to the welcome screen (tabs saw `user` still null).

  const handleContinue = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      showErrorFor1Second('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showErrorFor1Second('Please enter a valid email address.');
      return;
    }
    setCheckingEmail(true);
    const { data: available, error: rpcError } = await supabase.rpc('check_email_available', {
      check_email: trimmed,
    });
    setCheckingEmail(false);
    if (rpcError) {
      showErrorFor1Second('Could not verify email. Please try again.');
      return;
    }
    if (available === false) {
      showErrorFor1Second('This email is already registered. Sign in or use a different email.');
      return;
    }
    setStep(4);
  };

  const handleContinueFromName = () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      showErrorFor1Second('Please enter your first and last name.');
      return;
    }
    setStep(5);
  };

  const showErrorFor1Second = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 1000);
  };

  const handleContinueFromProfileName = () => {
    setError(null);
    if (!profileName.trim()) {
      showErrorFor1Second('Please enter your profile name.');
      return;
    }
    setStep(6);
  };

  const handleContinueFromUsername = async () => {
    setError(null);
    const trimmed = username.trim();
    if (!trimmed) {
      showErrorFor1Second('Please enter a username.');
      return;
    }
    if (trimmed.length < 3) {
      showErrorFor1Second('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      showErrorFor1Second('Username can only contain letters, numbers, and underscores.');
      return;
    }
    setCheckingUsername(true);
    const { data: available, error: rpcError } = await supabase.rpc('check_username_available', {
      check_username: trimmed,
    });
    setCheckingUsername(false);
    if (rpcError) {
      showErrorFor1Second('Could not verify username. Please try again.');
      return;
    }
    if (available === false) {
      showErrorFor1Second('This username is already taken. Choose a different one.');
      return;
    }
    setStep(7);
  };

  const handlePickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access the photo library is required to add a profile picture.');
      return;
    }
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileImageUri(result.assets[0].uri);
    }
  };

  const handleContinueFromProfilePhoto = () => {
    setError(null);
    setStep(8);
  };

  const handlePickBannerPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access the photo library is required to add a banner.');
      return;
    }
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setBannerImageUri(result.assets[0].uri);
    }
  };

  const handleContinueFromBanner = () => {
    setError(null);
    setStep(9);
  };

  const handlePickAthleteProof = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access the photo library is required.');
      setTimeout(() => setError(null), 2000);
      return;
    }
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAthleteProofUri(result.assets[0].uri);
  };

  const handleSignUp = async () => {
    setError(null);
    if (!fullName || !email.trim() || !profileName.trim() || !username.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const metadata: Parameters<typeof signUp>[2] = {
      full_name: fullName,
      profile_name: profileName.trim(),
      role: role ?? 'athlete',
      username: username.trim(),
    };
    if (role === 'athlete') {
      const trimmed = affiliationName.trim();
      if (trimmed) metadata.team = trimmed;
    }
    if (role === 'scout') {
      metadata.org_type = orgType;
      metadata.org_name = orgName.trim();
      metadata.role_title = roleTitle.trim();
      metadata.linkedin_link = linkedInLink.trim();
    }
    if (role === 'coach') {
      metadata.org_type = coachOrgType;
      metadata.org_name = orgName.trim();
      metadata.role_title = roleTitle.trim();
      if (coachProofLink.trim()) metadata.verification_link = coachProofLink.trim();
    }
    const { data: signUpData, error: err } = await signUp(email.trim(), password, metadata);
    if (err) {
      setLoading(false);
      const msg = err.message ?? 'Sign up failed.';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('This email is already registered. Sign in or use a different email.');
      } else if (msg.toLowerCase().includes('username') && (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('already'))) {
        setError('This username is already taken. Choose a different one.');
      } else {
        setError(msg);
      }
      return;
    }

    const signedUpUser = signUpData?.user;
    if (!signedUpUser) {
      setLoading(false);
      setError('Could not create your account. Please try again.');
      return;
    }

    const hasSession = signUpData.session != null;
    // No JWT yet → typical "confirm email" flow. Session but unverified → still need confirm screen.
    if (!hasSession || !isEmailVerified(signedUpUser)) {
      await savePendingSignupMedia({
        email: email.trim(),
        profileImageUri,
        bannerImageUri,
      });
      await supabase.auth.signOut();
      setLoading(false);
      router.replace({ pathname: '/auth/confirm', params: { email: email.trim() } });
      return;
    }

    await refreshSession();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const userId = signUpData?.user?.id;
    const currentUser = signUpData?.user;
    if (userId && session && (profileImageUri || bannerImageUri)) {
      let avatarUrl: string | null = null;
      let bannerUrl: string | null = null;
      if (profileImageUri) {
        const r = await uploadUserProfileImage(profileImageUri, AVATARS_BUCKET, `${userId}/avatar.jpg`);
        if (r.error || !r.url) {
          setLoading(false);
          setError(r.error ?? 'Could not upload profile photo. You can add it later in Edit profile.');
          return;
        }
        avatarUrl = r.url;
      }
      if (bannerImageUri) {
        const r = await uploadUserProfileImage(bannerImageUri, BANNERS_BUCKET, `${userId}/banner.jpg`);
        if (r.error || !r.url) {
          setLoading(false);
          setError(r.error ?? 'Could not upload banner. You can add it later in Edit profile.');
          return;
        }
        bannerUrl = r.url;
      }
      const updateData: Record<string, unknown> = {
        ...(currentUser?.user_metadata ?? {}),
      };
      if (avatarUrl) updateData.avatar_url = avatarUrl;
      if (bannerUrl) updateData.banner_url = bannerUrl;
      const { data: updateResult, error: updateError } = await supabase.auth.updateUser({
        data: updateData as Record<string, string>,
      });
      if (!updateError && updateResult?.user) {
        setUserFromUpdate(updateResult.user);
        await refreshSession();
      }
    }
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            onPress={() => {
              if (step === 1) router.back();
              else if (step === 2) setStep(1);
              else if (step === 3) setStep(role === 'athlete' || role === 'scout' || role === 'coach' ? 2 : 1);
              else if (step === 4) setStep(3);
              else if (step === 5) setStep(4);
              else if (step === 6) setStep(5);
              else if (step === 7) setStep(6);
              else if (step === 8) setStep(7);
              else setStep(8);
            }}
            style={styles.backButton}
          >
            <ChevronLeft size={28} color={Colors.text} />
          </TouchableOpacity>

          {step === 1 ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>What describes you best?</Text>
                <Text style={styles.subtitle}>Choose your account type to get started.</Text>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>ACCOUNT TYPE</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setRoleDropdownOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dropdownTriggerText, !roleLabel && styles.dropdownPlaceholder]}>
                      {roleLabel || 'Select account type'}
                    </Text>
                    <ChevronDown size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Modal
                  visible={roleDropdownOpen}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setRoleDropdownOpen(false)}
                >
                  <Pressable style={styles.dropdownBackdrop} onPress={() => setRoleDropdownOpen(false)}>
                    <View style={styles.dropdownModal}>
                      <Text style={styles.dropdownModalTitle}>Account type</Text>
                      {roleOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.dropdownOption, role === opt.value && styles.dropdownOptionActive]}
                          onPress={() => {
                            setRole(opt.value);
                            setRoleDropdownOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.dropdownOptionText, role === opt.value && styles.dropdownOptionTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Pressable>
                </Modal>
                <TouchableOpacity
                  style={styles.signUpButton}
                  onPress={() => {
                    setError(null);
                    if (role == null) {
                      setError('Please select an account type.');
                      return;
                    }
                    if (role === 'athlete' || role === 'scout' || role === 'coach') setStep(2);
                    else setStep(3);
                  }}
                >
                  <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.signUpButtonText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : step === 2 ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>
                  {role === 'athlete' ? 'Verify your athlete status' : role === 'scout' ? 'Verify your scout status' : 'Verify your coach status'}
                </Text>
                <Text style={styles.subtitle}>
                  {role === 'athlete'
                    ? 'Upload proof of eligibility or link to your official roster. You can also skip and verify later.'
                    : role === 'scout'
                    ? 'Add your organization details and proof of identity. You can also skip and verify later.'
                    : 'Add your team or school and role. You can also skip and add later.'}
                </Text>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.form}>
                {role === 'athlete' ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>COMPETITION LEVEL</Text>
                      <View style={styles.verificationGrid}>
                        {['Professional', 'Semi Pro', 'College', 'High School', 'Middle School', 'University', 'Club / Elite'].map((level) => (
                          <TouchableOpacity
                            key={level}
                            style={[styles.verificationCard, competitionLevel === level && styles.verificationCardActive]}
                            onPress={() => setCompetitionLevel(level)}
                          >
                            <Text style={[styles.verificationCardText, competitionLevel === level && styles.verificationCardTextActive]}>{level}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>{affiliationLabel.toUpperCase()}</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.input}
                          placeholder={`Enter your ${affiliationLabel}`}
                          placeholderTextColor={Colors.textSecondary}
                          value={affiliationName}
                          onChangeText={setAffiliationName}
                          autoCapitalize="words"
                        />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>PROOF OF ELIGIBILITY</Text>
                      <View style={styles.linkInputContainer}>
                        <View style={styles.inputLabelRow}>
                          <LinkIcon size={14} color={Colors.textSecondary} />
                          <Text style={styles.inputLabelSmall}>OFFICIAL ROSTER LINK</Text>
                        </View>
                        <TextInput
                          style={styles.linkInput}
                          placeholder="https://team.com/roster/yourname"
                          placeholderTextColor={Colors.textSecondary}
                          value={rosterLink}
                          onChangeText={setRosterLink}
                          autoCapitalize="none"
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.uploadBox}
                        onPress={handlePickAthleteProof}
                        activeOpacity={0.8}
                      >
                        {athleteProofUri ? (
                          <Image source={{ uri: athleteProofUri }} style={styles.coachProofPreview} />
                        ) : (
                          <>
                            <View style={styles.uploadIconContainer}>
                              <Upload size={20} color={Colors.text} />
                            </View>
                            <Text style={styles.uploadTitle}>Upload photo ID</Text>
                            <Text style={styles.uploadSubtitle}>PNG, JPG or PDF (max 5MB)</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : role === 'coach' ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>PROGRAM / ORGANIZATION TYPE</Text>
                      <View style={styles.verificationGrid}>
                        {coachOrgTypes.map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.verificationCard, coachOrgType === type && styles.verificationCardActive]}
                            onPress={() => setCoachOrgType(type)}
                          >
                            <Text
                              style={[
                                styles.verificationCardText,
                                coachOrgType === type && styles.verificationCardTextActive,
                              ]}
                            >
                              {type}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>{coachAffiliationLabel.toUpperCase()}</Text>
                      <View style={styles.inputContainer}>
                        <Building2 size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder={`Enter your ${coachAffiliationLabel}`}
                          placeholderTextColor={Colors.textSecondary}
                          value={orgName}
                          onChangeText={setOrgName}
                          autoCapitalize="words"
                        />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <View style={styles.inputContainer}>
                        <Briefcase size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Your role (e.g. Head Coach, Assistant)"
                          placeholderTextColor={Colors.textSecondary}
                          value={roleTitle}
                          onChangeText={setRoleTitle}
                        />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>PROOF OF VERIFICATION</Text>
                      <View style={styles.linkInputContainer}>
                        <View style={styles.inputLabelRow}>
                          <LinkIcon size={14} color={Colors.textSecondary} />
                          <Text style={styles.inputLabelSmall}>ROSTER / STAFF PAGE OR LINKEDIN</Text>
                        </View>
                        <TextInput
                          style={styles.linkInput}
                          placeholder="https://..."
                          placeholderTextColor={Colors.textSecondary}
                          value={coachProofLink}
                          onChangeText={setCoachProofLink}
                          autoCapitalize="none"
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.uploadBox}
                        onPress={async () => {
                          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (status !== 'granted') {
                            setError('Permission to access the photo library is required.');
                            setTimeout(() => setError(null), 2000);
                            return;
                          }
                          const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ['images'],
                            allowsEditing: true,
                            aspect: [4, 3],
                            quality: 0.8,
                          });
                          if (!result.canceled && result.assets[0]) setCoachProofUri(result.assets[0].uri);
                        }}
                        activeOpacity={0.8}
                      >
                        {coachProofUri ? (
                          <Image source={{ uri: coachProofUri }} style={styles.coachProofPreview} />
                        ) : (
                          <>
                            <View style={styles.uploadIconContainer}>
                              <Upload size={20} color={Colors.text} />
                            </View>
                            <Text style={styles.uploadTitle}>Upload proof (e.g. staff ID, badge)</Text>
                            <Text style={styles.uploadSubtitle}>PNG, JPG or PDF (max 5MB)</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>ORGANIZATION TYPE</Text>
                      <View style={styles.verificationGrid}>
                        {['Professional Team', 'College', 'University', 'Agency', 'Media / Press'].map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.verificationCard, orgType === type && styles.verificationCardActive]}
                            onPress={() => setOrgType(type)}
                          >
                            <Text style={[styles.verificationCardText, orgType === type && styles.verificationCardTextActive]}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <View style={styles.inputContainer}>
                        <Building2 size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Organization name"
                          placeholderTextColor={Colors.textSecondary}
                          value={orgName}
                          onChangeText={setOrgName}
                        />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <View style={styles.inputContainer}>
                        <Briefcase size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Your role / title"
                          placeholderTextColor={Colors.textSecondary}
                          value={roleTitle}
                          onChangeText={setRoleTitle}
                        />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>PROOF OF IDENTITY</Text>
                      <View style={styles.linkInputContainer}>
                        <View style={styles.inputLabelRow}>
                          <LinkIcon size={14} color={Colors.textSecondary} />
                          <Text style={styles.inputLabelSmall}>LINKEDIN / STAFF URL</Text>
                        </View>
                        <TextInput
                          style={styles.linkInput}
                          placeholder="https://linkedin.com/in/yourname"
                          placeholderTextColor={Colors.textSecondary}
                          value={linkedInLink}
                          onChangeText={setLinkedInLink}
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={styles.uploadBox}>
                        <View style={styles.uploadIconContainer}>
                          <Upload size={20} color={Colors.text} />
                        </View>
                        <Text style={styles.uploadTitle}>Upload staff ID / badge</Text>
                        <Text style={styles.uploadSubtitle}>PNG, JPG or PDF (max 5MB)</Text>
                      </View>
                    </View>
                  </>
                )}
                <TouchableOpacity
                  style={styles.signUpButton}
                  onPress={() => {
                    setError(null);
                    setStep(3);
                  }}
                >
                  <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.signUpButtonText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => {
                    setError(null);
                    setStep(3);
                  }}
                >
                  <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : step === 3 ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Enter your email address</Text>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <Mail size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="user@example.com"
                      placeholderTextColor={Colors.textSecondary}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.signUpButton}
                  onPress={handleContinue}
                  disabled={checkingEmail}
                >
                  <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {checkingEmail ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.signUpButtonText}>Continue</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : step === 4 ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Enter your first and last name</Text>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <User size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="First name"
                      placeholderTextColor={Colors.textSecondary}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <User size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Last name"
                      placeholderTextColor={Colors.textSecondary}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <TouchableOpacity style={styles.signUpButton} onPress={handleContinueFromName}>
                  <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.signUpButtonText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : step === 5 ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Enter your profile name</Text>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <User size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="How you want to be known"
                      placeholderTextColor={Colors.textSecondary}
                      value={profileName}
                      onChangeText={setProfileName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <TouchableOpacity style={styles.signUpButton} onPress={handleContinueFromProfileName}>
                  <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.signUpButtonText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : step === 6 ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Enter your username</Text>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <AtSign size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="username"
                      placeholderTextColor={Colors.textSecondary}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.signUpButton}
                  onPress={handleContinueFromUsername}
                  disabled={checkingUsername}
                >
                  <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {checkingUsername ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.signUpButtonText}>Continue</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : step === 7 ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Add a profile picture</Text>
                <Text style={styles.subtitle}>Upload a photo so others can recognize you. You can skip and add one later.</Text>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.form}>
                <TouchableOpacity
                  style={styles.avatarUploadArea}
                  onPress={handlePickProfilePhoto}
                  activeOpacity={0.8}
                >
                  {profileImageUri ? (
                    <Image source={{ uri: profileImageUri }} style={styles.avatarPreview} />
                  ) : (
                    <>
                      <View style={styles.avatarUploadIconWrap}>
                        <Camera size={40} color={Colors.primary} />
                      </View>
                      <Text style={styles.avatarUploadText}>Tap to upload</Text>
                      <Text style={styles.avatarUploadSubtext}>JPG or PNG</Text>
                    </>
                  )}
                </TouchableOpacity>
                {profileImageUri ? (
                  <TouchableOpacity
                    style={styles.changePhotoButton}
                    onPress={handlePickProfilePhoto}
                  >
                    <Text style={styles.changePhotoButtonText}>Change photo</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleContinueFromProfilePhoto}
                >
                  <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.signUpButton, !profileImageUri && styles.signUpButtonDisabled]}
                  onPress={handleContinueFromProfilePhoto}
                  disabled={!profileImageUri}
                  activeOpacity={profileImageUri ? 0.8 : 1}
                >
                  <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.signUpButtonText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : step === 8 ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Add a banner picture</Text>
                <Text style={styles.subtitle}>Upload a cover photo for your profile. You can skip and add one later.</Text>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.form}>
                <TouchableOpacity
                  style={styles.bannerUploadArea}
                  onPress={handlePickBannerPhoto}
                  activeOpacity={0.8}
                >
                  {bannerImageUri ? (
                    <Image source={{ uri: bannerImageUri }} style={styles.bannerPreview} />
                  ) : (
                    <>
                      <View style={styles.bannerUploadIconWrap}>
                        <ImageIcon size={40} color={Colors.primary} />
                      </View>
                      <Text style={styles.bannerUploadText}>Tap to upload</Text>
                      <Text style={styles.bannerUploadSubtext}>Wide image works best (e.g. 3:1)</Text>
                    </>
                  )}
                </TouchableOpacity>
                {bannerImageUri ? (
                  <TouchableOpacity
                    style={styles.changePhotoButton}
                    onPress={handlePickBannerPhoto}
                  >
                    <Text style={styles.changePhotoButtonText}>Change banner</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleContinueFromBanner}
                >
                  <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.signUpButton, !bannerImageUri && styles.signUpButtonDisabled]}
                  onPress={handleContinueFromBanner}
                  disabled={!bannerImageUri}
                  activeOpacity={bannerImageUri ? 0.8 : 1}
                >
                  <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.signUpButtonText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Enter your password</Text>
              </View>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Create a strong password (6+ characters)"
                      placeholderTextColor={Colors.textSecondary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                </View>
                <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp} disabled={loading}>
                  <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.signUpButtonText}>Create Account</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.footerLink}>Sign In</Text>
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
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 56,
  },
  dropdownTriggerText: {
    color: Colors.text,
    fontSize: 16,
  },
  dropdownPlaceholder: {
    color: Colors.textSecondary,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dropdownModal: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  dropdownModalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 12,
    letterSpacing: 1,
  },
  dropdownOption: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  dropdownOptionActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  dropdownOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  dropdownOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  verificationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  verificationCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  verificationCardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: Colors.primary,
  },
  verificationCardText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  verificationCardTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  linkInputContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  inputLabelSmall: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  linkInput: {
    color: Colors.text,
    fontSize: 16,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  uploadIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  uploadSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  coachProofPreview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: Colors.card,
  },
  avatarUploadArea: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
  },
  avatarUploadIconWrap: {
    marginBottom: 8,
  },
  avatarUploadText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  avatarUploadSubtext: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  changePhotoButton: {
    alignSelf: 'center',
    marginBottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changePhotoButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  skipButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  bannerUploadArea: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  bannerPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  bannerUploadIconWrap: {
    marginBottom: 8,
  },
  bannerUploadText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerUploadSubtext: {
    color: Colors.textSecondary,
    fontSize: 12,
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
  signUpButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signUpButtonDisabled: {
    opacity: 0.45,
  },
  gradientButton: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
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
});


