import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  Share,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '@/constants/Colors';
import { CURRENT_USER } from '@/data/mock';
import { useRouter } from 'expo-router';
import { ChevronLeft, Share2, Link } from 'lucide-react-native';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

const PROFILE_URL = `https://championhighlights.com/profile/${CURRENT_USER.username}`;

export default function ShareProfileScreen() {
  const bgStyle = useThemeBackgroundStyle();
  const router = useRouter();

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out my profile: ${PROFILE_URL}`,
        url: PROFILE_URL,
        title: 'Share profile',
      });
    } catch (e) {
      if ((e as Error).message?.includes('cancel')) return;
      Alert.alert('Error', 'Could not share profile.');
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(PROFILE_URL);
      Alert.alert('Copied', 'Profile link copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Could not copy link.');
    }
  };

  const handleDownload = () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL(async (data: string) => {
      try {
        const base64 = data.replace(/^data:image\/png;base64,/, '');
        const path = `${FileSystem.cacheDirectory}profile-qr-${CURRENT_USER.username}.png`;
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: 'base64',
        });
        await Share.share({
          message: 'My profile QR code',
          url: Platform.OS === 'ios' ? path : `file://${path}`,
          title: 'Save QR code',
        });
      } catch (e) {
        Alert.alert('Error', 'Could not save QR code.');
      }
    });
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.qrWrap}>
          <QRCode
            value={PROFILE_URL}
            size={220}
            color={Colors.text}
            backgroundColor={Colors.card}
            quietZone={12}
          />
          <Text style={styles.usernameInQrBox}>@{CURRENT_USER.username}</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShareProfile} activeOpacity={0.7}>
            <Share2 size={20} color={Colors.primary} />
            <Text style={styles.actionLabel}>Share profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleCopyLink} activeOpacity={0.7}>
            <Link size={20} color={Colors.primary} />
            <Text style={styles.actionLabel}>Copy link</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
    minWidth: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  qrWrap: {
    padding: 20,
    paddingBottom: 24,
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  usernameInQrBox: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
});
