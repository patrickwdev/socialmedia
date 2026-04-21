import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { ChevronLeft, BadgeCheck, Plus, Trash2, User } from 'lucide-react-native';
import { uploadUserProfileImage } from '@/lib/profileMediaUpload';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';

const AVATARS_BUCKET = 'avatars';
const BANNERS_BUCKET = 'banners';

const DEBUG_UPLOAD = true;
function debugLog(...args: unknown[]) {
  if (DEBUG_UPLOAD) console.log('[EditProfile Upload]', ...args);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const EDIT_PANEL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.5, 380);

export interface ProfileLink {
  id: string;
  title: string;
  url: string;
}

const emptyLink = (): ProfileLink => ({
  id: Math.random().toString(36).slice(2),
  title: '',
  url: '',
});

function isValidHttpsProfileLinkUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  try {
    const parsed = new URL(s);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

type UserMetadata = {
  role?: string;
  profile_name?: string;
  full_name?: string;
  username?: string;
  sport?: string;
  bio?: string;
  location?: string;
  org_name?: string;
  organization_name?: string;
  org_type?: string;
  role_title?: string;
  linkedin_link?: string;
  links?: Array<{
    id?: string;
    title?: string;
    url?: string;
  }>;
  birthday?: string;
  banner_url?: string;
  avatar_url?: string;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshSession, setUserFromUpdate } = useAuth();
  const { profile, loading, refetch } = useProfile();
  const role = (user?.user_metadata as UserMetadata | undefined)?.role;
  const isScout = role === 'scout';
  const isCoach = role === 'coach';
  const isAthlete = role === 'athlete' || (!isScout && !isCoach && role !== 'fan');
  const meta = (user?.user_metadata ?? {}) as UserMetadata;

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [sport, setSport] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [birthday, setBirthday] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [bannerImageUri, setBannerImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editPanelLabel, setEditPanelLabel] = useState('');
  const [editPanelValue, setEditPanelValue] = useState('');
  const [editPanelKey, setEditPanelKey] = useState<string>('');
  const [editPanelMultiline, setEditPanelMultiline] = useState(false);
  const [editPanelPlaceholder, setEditPanelPlaceholder] = useState('');
  const editPanelSlideAnim = useRef(new Animated.Value(EDIT_PANEL_HEIGHT)).current;
  const bgStyle = useThemeBackgroundStyle();

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setUsername(profile.username);
      setSport(profile.sport);
      setBio(profile.bio ?? '');
      setLocation(profile.location ?? '');
      setLinks(
        (meta?.links ?? [])
          .slice(0, 1)
          .map((link) => ({
            id: link.id?.trim() || Math.random().toString(36).slice(2),
            title: link.title?.trim() ?? '',
            url: link.url?.trim() ?? '',
          }))
      );
      setBirthday(meta?.birthday?.trim() ?? '');
      if (meta?.banner_url) setBannerImageUri(meta.banner_url);
      if (meta?.avatar_url) setProfileImageUri(meta.avatar_url);
    }
  }, [profile, user?.user_metadata]);

  const addLink = () => setLinks((prev) => (prev.length > 0 ? prev : [emptyLink()]));

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access the photo library is required to change your profile photo.');
      return;
    }
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

  const handleChangeBanner = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access the photo library is required to change your banner.');
      return;
    }
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
  const removeLink = (id: string) => setLinks((prev) => prev.filter((l) => l.id !== id));
  const updateLink = (id: string, field: 'title' | 'url', value: string) => {
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const openEditPanel = (
    key: string,
    label: string,
    value: string,
    opts?: { multiline?: boolean; placeholder?: string }
  ) => {
    setEditPanelKey(key);
    setEditPanelLabel(label);
    setEditPanelValue(value);
    setEditPanelMultiline(opts?.multiline ?? false);
    setEditPanelPlaceholder(opts?.placeholder ?? '');
    setShowEditPanel(true);
    Animated.spring(editPanelSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeEditPanel = () => {
    Animated.timing(editPanelSlideAnim, {
      toValue: EDIT_PANEL_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowEditPanel(false));
  };

  const applyEditPanelValue = () => {
    const v = editPanelValue.trim();
    switch (editPanelKey) {
      case 'name': setName(v); break;
      case 'username': setUsername(v); break;
      case 'bio': setBio(v); break;
      case 'location': setLocation(v); break;
      case 'birthday': setBirthday(v); break;
      default: break;
    }
    closeEditPanel();
  };

  const handleSave = async () => {
    if (!user) return;
    setSaveError(null);
    setSaving(true);
    debugLog('handleSave start', {
      userId: user.id,
      hasProfileImageUri: !!profileImageUri,
      hasBannerImageUri: !!bannerImageUri,
      isCoach,
      profileImageUriPreview: profileImageUri?.slice(0, 50),
      bannerImageUriPreview: bannerImageUri?.slice(0, 50),
    });
    try {
      const userId = user.id;
      let avatarUrlToSave: string | undefined;
      let bannerUrlToSave: string | undefined;

      for (const link of links) {
        const hasTitle = link.title.trim().length > 0;
        const hasUrl = link.url.trim().length > 0;
        if (!hasTitle && !hasUrl) continue;
        if (!isValidHttpsProfileLinkUrl(link.url)) {
          setSaveError(
            'Each link must be a valid URL that starts with https:// (for example https://example.com).'
          );
          setSaving(false);
          return;
        }
      }

      if (profileImageUri) {
        if (profileImageUri.startsWith('http')) {
          avatarUrlToSave = profileImageUri;
          debugLog('handleSave: profile photo already http, reusing');
        } else {
          const result = await uploadUserProfileImage(profileImageUri, AVATARS_BUCKET, `${userId}/avatar.jpg`);
          debugLog('handleSave: profile photo upload result', result);
          if (result.error) {
            setSaveError(`Profile photo: ${result.error}`);
            setSaving(false);
            return;
          }
          if (result.url) avatarUrlToSave = result.url;
        }
      }
      if (bannerImageUri) {
        if (bannerImageUri.startsWith('http')) {
          bannerUrlToSave = bannerImageUri;
          debugLog('handleSave: banner already http, reusing');
        } else {
          const result = await uploadUserProfileImage(bannerImageUri, BANNERS_BUCKET, `${userId}/banner.jpg`);
          debugLog('handleSave: banner upload result', result);
          if (result.error) {
            setSaveError(`Banner: ${result.error}`);
            setSaving(false);
            return;
          }
          if (result.url) bannerUrlToSave = result.url;
        }
      }

      const baseData = {
        ...user.user_metadata,
        profile_name: name.trim(),
        username: username.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
      };
      const data: Record<string, unknown> = { ...baseData, birthday: birthday.trim() || undefined };
      const sanitizedLinks = links
        .map((link) => ({
          id: link.id?.trim() || Math.random().toString(36).slice(2),
          title: link.title.trim(),
          url: link.url.trim(),
        }))
        .filter((link) => link.title || link.url)
        .slice(0, 1);
      data.links = sanitizedLinks;
      if (avatarUrlToSave) data.avatar_url = avatarUrlToSave;
      if (bannerUrlToSave) data.banner_url = bannerUrlToSave;
      // Always send bio and location so the server persists them (undefined can be omitted in JSON)
      data.bio = bio.trim() || '';
      data.location = location.trim() || '';

      debugLog('handleSave: metadata to save', {
        avatar_url: data.avatar_url ?? '(none)',
        banner_url: data.banner_url ?? '(none)',
        bio: (data.bio as string) ? `"${String(data.bio).slice(0, 40)}..."` : '(empty)',
        location: (data.location as string) ?? '(none)',
      });

      const { data: updateResult, error } = await supabase.auth.updateUser({ data });
      debugLog('handleSave: updateUser response', {
        hasUser: !!updateResult?.user,
        error: error?.message ?? null,
      });
      if (error) {
        setSaveError(error.message);
        setSaving(false);
        return;
      }
      if (updateResult?.user) setUserFromUpdate(updateResult.user);
      await refreshSession();
      debugLog('handleSave: success, navigating to profile');
      // Navigate directly to the correct role profile to avoid intermediate redirects
      // (e.g. fan -> /(tabs)/profile -> /fan-profile) which can cause visible flicker.
      if (role === 'fan') {
        router.replace('/fan-profile');
      } else if (role === 'coach') {
        router.replace('/coach-profile');
      } else if (role === 'scout') {
        router.replace('/scout-profile');
      } else {
        router.replace('/(tabs)/profile');
      }
    } catch (e) {
      debugLog('handleSave ERROR', e);
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      if (role === 'fan') {
        router.replace('/fan-profile');
      } else if (role === 'coach') {
        router.replace('/coach-profile');
      } else if (role === 'scout') {
        router.replace('/scout-profile');
      } else {
        router.replace('/(tabs)/profile');
      }
    }
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={[styles.container, bgStyle, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <ChevronLeft size={28} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        {saveError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        ) : null}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.bannerSection}>
            <TouchableOpacity style={styles.bannerTouchable} onPress={handleChangeBanner} activeOpacity={0.9}>
              {bannerImageUri ? (
                <>
                  <Image source={{ uri: bannerImageUri }} style={styles.bannerImage} />
                  <View style={styles.bannerOverlay}>
                    <Text style={styles.bannerOverlayText}>Tap to change banner</Text>
                  </View>
                </>
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Text style={styles.bannerPlaceholderText}>Tap to add banner</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.avatarSection, styles.avatarSectionOverlap]}>
            <View style={styles.avatarContainer}>
              {(profileImageUri || profile.avatar) ? (
                <Image
                  source={{ uri: profileImageUri ?? profile.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={48} color={Colors.textSecondary} />
                  <Text style={styles.avatarPlaceholderText}>Add photo</Text>
                </View>
              )}
              {profile.isVerified && (
                <View style={styles.verifiedBadge}>
                  <BadgeCheck size={20} color="white" fill={Colors.primary} />
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.changePhotoButton} onPress={handleChangePhoto}>
              <Text style={styles.changePhotoText}>
                {profileImageUri || profile.avatar ? 'Change Profile Photo' : 'Add Profile Photo'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {isScout ? (
              <>
                <Text style={styles.label}>Profile name</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('name', 'Profile name', name, { placeholder: 'Your name' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !name && styles.fieldRowPlaceholder]} numberOfLines={1}>{name || 'Your name'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Username</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('username', 'Username', username, { placeholder: '@username' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !username && styles.fieldRowPlaceholder]} numberOfLines={1}>{username || '@username'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Bio</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('bio', 'Bio', bio, { multiline: true, placeholder: 'Tell your story...' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !bio && styles.fieldRowPlaceholder]} numberOfLines={2}>{bio || 'Tell your story...'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Location</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('location', 'Location', location, { placeholder: 'City, State or Country' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !location && styles.fieldRowPlaceholder]} numberOfLines={1}>{location || 'City, State or Country'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Links</Text>
                <Text style={styles.linksHint}>Add any links (website, social, etc.). URL must be valid and start with https://</Text>
                {links.map((link) => (
                  <View key={link.id} style={styles.linkRow}>
                    <View style={styles.linkInputs}>
                      <TextInput
                        style={[styles.input, styles.linkTitleInput]}
                        value={link.title}
                        onChangeText={(v) => updateLink(link.id, 'title', v)}
                        placeholder="Label (e.g. Website)"
                        placeholderTextColor={Colors.textSecondary}
                      />
                      <TextInput
                        style={[styles.input, styles.linkUrlInput]}
                        value={link.url}
                        onChangeText={(v) => updateLink(link.id, 'url', v)}
                        placeholder="https://..."
                        placeholderTextColor={Colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.removeLinkButton}
                      onPress={() => removeLink(link.id)}
                    >
                      <Trash2 size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                {links.length === 0 ? (
                  <TouchableOpacity style={styles.addLinkButton} onPress={addLink}>
                    <Plus size={20} color={Colors.primary} />
                    <Text style={styles.addLinkText}>Add link</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.birthdaySection}>
                  <Text style={styles.label}>Birthday</Text>
                  <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('birthday', 'Birthday', birthday, { placeholder: 'MM/DD/YYYY' })} activeOpacity={0.7}>
                    <Text style={[styles.fieldRowValue, !birthday && styles.fieldRowPlaceholder]} numberOfLines={1}>{birthday || 'MM/DD/YYYY'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : isCoach ? (
              <>
                <Text style={styles.label}>Profile name</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('name', 'Profile name', name, { placeholder: 'Display name' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !name && styles.fieldRowPlaceholder]} numberOfLines={1}>{name || 'Display name'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Username</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('username', 'Username', username, { placeholder: '@handle' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !username && styles.fieldRowPlaceholder]} numberOfLines={1}>{username || '@handle'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Bio</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('bio', 'Bio', bio, { multiline: true, placeholder: 'Tell your story...' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !bio && styles.fieldRowPlaceholder]} numberOfLines={2}>{bio || 'Tell your story...'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Location</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('location', 'Location', location, { placeholder: 'City, State or Country' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !location && styles.fieldRowPlaceholder]} numberOfLines={1}>{location || 'City, State or Country'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Links</Text>
                <Text style={styles.linksHint}>Add or remove links (label + URL). URL must be valid and start with https://</Text>
                {links.map((link) => (
                  <View key={link.id} style={styles.linkRow}>
                    <View style={styles.linkInputs}>
                      <TextInput
                        style={[styles.input, styles.linkTitleInput]}
                        value={link.title}
                        onChangeText={(v) => updateLink(link.id, 'title', v)}
                        placeholder="Label (e.g. Website)"
                        placeholderTextColor={Colors.textSecondary}
                      />
                      <TextInput
                        style={[styles.input, styles.linkUrlInput]}
                        value={link.url}
                        onChangeText={(v) => updateLink(link.id, 'url', v)}
                        placeholder="https://..."
                        placeholderTextColor={Colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.removeLinkButton}
                      onPress={() => removeLink(link.id)}
                    >
                      <Trash2 size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                {links.length === 0 ? (
                  <TouchableOpacity style={styles.addLinkButton} onPress={addLink}>
                    <Plus size={20} color={Colors.primary} />
                    <Text style={styles.addLinkText}>Add link</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.birthdaySection}>
                  <Text style={styles.label}>Birthday</Text>
                  <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('birthday', 'Birthday', birthday, { placeholder: 'MM/DD/YYYY' })} activeOpacity={0.7}>
                    <Text style={[styles.fieldRowValue, !birthday && styles.fieldRowPlaceholder]} numberOfLines={1}>{birthday || 'MM/DD/YYYY'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>Name</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('name', 'Name', name, { placeholder: 'Your name' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !name && styles.fieldRowPlaceholder]} numberOfLines={1}>{name || 'Your name'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Username</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('username', 'Username', username, { placeholder: '@username' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !username && styles.fieldRowPlaceholder]} numberOfLines={1}>{username || '@username'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Bio</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('bio', 'Bio', bio, { multiline: true, placeholder: 'Tell your story...' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !bio && styles.fieldRowPlaceholder]} numberOfLines={2}>{bio || 'Tell your story...'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Location</Text>
                <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('location', 'Location', location, { placeholder: 'City, State or Country' })} activeOpacity={0.7}>
                  <Text style={[styles.fieldRowValue, !location && styles.fieldRowPlaceholder]} numberOfLines={1}>{location || 'City, State or Country'}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Links</Text>
                <Text style={styles.linksHint}>Add any links (website, social, merch, etc.). URL must be valid and start with https://</Text>
                {links.map((link) => (
                  <View key={link.id} style={styles.linkRow}>
                    <View style={styles.linkInputs}>
                      <TextInput
                        style={[styles.input, styles.linkTitleInput]}
                        value={link.title}
                        onChangeText={(v) => updateLink(link.id, 'title', v)}
                        placeholder="Label (e.g. Website)"
                        placeholderTextColor={Colors.textSecondary}
                      />
                      <TextInput
                        style={[styles.input, styles.linkUrlInput]}
                        value={link.url}
                        onChangeText={(v) => updateLink(link.id, 'url', v)}
                        placeholder="https://..."
                        placeholderTextColor={Colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.removeLinkButton}
                      onPress={() => removeLink(link.id)}
                    >
                      <Trash2 size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                {links.length === 0 ? (
                  <TouchableOpacity style={styles.addLinkButton} onPress={addLink}>
                    <Plus size={20} color={Colors.primary} />
                    <Text style={styles.addLinkText}>Add link</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.birthdaySection}>
                  <Text style={styles.label}>Birthday</Text>
                  <TouchableOpacity style={styles.fieldRowTouchable} onPress={() => openEditPanel('birthday', 'Birthday', birthday, { placeholder: 'MM/DD/YYYY' })} activeOpacity={0.7}>
                    <Text style={[styles.fieldRowValue, !birthday && styles.fieldRowPlaceholder]} numberOfLines={1}>{birthday || 'MM/DD/YYYY'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showEditPanel}
        transparent
        animationType="none"
        onRequestClose={closeEditPanel}
        statusBarTranslucent
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeEditPanel}>
          <View style={styles.editPanelBackdrop} />
        </Pressable>
        <Animated.View
          style={[
            styles.editPanel,
            bgStyle,
            {
              height: EDIT_PANEL_HEIGHT,
              transform: [{ translateY: editPanelSlideAnim }],
            },
          ]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.editPanelInner}>
            <View style={styles.editPanelHeader}>
              <TouchableOpacity onPress={() => closeEditPanel()} style={styles.editPanelCancel} hitSlop={12}>
                <Text style={styles.editPanelCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.editPanelTitle} numberOfLines={1}>{editPanelLabel}</Text>
              <TouchableOpacity onPress={applyEditPanelValue} style={styles.editPanelDone} hitSlop={12}>
                <Text style={styles.editPanelDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.editPanelInput, editPanelMultiline && styles.editPanelInputMultiline]}
              value={editPanelValue}
              onChangeText={setEditPanelValue}
              placeholder={editPanelPlaceholder}
              placeholderTextColor={Colors.textSecondary}
              multiline={editPanelMultiline}
              numberOfLines={editPanelMultiline ? 4 : 1}
              textAlignVertical={editPanelMultiline ? 'top' : 'center'}
              autoFocus
              autoCapitalize={editPanelKey === 'username' ? 'none' : 'sentences'}
              autoCorrect={editPanelKey !== 'username'}
            />
          </Pressable>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  bannerSection: {
    paddingHorizontal: 0,
    marginTop: -16,
    marginBottom: 0,
  },
  bannerTouchable: {
    width: '100%',
    height: 280,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerPlaceholderText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerOverlayText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  avatarSectionOverlap: {
    marginTop: -56,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.background,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 2,
  },
  changePhotoButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  form: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  linksHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  linkInputs: {
    flex: 1,
    gap: 8,
  },
  linkTitleInput: {
    marginBottom: 8,
  },
  linkUrlInput: {
    marginBottom: 0,
  },
  removeLinkButton: {
    padding: 12,
    justifyContent: 'center',
    marginTop: 4,
  },
  addLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    marginTop: 4,
  },
  addLinkText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  birthdaySection: {
    marginTop: 16,
  },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
  },
  editPanelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  editPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  editPanelInner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  editPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  editPanelCancel: { padding: 4, minWidth: 60 },
  editPanelCancelText: { fontSize: 16, color: Colors.textSecondary },
  editPanelTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  editPanelDone: { padding: 4, minWidth: 60, alignItems: 'flex-end' },
  editPanelDoneText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  editPanelInput: {
    marginTop: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editPanelInputMultiline: {
    minHeight: 120,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  fieldRowTouchable: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldRowValue: {
    fontSize: 16,
    color: Colors.text,
  },
  fieldRowPlaceholder: {
    color: Colors.textSecondary,
  },
});
