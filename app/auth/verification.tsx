import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Platform, StatusBar } from 'react-native';
import { Colors, primaryButtonGradient } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, Link as LinkIcon, Upload, FileText } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

export default function VerificationScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState<string>('Professional');
  const [rosterLink, setRosterLink] = useState('');

  const levels = ['Professional', 'Collegiate', 'Varsity', 'Club / Elite'];

  const handleContinue = () => {
    // In a real app, submit verification data here
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Athlete Verification</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Progress Bar */}
        <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
                <Text style={styles.stepText}>STEP 1 OF 3</Text>
                <Text style={styles.stepName}>Basic Info</Text>
            </View>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: '33%' }]} />
            </View>
        </View>

        <Text style={styles.mainTitle}>Get Verified</Text>
        <Text style={styles.description}>
            Join our community of elite athletes. Verified accounts can share highlights, engage with scouts, and unlock exclusive profile badges.
        </Text>

        {/* Sport Selection */}
        <View style={styles.section}>
            <Text style={styles.label}>What is your sport?</Text>
            <TouchableOpacity style={styles.dropdown}>
                <Text style={styles.dropdownPlaceholder}>Select your primary sport</Text>
                <ChevronDown size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
        </View>

        {/* Competition Level */}
        <View style={styles.section}>
            <Text style={styles.label}>Competition Level</Text>
            <View style={styles.grid}>
                {levels.map((level) => (
                    <TouchableOpacity 
                        key={level}
                        style={[
                            styles.levelCard, 
                            selectedLevel === level && styles.levelCardActive
                        ]}
                        onPress={() => setSelectedLevel(level)}
                    >
                        <Text style={[
                            styles.levelText,
                            selectedLevel === level && styles.levelTextActive
                        ]}>{level}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>

        {/* Proof of Eligibility */}
        <View style={styles.section}>
            <Text style={styles.label}>Proof of Eligibility</Text>
            <Text style={styles.helperText}>Upload an ID or link to your official team roster.</Text>
            
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

            <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.uploadBox}>
                <View style={styles.uploadIconContainer}>
                    <Upload size={20} color={Colors.text} />
                </View>
                <Text style={styles.uploadTitle}>Upload Photo ID</Text>
                <Text style={styles.uploadSubtitle}>PNG, JPG or PDF (MAX. 5MB)</Text>
            </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                <LinearGradient
                    colors={primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    <Text style={styles.continueButtonText}>Continue to Next Step</Text>
                </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.disclaimer}>
                By continuing, you agree to our verification terms. Verification usually takes 24-48 hours.
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
    color: Colors.primary,
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
    backgroundColor: Colors.primary,
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
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownPlaceholder: {
    color: Colors.text,
    fontSize: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  levelCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  levelCardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: Colors.primary,
  },
  levelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  levelTextActive: {
    color: Colors.primary,
    fontWeight: '700',
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
    shadowColor: Colors.primary,
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


