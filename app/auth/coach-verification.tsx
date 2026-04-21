import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Platform, StatusBar } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ChevronLeft, Link as LinkIcon, Upload, Building2, Briefcase } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

const COACH_ACCENT = '#059669';

export default function CoachVerificationScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();
  const [orgType, setOrgType] = useState<string>('High School');
  const [orgName, setOrgName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [linkedInLink, setLinkedInLink] = useState('');

  const orgTypes = [
    'Middle School',
    'High School',
    'College',
    'University',
    'Club / Travel',
    'Semi Pro',
    'Professional',
  ];

  const coachAffiliationLabel = (() => {
    if (orgType === 'Middle School' || orgType === 'High School') return 'school';
    if (orgType === 'College') return 'college';
    if (orgType === 'University') return 'university';
    if (orgType === 'Club / Travel') return 'team';
    if (orgType === 'Semi Pro' || orgType === 'Professional') return 'team';
    return 'team';
  })();

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Coach Verification</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.progressSection}>
          <View style={styles.progressLabels}>
            <Text style={styles.stepText}>STEP 1 OF 3</Text>
            <Text style={styles.stepName}>Credentials</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '33%' }]} />
          </View>
        </View>

        <Text style={styles.mainTitle}>Verify credentials</Text>
        <Text style={styles.description}>
          Verified coaches can showcase their program, connect with athletes, and access roster and recruiting tools.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Program / organization type</Text>
          <View style={styles.grid}>
            {orgTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeCard, orgType === type && styles.typeCardActive]}
                onPress={() => setOrgType(type)}
              >
                <Text style={[styles.typeText, orgType === type && styles.typeTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{coachAffiliationLabel.toUpperCase()}</Text>
          <View style={styles.inputGroup}>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Proof of identity</Text>
          <Text style={styles.helperText}>Link to your staff page, athletics site, or LinkedIn.</Text>
          <View style={styles.linkInputContainer}>
            <View style={styles.inputLabelRow}>
              <LinkIcon size={14} color={Colors.textSecondary} />
              <Text style={styles.inputLabelSmall}>STAFF / LINKEDIN URL</Text>
            </View>
            <TextInput
              style={styles.linkInput}
              placeholder="https://..."
              placeholderTextColor={Colors.textSecondary}
              value={linkedInLink}
              onChangeText={setLinkedInLink}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity style={styles.uploadBox}>
            <View style={styles.uploadIconContainer}>
              <Upload size={20} color={Colors.text} />
            </View>
            <Text style={styles.uploadTitle}>Upload staff ID / credentials</Text>
            <Text style={styles.uploadSubtitle}>PNG, JPG or PDF (MAX. 5MB)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <LinearGradient
              colors={['#10B981', COACH_ACCENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.continueButtonText}>Submit for verification</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            Verification requests are reviewed manually. You will receive an email once your account is approved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  backButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  progressSection: {
    marginBottom: 32,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stepName: {
    color: COACH_ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.card,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COACH_ACCENT,
    borderRadius: 3,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeCardActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    borderColor: COACH_ACCENT,
  },
  typeText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  typeTextActive: {
    color: COACH_ACCENT,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 12,
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
  helperText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  linkInputContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 16,
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
  footer: {
    marginTop: 16,
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COACH_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 16,
  },
  gradientButton: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
