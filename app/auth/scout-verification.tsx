import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Platform, StatusBar } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, Link as LinkIcon, Upload, Building2, Briefcase } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ScoutVerificationScreen() {
  const router = useRouter();
  const [orgType, setOrgType] = useState<string>('Professional Team');
  const [orgName, setOrgName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [linkedInLink, setLinkedInLink] = useState('');

  const orgTypes = ['Professional Team', 'Collegiate / University', 'Agency', 'Media / Press'];

  const handleContinue = () => {
    // In a real app, submit verification data here
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scout Verification</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Progress Bar */}
        <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
                <Text style={styles.stepText}>STEP 1 OF 3</Text>
                <Text style={styles.stepName}>Credentials</Text>
            </View>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: '33%' }]} />
            </View>
        </View>

        <Text style={styles.mainTitle}>Verify Credentials</Text>
        <Text style={styles.description}>
            Verified scouts get access to full athlete profiles, contact information, and advanced analytics tools.
        </Text>

        {/* Organization Type */}
        <View style={styles.section}>
            <Text style={styles.label}>Organization Type</Text>
            <View style={styles.grid}>
                {orgTypes.map((type) => (
                    <TouchableOpacity 
                        key={type}
                        style={[
                            styles.typeCard, 
                            orgType === type && styles.typeCardActive
                        ]}
                        onPress={() => setOrgType(type)}
                    >
                        <Text style={[
                            styles.typeText,
                            orgType === type && styles.typeTextActive
                        ]}>{type}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>

        {/* Organization Details */}
        <View style={styles.section}>
            <Text style={styles.label}>Organization Details</Text>
            
            <View style={styles.inputGroup}>
                <View style={styles.inputContainer}>
                    <Building2 size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                    <TextInput 
                        style={styles.input}
                        placeholder="Organization Name (e.g. LA Lakers)"
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
                        placeholder="Your Role / Title"
                        placeholderTextColor={Colors.textSecondary}
                        value={roleTitle}
                        onChangeText={setRoleTitle}
                    />
                </View>
            </View>
        </View>

        {/* Proof of Identity */}
        <View style={styles.section}>
            <Text style={styles.label}>Proof of Identity</Text>
            <Text style={styles.helperText}>Provide a link to your staff directory or LinkedIn profile.</Text>
            
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

            <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.uploadBox}>
                <View style={styles.uploadIconContainer}>
                    <Upload size={20} color={Colors.text} />
                </View>
                <Text style={styles.uploadTitle}>Upload Staff ID / Badge</Text>
                <Text style={styles.uploadSubtitle}>PNG, JPG or PDF (MAX. 5MB)</Text>
            </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    <Text style={styles.continueButtonText}>Submit for Verification</Text>
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
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: Colors.primary,
  },
  typeText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  typeTextActive: {
    color: Colors.primary,
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
