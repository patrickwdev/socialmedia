import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  Dimensions,
  useWindowDimensions,
  Platform,
  Pressable,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { faker } from '@faker-js/faker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useThemeBackgroundStyle } from '@/context/ThemeContext';
import { useFeedPosts } from '@/context/FeedPostsContext';
import { useProfile } from '@/hooks/useProfile';
import { mapAuthUserToFeedUser } from '@/lib/mapAuthUserToFeedUser';
import { fetchTrendingGifs, searchGifs, type GifItem } from '@/lib/gifs';
import { PostMedia } from '@/components/PostMedia';
import {
  buildCloudinaryImageUrl,
  buildCloudinaryVideoUrl,
  uploadToCloudinary,
  type CloudinaryUploadResult,
  type CloudinaryVideoEditOptions,
} from '@/lib/cloudinary';
import type { Post, PostAsset, PostPoll } from '@/data/mock';
import {
  fetchNearbyPlaceSuggestions,
  searchPhotonPlaces,
  type LocationSuggestion,
} from '@/lib/locationSearch';
import { searchProfilesByUsername, type ProfileSearchHit } from '@/lib/searchProfiles';

/** Merges compose caption with tagged usernames into one stored caption string (no extra Post fields). */
function buildCaptionWithTags(body: string, taggedUsernames: string[]): string {
  const core = body.trim();
  const already = new Set<string>();
  for (const m of core.matchAll(/@([a-zA-Z0-9_]+)/g)) {
    const h = m[1]?.toLowerCase();
    if (h) already.add(h);
  }
  const seen = new Set<string>(already);
  const handles = taggedUsernames
    .map((u) => u.replace(/^@+/, '').trim())
    .filter(Boolean)
    .filter((u) => {
      const k = u.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((u) => `@${u}`);
  return [core, ...handles].filter(Boolean).join(' ').trim();
}

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');
const PANEL_HEIGHT = WINDOW_HEIGHT;
const TOOL_PANEL_HEIGHT = WINDOW_HEIGHT;

type PostToolPanel =
  | 'media'
  | 'highlights'
  | 'grinds'
  | 'stats'
  | 'tag'
  | 'location'
  | 'gifs'
  | 'polls'
  | 'music'
  | 'live'
  | 'visibility'
  | 'editor';
type ComposerMode = 'post' | 'clips';
type ClipsSourceChip = 'highlights' | 'grinds' | 'clips' | null;
type SelectedMedia = { uri: string; kind: 'image' | 'video'; durationMs?: number | null };
type MediaGridItem = { id: string; uri: string; kind: 'image' | 'video'; durationMs?: number | null };
type VisibilityOption = 'public' | 'followers' | 'fans' | 'none';
type PollDurationDays = 1 | 3 | 7;
type EditorFilter = NonNullable<CloudinaryVideoEditOptions['filter']>;
type EditorToolbarSection = 'crop' | 'filters' | 'grading' | 'text' | 'stickers' | 'music';

const VISIBILITY_OPTIONS: Array<{ value: VisibilityOption; label: string }> = [
  { value: 'public', label: 'Public' },
  { value: 'followers', label: 'Followers Only' },
  { value: 'fans', label: 'Fans Only' },
  { value: 'none', label: 'Only Me' },
];

const EDITOR_FILTERS: EditorFilter[] = ['none', 'enhance', 'vibrance', 'art:incognito', 'art:red_rock'];
const MEDIA_EDITOR_ENABLED = true;
const CLIP_MAX_DURATION_SECONDS = 90;
/** Slide distance for editor discard confirmation sheet (px). */
const EDITOR_DISCARD_SHEET_SLIDE = 280;

type CreatePostContextType = {
  open: () => void;
  close: () => void;
  visible: boolean;
};

const CreatePostContext = createContext<CreatePostContextType | undefined>(undefined);

export function useCreatePost() {
  const ctx = useContext(CreatePostContext);
  if (ctx === undefined) throw new Error('useCreatePost must be used within CreatePostProvider');
  return ctx;
}

function CreatePostPanelContent({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const editorMediaPreviewHeight = useMemo(
    () => Math.round(windowHeight * 0.7),
    [windowHeight],
  );
  const { user } = useAuth();
  const isCoach = (user?.user_metadata as { role?: string } | undefined)?.role === 'coach';
  const { addPost } = useFeedPosts();
  const { profile } = useProfile();
  const [caption, setCaption] = useState('');
  const [composerMode, setComposerMode] = useState<ComposerMode>('post');
  const [clipsSourceChip, setClipsSourceChip] = useState<ClipsSourceChip>(null);
  /** Highlights/Grinds: show blue shell + picker first; clip composer only after a video is chosen. */
  const [awaitingClipPicker, setAwaitingClipPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<PostToolPanel | null>(null);
  const [selectedMediaItems, setSelectedMediaItems] = useState<SelectedMedia[]>([]);
  const [pendingMediaSelection, setPendingMediaSelection] = useState<SelectedMedia[]>([]);
  const [mediaPermissionStatus, setMediaPermissionStatus] = useState<'granted' | 'denied' | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaGridItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GifItem[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [gifsError, setGifsError] = useState<string | null>(null);
  const [pendingGifSelection, setPendingGifSelection] = useState<SelectedMedia | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [visibility, setVisibility] = useState<VisibilityOption>('public');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollChoices, setPollChoices] = useState<string[]>(['', '']);
  const [pollDurationDays, setPollDurationDays] = useState<PollDurationDays>(7);
  const [postLocation, setPostLocation] = useState<string | null>(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [tagSearchResults, setTagSearchResults] = useState<ProfileSearchHit[]>([]);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);
  const [tagSearchError, setTagSearchError] = useState<string | null>(null);
  /** Tagged users for this draft; merged into `caption` on post (not a separate Post field). */
  const [taggedUsernames, setTaggedUsernames] = useState<string[]>([]);
  const [editorTargetIndex, setEditorTargetIndex] = useState<number | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorTextOverlay, setEditorTextOverlay] = useState('');
  const [editorFilter, setEditorFilter] = useState<EditorFilter>('none');
  const [editorBrightness, setEditorBrightness] = useState(0);
  const [editorContrast, setEditorContrast] = useState(0);
  const [editorSaturation, setEditorSaturation] = useState(0);
  const [editorSpeed, setEditorSpeed] = useState<1 | 0.5 | 0.25>(1);
  const [editorVolume, setEditorVolume] = useState(100);
  const [editorFadeInMs, setEditorFadeInMs] = useState(0);
  const [editorFadeOutMs, setEditorFadeOutMs] = useState(0);
  const [editorTrimStart, setEditorTrimStart] = useState('');
  const [editorTrimEnd, setEditorTrimEnd] = useState('');
  const [editorCrop, setEditorCrop] = useState<'none' | '1:1' | '4:5' | '16:9' | '9:16'>('none');
  const [editorPreviewUpload, setEditorPreviewUpload] = useState<CloudinaryUploadResult | null>(null);
  const [editorPreviewSourceUri, setEditorPreviewSourceUri] = useState<string | null>(null);
  const [editorPreviewLoading, setEditorPreviewLoading] = useState(false);
  const [editorToolbarSection, setEditorToolbarSection] = useState<EditorToolbarSection>('filters');
  const [editorDiscardSheetVisible, setEditorDiscardSheetVisible] = useState(false);
  const toolPanelTranslateY = useRef(new Animated.Value(TOOL_PANEL_HEIGHT)).current;
  const toolPanelBackdropOpacity = useRef(new Animated.Value(0)).current;
  const editorDiscardBackdropOpacity = useRef(new Animated.Value(0)).current;
  const editorDiscardSheetY = useRef(new Animated.Value(EDITOR_DISCARD_SHEET_SLIDE)).current;
  const bgStyle = useThemeBackgroundStyle();

  const resetComposerState = useCallback(() => {
    setCaption('');
    setComposerMode('post');
    setClipsSourceChip(null);
    setSelectedMediaItems([]);
    setPendingMediaSelection([]);
    setPendingGifSelection(null);
    setGifQuery('');
    setGifResults([]);
    setGifsError(null);
    setActivePreviewIndex(0);
    setVisibility('public');
    setPollQuestion('');
    setPollChoices(['', '']);
    setPollDurationDays(7);
    setEditorTargetIndex(null);
    setEditorBusy(false);
    setEditorError(null);
    setEditorTextOverlay('');
    setEditorFilter('none');
    setEditorBrightness(0);
    setEditorContrast(0);
    setEditorSaturation(0);
    setEditorSpeed(1);
    setEditorVolume(100);
    setEditorFadeInMs(0);
    setEditorFadeOutMs(0);
    setEditorTrimStart('');
    setEditorTrimEnd('');
    setEditorCrop('none');
    setEditorPreviewUpload(null);
    setEditorPreviewSourceUri(null);
    setEditorPreviewLoading(false);
    setEditorToolbarSection('filters');
    setActiveToolPanel(null);
    setAwaitingClipPicker(false);
    setEditorDiscardSheetVisible(false);
    setPostLocation(null);
    setLocationSearchQuery('');
    setLocationSuggestions([]);
    setLocationError(null);
    setLocationCoords(null);
    setLocationPermissionDenied(false);
    setTagSearchQuery('');
    setTagSearchResults([]);
    setTagSearchError(null);
    setTaggedUsernames([]);
  }, []);

  useEffect(() => {
    if (visible) {
      setCaption('');
      setComposerMode('post');
      setClipsSourceChip(null);
      setSelectedMediaItems([]);
      setPendingMediaSelection([]);
      setPendingGifSelection(null);
      setGifQuery('');
      setGifResults([]);
      setGifsError(null);
      setActivePreviewIndex(0);
      setActiveToolPanel(null);
      setPollQuestion('');
      setPollChoices(['', '']);
      setPollDurationDays(7);
      toolPanelTranslateY.setValue(TOOL_PANEL_HEIGHT);
      toolPanelBackdropOpacity.setValue(0);
      setAwaitingClipPicker(false);
      setEditorDiscardSheetVisible(false);
      setPostLocation(null);
      setLocationSearchQuery('');
      setLocationSuggestions([]);
      setLocationError(null);
      setLocationCoords(null);
      setLocationPermissionDenied(false);
      setTagSearchQuery('');
      setTagSearchResults([]);
      setTagSearchError(null);
      setTaggedUsernames([]);
      editorDiscardSheetY.setValue(EDITOR_DISCARD_SHEET_SLIDE);
      editorDiscardBackdropOpacity.setValue(0);
    }
  }, [visible, toolPanelBackdropOpacity, toolPanelTranslateY, editorDiscardSheetY, editorDiscardBackdropOpacity]);

  useEffect(() => {
    if (!editorDiscardSheetVisible) return;
    const anim = Animated.parallel([
      Animated.spring(editorDiscardSheetY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(editorDiscardBackdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [editorDiscardSheetVisible, editorDiscardSheetY, editorDiscardBackdropOpacity]);

  const loadDeviceMedia = useCallback(async (options?: { videosOnly?: boolean }) => {
    setLoadingMedia(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setMediaPermissionStatus('denied');
        setMediaAssets([]);
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: options?.videosOnly ? ['videos'] : ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: 0,
        quality: 0.85,
      });
      if (pickerResult.canceled) {
        setMediaPermissionStatus(null);
        setMediaAssets([]);
        return;
      }
      const mapped: MediaGridItem[] = pickerResult.assets.map((asset, idx) => ({
        id: `${asset.assetId ?? asset.uri}-${idx}`,
        uri: asset.uri,
        kind: asset.type === 'video' ? 'video' : 'image',
        durationMs: asset.duration ?? null,
      }));
      setMediaPermissionStatus('granted');
      setMediaAssets(mapped);
    } finally {
      setLoadingMedia(false);
    }
  }, []);

  /** On iOS/Android, open only the system picker — no in-app media sheet. */
  const openNativeMediaPicker = useCallback(async (options?: { videosOnly?: boolean; singleSelect?: boolean }) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings to attach photos and videos.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: options?.videosOnly ? ['videos'] : ['images', 'videos'],
      allowsMultipleSelection: !options?.singleSelect,
      selectionLimit: options?.singleSelect ? 1 : 0,
      quality: 0.85,
    });
    if (pickerResult.canceled) return;
    const picked: SelectedMedia[] = pickerResult.assets.map((asset) => ({
      uri: asset.uri,
      kind: asset.type === 'video' ? 'video' : 'image',
      durationMs: asset.duration ?? null,
    }));
    setSelectedMediaItems((prev) => {
      if (options?.singleSelect) return picked.slice(0, 1);
      const seen = new Set(prev.map((p) => p.uri));
      const next = [...prev];
      for (const item of picked) {
        if (!seen.has(item.uri)) {
          seen.add(item.uri);
          next.push(item);
        }
      }
      return next;
    });
    setActivePreviewIndex(0);
  }, []);

  const loadTrendingGifs = useCallback(async () => {
    setLoadingGifs(true);
    setGifsError(null);
    try {
      const results = await fetchTrendingGifs();
      setGifResults(results);
    } catch {
      setGifResults([]);
      setGifsError('Unable to load GIFs right now. Please try again.');
    } finally {
      setLoadingGifs(false);
    }
  }, []);

  const runGifSearch = useCallback(async () => {
    const trimmed = gifQuery.trim();
    if (!trimmed) {
      void loadTrendingGifs();
      return;
    }
    setLoadingGifs(true);
    setGifsError(null);
    try {
      const results = await searchGifs(trimmed);
      setGifResults(results);
    } catch {
      setGifResults([]);
      setGifsError('GIF search failed. Please try another keyword.');
    } finally {
      setLoadingGifs(false);
    }
  }, [gifQuery, loadTrendingGifs]);

  const ensureLocationCoords = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionDenied(true);
        setLocationCoords(null);
        return;
      }
      setLocationPermissionDenied(false);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    } catch {
      setLocationError('Could not read your location.');
      setLocationCoords(null);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const openToolPanel = (panel: PostToolPanel, mediaOpts?: { loadMediaVideosOnly?: boolean }) => {
    setActiveToolPanel(panel);
    if (panel === 'location') {
      setLocationSearchQuery('');
      setLocationError(null);
      if (!locationCoords) {
        void ensureLocationCoords();
      }
    }
    if (panel === 'media') {
      setPendingMediaSelection(selectedMediaItems);
      const videosOnly = mediaOpts?.loadMediaVideosOnly ?? composerMode === 'clips';
      void loadDeviceMedia({ videosOnly });
    }
    if (panel === 'gifs') {
      setPendingGifSelection(null);
      setGifQuery('');
      setGifsError(null);
      void loadTrendingGifs();
    }
    if (panel === 'tag') {
      setTagSearchQuery('');
      setTagSearchResults([]);
      setTagSearchError(null);
    }
    Animated.parallel([
      Animated.spring(toolPanelTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 11,
      }),
      Animated.timing(toolPanelBackdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleMediaPress = () => {
    if (Platform.OS === 'web') {
      openToolPanel('media');
      return;
    }
    void openNativeMediaPicker({
      videosOnly: composerMode === 'clips',
      singleSelect: composerMode === 'clips',
    });
  };

  const activateClipsComposer = useCallback(
    (source: 'highlights' | 'grinds' | 'clips') => {
      if (awaitingClipPicker) return;
      setClipsSourceChip(source);

      if (Platform.OS === 'web') {
        setComposerMode('clips');
        openToolPanel('media', { loadMediaVideosOnly: true });
        return;
      }

      setAwaitingClipPicker(true);
      void (async () => {
        try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Photo access needed', 'Allow photo library access in Settings to attach videos.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open settings', onPress: () => void Linking.openSettings() },
            ]);
            setClipsSourceChip(null);
            return;
          }
          const pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            allowsMultipleSelection: false,
            selectionLimit: 1,
            quality: 0.85,
          });
          if (pickerResult.canceled || pickerResult.assets.length === 0) {
            setClipsSourceChip(null);
            return;
          }
          const asset = pickerResult.assets[0];
          const kind = asset.type === 'video' ? 'video' : 'image';
          if (kind !== 'video') {
            Alert.alert('Video required', 'Choose a video clip for Highlights, Grinds, or Clips.');
            setClipsSourceChip(null);
            return;
          }
          const clipMedia: SelectedMedia = {
            uri: asset.uri,
            kind: 'video',
            durationMs: asset.duration ?? null,
          };
          setComposerMode('clips');
          setSelectedMediaItems([clipMedia]);
          setActivePreviewIndex(0);
          if (MEDIA_EDITOR_ENABLED) {
            openEditorPanel(0, { sourceItems: [clipMedia], initialCrop: '9:16' });
          } else {
            setEditorCrop('9:16');
          }
        } catch {
          Alert.alert('Could not open library', 'Please try again.');
          setClipsSourceChip(null);
        } finally {
          setAwaitingClipPicker(false);
        }
      })();
    },
    [awaitingClipPicker]
  );

  const openEditorPanel = (
    targetIndex: number,
    options?: { sourceItems?: SelectedMedia[]; initialCrop?: 'none' | '1:1' | '4:5' | '16:9' | '9:16' },
  ) => {
    if (!MEDIA_EDITOR_ENABLED) return;
    const items = options?.sourceItems ?? selectedMediaItems;
    if (!items[targetIndex]) return;
    setEditorTargetIndex(targetIndex);
    setEditorError(null);
    setEditorPreviewUpload(null);
    setEditorPreviewSourceUri(null);
    setEditorPreviewLoading(false);
    setEditorTextOverlay('');
    setEditorFilter('none');
    setEditorBrightness(0);
    setEditorContrast(0);
    setEditorSaturation(0);
    setEditorSpeed(1);
    setEditorVolume(100);
    setEditorFadeInMs(0);
    setEditorFadeOutMs(0);
    setEditorTrimStart('');
    setEditorTrimEnd('');
    setEditorCrop(options?.initialCrop ?? 'none');
    setEditorToolbarSection('filters');
    openToolPanel('editor');
  };

  const closeToolPanel = () => {
    if (activeToolPanel === 'media') {
      setPendingMediaSelection([]);
    }
    if (activeToolPanel === 'polls') {
      // Closing poll setup should discard poll-only attachments/draft.
      setPollQuestion('');
      setPollChoices(['', '']);
      setPollDurationDays(7);
      setSelectedMediaItems([]);
      setActivePreviewIndex(0);
    }
    if (activeToolPanel === 'gifs') {
      setPendingGifSelection(null);
      setGifQuery('');
      setGifResults([]);
      setGifsError(null);
    }
    if (activeToolPanel === 'location') {
      setLocationSearchQuery('');
      setLocationError(null);
      setLocationLoading(false);
    }
    if (activeToolPanel === 'tag') {
      setTagSearchQuery('');
      setTagSearchResults([]);
      setTagSearchError(null);
      setTagSearchLoading(false);
    }
    if (activeToolPanel === 'editor') {
      setEditorError(null);
      setEditorDiscardSheetVisible(false);
      editorDiscardSheetY.setValue(EDITOR_DISCARD_SHEET_SLIDE);
      editorDiscardBackdropOpacity.setValue(0);
    }
    Animated.parallel([
      Animated.timing(toolPanelTranslateY, {
        toValue: TOOL_PANEL_HEIGHT,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(toolPanelBackdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setActiveToolPanel(null));
  };

  const fetchLocationResults = useCallback(async () => {
    const q = locationSearchQuery.trim();
    if (!q && !locationCoords) {
      setLocationSuggestions([]);
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    try {
      if (q) {
        const rows = await searchPhotonPlaces(q, {
          lat: locationCoords?.lat,
          lon: locationCoords?.lon,
        });
        setLocationSuggestions(rows);
      } else if (locationCoords) {
        const rows = await fetchNearbyPlaceSuggestions(locationCoords.lat, locationCoords.lon);
        setLocationSuggestions(rows);
      }
    } catch {
      setLocationError('Could not load places. Try again.');
      setLocationSuggestions([]);
    } finally {
      setLocationLoading(false);
    }
  }, [locationSearchQuery, locationCoords]);

  useEffect(() => {
    if (activeToolPanel !== 'location') return;
    const q = locationSearchQuery.trim();
    if (!q && !locationCoords) return;
    const delayMs = q ? 360 : 0;
    const t = setTimeout(() => {
      void fetchLocationResults();
    }, delayMs);
    return () => clearTimeout(t);
  }, [activeToolPanel, locationSearchQuery, locationCoords, fetchLocationResults]);

  const fetchTagSearchResults = useCallback(async () => {
    const q = tagSearchQuery.trim();
    if (!q) {
      setTagSearchResults([]);
      return;
    }
    setTagSearchLoading(true);
    setTagSearchError(null);
    try {
      const rows = await searchProfilesByUsername(q, { excludeUserId: user?.id, limit: 24 });
      setTagSearchResults(rows);
    } catch {
      setTagSearchError('Could not search users. Check your connection or profile permissions.');
      setTagSearchResults([]);
    } finally {
      setTagSearchLoading(false);
    }
  }, [tagSearchQuery, user?.id]);

  useEffect(() => {
    if (activeToolPanel !== 'tag') return;
    const q = tagSearchQuery.trim();
    if (!q) {
      setTagSearchResults([]);
      setTagSearchError(null);
      return;
    }
    const delayMs = 320;
    const t = setTimeout(() => {
      void fetchTagSearchResults();
    }, delayMs);
    return () => clearTimeout(t);
  }, [activeToolPanel, tagSearchQuery, fetchTagSearchResults]);

  const openEditorDiscardSheet = useCallback(() => {
    editorDiscardSheetY.setValue(EDITOR_DISCARD_SHEET_SLIDE);
    editorDiscardBackdropOpacity.setValue(0);
    setEditorDiscardSheetVisible(true);
  }, [editorDiscardSheetY, editorDiscardBackdropOpacity]);

  const closeEditorDiscardSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(editorDiscardSheetY, {
        toValue: EDITOR_DISCARD_SHEET_SLIDE,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(editorDiscardBackdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setEditorDiscardSheetVisible(false));
  }, [editorDiscardSheetY, editorDiscardBackdropOpacity]);

  const confirmEditorDiscardDelete = useCallback(() => {
    setEditorDiscardSheetVisible(false);
    editorDiscardSheetY.setValue(EDITOR_DISCARD_SHEET_SLIDE);
    editorDiscardBackdropOpacity.setValue(0);
    toolPanelTranslateY.setValue(TOOL_PANEL_HEIGHT);
    toolPanelBackdropOpacity.setValue(0);
    resetComposerState();
  }, [
    editorDiscardSheetY,
    editorDiscardBackdropOpacity,
    toolPanelTranslateY,
    toolPanelBackdropOpacity,
    resetComposerState,
  ]);

  const commitMediaSelectionAndClose = () => {
    const committed = pendingMediaSelection.slice();
    setSelectedMediaItems(committed);
    setActivePreviewIndex(0);
    const openEditorAfterClipPick =
      composerMode === 'clips' &&
      MEDIA_EDITOR_ENABLED &&
      committed.length === 1 &&
      committed[0]?.kind === 'video';
    Animated.parallel([
      Animated.timing(toolPanelTranslateY, {
        toValue: TOOL_PANEL_HEIGHT,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(toolPanelBackdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPendingMediaSelection([]);
      setActiveToolPanel(null);
      if (openEditorAfterClipPick) {
        openEditorPanel(0, { sourceItems: committed, initialCrop: '9:16' });
      }
    });
  };

  const commitGifSelectionAndClose = () => {
    if (!pendingGifSelection) return;
    setSelectedMediaItems([pendingGifSelection]);
    setActivePreviewIndex(0);
    Animated.parallel([
      Animated.timing(toolPanelTranslateY, {
        toValue: TOOL_PANEL_HEIGHT,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(toolPanelBackdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPendingGifSelection(null);
      setActiveToolPanel(null);
    });
  };

  const setPollChoiceAt = (index: number, text: string) => {
    setPollChoices((prev) => prev.map((c, i) => (i === index ? text : c)));
  };

  const addPollChoiceRow = () => {
    setPollChoices((prev) => (prev.length < 4 ? [...prev, ''] : prev));
  };

  const removePollChoiceRow = (index: number) => {
    setPollChoices((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  };

  const savePollDraftAndClose = async () => {
    const q = pollQuestion.trim();
    const filled = pollChoices.map((c) => c.trim()).filter(Boolean);
    if (!q) {
      Alert.alert('Question required', 'Enter a question for your poll.');
      return;
    }
    if (filled.length < 2) {
      Alert.alert('Two options required', 'Add at least two answer choices.');
      return;
    }
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to post a poll.');
      return;
    }
    const base = profile ?? mapAuthUserToFeedUser(user);
    const author = {
      ...base,
      avatar: base.avatar?.trim() ? base.avatar.trim() : DEFAULT_AVATAR,
    };
    const endsAt = new Date(Date.now() + pollDurationDays * 86400000).toISOString();
    const pollPayload: PostPoll = {
      question: q,
      choices: filled,
      durationDays: pollDurationDays,
      endsAt,
    };
    const createdAt = new Date().toISOString();
    const postAssets: PostAsset[] | undefined =
      selectedMediaItems.length > 0
        ? selectedMediaItems.map((item) => ({
            uri: item.uri,
            type: item.kind === 'video' ? 'video' : 'image',
          }))
        : undefined;
    const primaryUri = postAssets?.[0]?.uri ?? '';
    const newPost: Post = {
      id: faker.string.uuid(),
      user: author,
      content: primaryUri,
      ...(postAssets ? { assets: postAssets } : {}),
      caption: buildCaptionWithTags(q, taggedUsernames),
      type: 'poll',
      poll: pollPayload,
      likes: 0,
      comments: 0,
      reposts: 0,
      shares: 0,
      timeAgo: 'Just now',
      createdAt,
      ...(postLocation ? { location: postLocation } : {}),
    };
    const posted = await addPost(newPost);
    if (!posted) {
      Alert.alert('Could not post poll', 'Check your connection and try again.');
      return;
    }
    resetComposerState();
    onClose();
  };

  const toolPanelTitle =
    activeToolPanel === 'media'
      ? 'Media'
      : activeToolPanel === 'highlights'
        ? 'Highlights'
      : activeToolPanel === 'grinds'
        ? 'Grinds'
      : activeToolPanel === 'stats'
        ? 'Stats'
      : activeToolPanel === 'tag'
        ? 'Tag'
        : activeToolPanel === 'location'
          ? 'Location'
        : activeToolPanel === 'gifs'
          ? 'GIFs'
          : activeToolPanel === 'polls'
            ? 'Polls'
            : activeToolPanel === 'music'
              ? 'Music'
            : activeToolPanel === 'live'
              ? 'Live'
            : activeToolPanel === 'visibility'
              ? 'Visibility'
              : '';

  const editorTarget = editorTargetIndex !== null ? selectedMediaItems[editorTargetIndex] : null;
  const isEditorVideo = editorTarget?.kind === 'video';
  const editorCropMap =
    editorCrop === '9:16'
      ? { width: 1080, height: 1920, crop: 'fill' as const }
      : editorCrop === '1:1'
      ? { width: 1080, height: 1080, crop: 'fill' as const }
      : editorCrop === '4:5'
        ? { width: 1080, height: 1350, crop: 'fill' as const }
        : editorCrop === '16:9'
          ? { width: 1280, height: 720, crop: 'fill' as const }
          : {};
  const previewUploadMatchesTarget =
    editorTarget &&
    editorPreviewUpload &&
    editorPreviewSourceUri &&
    editorTarget.uri === editorPreviewSourceUri
      ? editorPreviewUpload
      : null;
  const selectedClipDurationSeconds =
    composerMode === 'clips' && selectedMediaItems[0]?.durationMs
      ? Math.round((selectedMediaItems[0].durationMs ?? 0) / 1000)
      : null;

  const editorPreviewUri = useMemo(() => {
    if (!editorTarget) return null;
    if (!previewUploadMatchesTarget) return editorTarget.uri;
    if (editorTarget.kind === 'video') {
      const start = editorTrimStart.trim() ? Number(editorTrimStart.trim()) : undefined;
      const end = editorTrimEnd.trim() ? Number(editorTrimEnd.trim()) : undefined;
      return buildCloudinaryVideoUrl(previewUploadMatchesTarget.publicId, {
        ...editorCropMap,
        startOffsetSec: Number.isFinite(start) ? start : undefined,
        endOffsetSec: Number.isFinite(end) ? end : undefined,
        textOverlay: editorTextOverlay.trim() ? { text: editorTextOverlay.trim() } : undefined,
        filter: editorFilter,
        brightness: editorBrightness,
        contrast: editorContrast,
        saturation: editorSaturation,
        speed: editorSpeed,
        volumePercent: editorVolume,
        fadeInMs: editorFadeInMs > 0 ? editorFadeInMs : undefined,
        fadeOutMs: editorFadeOutMs > 0 ? editorFadeOutMs : undefined,
      });
    }
    return buildCloudinaryImageUrl(previewUploadMatchesTarget.publicId, {
      ...editorCropMap,
      textOverlay: editorTextOverlay.trim() ? { text: editorTextOverlay.trim() } : undefined,
      filter: editorFilter,
      brightness: editorBrightness,
      contrast: editorContrast,
      saturation: editorSaturation,
    });
  }, [
    editorTarget,
    previewUploadMatchesTarget,
    editorTrimStart,
    editorTrimEnd,
    editorCropMap,
    editorTextOverlay,
    editorFilter,
    editorBrightness,
    editorContrast,
    editorSaturation,
    editorSpeed,
    editorVolume,
    editorFadeInMs,
    editorFadeOutMs,
  ]);

  useEffect(() => {
    if (activeToolPanel !== 'editor' || !editorTarget) return;
    if (previewUploadMatchesTarget || editorPreviewLoading) return;
    let cancelled = false;
    setEditorPreviewLoading(true);
    setEditorError(null);
    (async () => {
      try {
        const upload = await uploadToCloudinary(editorTarget.uri, editorTarget.kind === 'video' ? 'video' : 'image');
        if (cancelled) return;
        setEditorPreviewUpload(upload);
        setEditorPreviewSourceUri(editorTarget.uri);
      } catch (e) {
        if (cancelled) return;
        setEditorError(e instanceof Error ? e.message : 'Could not load live preview.');
      } finally {
        if (!cancelled) setEditorPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeToolPanel, editorTarget, previewUploadMatchesTarget, editorPreviewLoading]);

  const applyCloudinaryEdits = async () => {
    if (editorTargetIndex === null) return;
    const target = selectedMediaItems[editorTargetIndex];
    if (!target) return;
    setEditorBusy(true);
    setEditorError(null);
    try {
      const upload =
        target.uri === editorPreviewSourceUri && editorPreviewUpload
          ? editorPreviewUpload
          : await uploadToCloudinary(target.uri, target.kind === 'video' ? 'video' : 'image');
      let nextUri = upload.secureUrl;
      if (target.kind === 'video') {
        const start = editorTrimStart.trim() ? Number(editorTrimStart.trim()) : undefined;
        const end = editorTrimEnd.trim() ? Number(editorTrimEnd.trim()) : undefined;
        nextUri = buildCloudinaryVideoUrl(upload.publicId, {
          ...editorCropMap,
          startOffsetSec: Number.isFinite(start) ? start : undefined,
          endOffsetSec: Number.isFinite(end) ? end : undefined,
          textOverlay: editorTextOverlay.trim() ? { text: editorTextOverlay.trim() } : undefined,
          filter: editorFilter,
          brightness: editorBrightness,
          contrast: editorContrast,
          saturation: editorSaturation,
          speed: editorSpeed,
          volumePercent: editorVolume,
          fadeInMs: editorFadeInMs > 0 ? editorFadeInMs : undefined,
          fadeOutMs: editorFadeOutMs > 0 ? editorFadeOutMs : undefined,
        });
      } else {
        nextUri = buildCloudinaryImageUrl(upload.publicId, {
          ...editorCropMap,
          textOverlay: editorTextOverlay.trim() ? { text: editorTextOverlay.trim() } : undefined,
          filter: editorFilter,
          brightness: editorBrightness,
          contrast: editorContrast,
          saturation: editorSaturation,
        });
      }
      setSelectedMediaItems((prev) =>
        prev.map((item, idx) => (idx === editorTargetIndex ? { ...item, uri: nextUri } : item))
      );
      closeToolPanel();
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'Could not apply edits.');
    } finally {
      setEditorBusy(false);
    }
  };

  const handlePost = async () => {
    const trimmed = caption.trim();
    const hasMedia = selectedMediaItems.length > 0;
    const hasVideo = selectedMediaItems.some((item) => item.kind === 'video');
    if (composerMode === 'clips' && !hasVideo) {
      Alert.alert('Clip video required', 'Select one vertical video to post a clip.');
      return;
    }
    if (composerMode === 'clips' && selectedMediaItems.length > 1) {
      Alert.alert('One clip at a time', 'Clips only support one video per post.');
      return;
    }
    const captionForPost = buildCaptionWithTags(trimmed, taggedUsernames);
    if (!hasMedia && !captionForPost) {
      Alert.alert('Nothing to post', 'Write something in the caption, tag someone, or attach a photo or video.');
      return;
    }
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to post.');
      return;
    }
    setSubmitting(true);
    try {
      const base = profile ?? mapAuthUserToFeedUser(user);
      const author = {
        ...base,
        avatar: base.avatar?.trim() ? base.avatar.trim() : DEFAULT_AVATAR,
      };
      const createdAt = new Date().toISOString();

      if (!hasMedia) {
        const newPost: Post = {
          id: faker.string.uuid(),
          user: author,
          content: '',
          caption: captionForPost,
          type: 'text',
          postType: composerMode,
          likes: 0,
          comments: 0,
          reposts: 0,
          shares: 0,
          timeAgo: 'Just now',
          createdAt,
          ...(postLocation ? { location: postLocation } : {}),
        };
        const posted = await addPost(newPost);
        if (!posted) {
          Alert.alert('Could not post', 'Check your connection and try again.');
          return;
        }
        resetComposerState();
        onClose();
        return;
      }

      const postAssets: PostAsset[] = selectedMediaItems.map((item) => ({
        uri: item.uri,
        type: item.kind === 'video' ? 'video' : 'image',
      }));
      const primaryMedia = postAssets[0];
      const newPost: Post = {
        id: faker.string.uuid(),
        user: author,
        content: primaryMedia.uri,
        assets: postAssets,
        caption: captionForPost,
        likes: 0,
        comments: 0,
        reposts: 0,
        shares: 0,
        timeAgo: 'Just now',
        createdAt,
        type: primaryMedia.type,
        postType: composerMode,
        ...(composerMode === 'clips'
          ? { clipsSource: clipsSourceChip ?? 'highlights' }
          : {}),
        ...(postLocation ? { location: postLocation } : {}),
      };
      const posted = await addPost(newPost);
      if (!posted) {
        Alert.alert('Could not post', 'Check your connection and try again.');
        return;
      }
      resetComposerState();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const hasMedia = selectedMediaItems.length > 0;
  const hasTextBody = caption.trim().length > 0 || taggedUsernames.length > 0;
  const hasClipVideo = composerMode === 'clips' ? selectedMediaItems.some((item) => item.kind === 'video') : true;
  const canPressPost = (hasMedia || hasTextBody) && hasClipVideo && !submitting;
  const hasPollDraft =
    pollQuestion.trim().length > 0 || pollChoices.some((c) => c.trim().length > 0);
  const hasDraftContent =
    caption.trim().length > 0 ||
    taggedUsernames.length > 0 ||
    selectedMediaItems.length > 0 ||
    hasPollDraft ||
    Boolean(postLocation);

  const handleClosePress = () => {
    if (awaitingClipPicker) {
      setAwaitingClipPicker(false);
      setClipsSourceChip(null);
      return;
    }
    if (!hasDraftContent) {
      onClose();
      return;
    }

    Alert.alert('Discard post?', 'You have unsaved content. Do you want to discard this draft?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          resetComposerState();
          onClose();
        },
      },
    ]);
  };

  return (
    <View style={[panelStyles.container, awaitingClipPicker && panelStyles.containerClipPick, bgStyle]}>
      <View
        style={[
          panelStyles.header,
          { paddingTop: insets.top + 12 },
          awaitingClipPicker && panelStyles.headerClipPick,
          bgStyle,
        ]}
      >
        {awaitingClipPicker ? <View style={panelStyles.iconButtonPlaceholder} /> : (
          <TouchableOpacity onPress={handleClosePress} style={panelStyles.iconButton}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
        <Text
          style={[
            panelStyles.headerTitle,
            awaitingClipPicker && panelStyles.headerTitleClipPick,
          ]}
        >
          {awaitingClipPicker ? '' : composerMode === 'clips' ? 'Create Clip' : 'Create Post'}
        </Text>
        <View style={panelStyles.iconButtonPlaceholder} />
      </View>

      {awaitingClipPicker ? (
        <View style={[panelStyles.clipPickFill, bgStyle]} />
      ) : (
      <ScrollView
        contentContainerStyle={[panelStyles.scrollContent, { paddingBottom: insets.bottom + 200 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={panelStyles.section}>
          {composerMode === 'clips' && clipsSourceChip ? (
            <Text style={panelStyles.clipsSourceText}>
              Posting to Clips from{' '}
              {clipsSourceChip === 'highlights'
                ? 'Highlights'
                : clipsSourceChip === 'grinds'
                  ? 'Grinds'
                  : 'Clips'}
            </Text>
          ) : null}
          <View style={panelStyles.captionComposer}>
            <TextInput
              style={panelStyles.captionInput}
              placeholder={composerMode === 'clips' ? 'Write a clip caption…' : 'Write your post or caption…'}
              placeholderTextColor={Colors.textSecondary}
              multiline
              value={caption}
              onChangeText={setCaption}
            />
          </View>
          {selectedMediaItems.length > 0 ? (
            <View style={panelStyles.previewWrap}>
              <View style={panelStyles.previewCarousel}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => {
                    const pageWidth = event.nativeEvent.layoutMeasurement.width;
                    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                    setActivePreviewIndex(nextIndex);
                  }}
                >
                  {selectedMediaItems.map((item) => (
                    <PostMedia
                      key={item.uri}
                      uri={item.uri}
                      mediaType={item.kind === 'video' ? 'video' : 'image'}
                      style={[panelStyles.previewMedia, composerMode === 'clips' ? panelStyles.previewMediaClips : null]}
                      mode="preview"
                    />
                  ))}
                </ScrollView>
                <View style={panelStyles.previewActions}>
                  {MEDIA_EDITOR_ENABLED ? (
                    <TouchableOpacity style={panelStyles.previewEditButton} onPress={() => openEditorPanel(activePreviewIndex)}>
                      <Ionicons name="create-outline" size={14} color="white" />
                      <Text style={panelStyles.previewActionText}>Edit</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={panelStyles.previewRemoveButton}
                    onPress={() =>
                      setSelectedMediaItems((prev) => {
                        const next = prev.filter((_, idx) => idx !== activePreviewIndex);
                        const nextIndex = Math.max(0, Math.min(activePreviewIndex, next.length - 1));
                        setActivePreviewIndex(nextIndex);
                        return next;
                      })
                    }
                  >
                    <Ionicons name="trash-outline" size={16} color="white" />
                  </TouchableOpacity>
                </View>
                {selectedMediaItems.length > 1 ? (
                  <View style={panelStyles.previewDots}>
                    {selectedMediaItems.map((item, idx) => (
                      <View
                        key={`${item.uri}-${idx}`}
                        style={[panelStyles.previewDot, idx === activePreviewIndex && panelStyles.previewDotActive]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              <TouchableOpacity style={panelStyles.previewAddButtonUnder} onPress={handleMediaPress}>
                <Ionicons name="add" size={15} color={Colors.text} />
                <Text style={panelStyles.previewAddText}>{composerMode === 'clips' ? 'Replace clip video' : 'Add media'}</Text>
              </TouchableOpacity>
              {composerMode === 'clips' && selectedClipDurationSeconds && selectedClipDurationSeconds > CLIP_MAX_DURATION_SECONDS ? (
                <Text style={panelStyles.clipWarningText}>
                  Clip is {selectedClipDurationSeconds}s. Recommended max is {CLIP_MAX_DURATION_SECONDS}s.
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

      </ScrollView>
      )}

      {!awaitingClipPicker ? (
        <>
      <View style={[panelStyles.bottomToolsWrap, bgStyle, { bottom: 104 + insets.bottom }]}>
        <View style={panelStyles.audienceWrap}>
          <View style={panelStyles.audienceRow}>
            <Text style={panelStyles.audienceHint}>Who can see this post?</Text>
            <TouchableOpacity
              style={panelStyles.audienceChip}
              activeOpacity={0.8}
              onPress={() => openToolPanel('visibility')}
            >
              <Ionicons name="earth-outline" size={13} color={Colors.text} />
              <Text style={panelStyles.audienceChipText}>
                {VISIBILITY_OPTIONS.find((item) => item.value === visibility)?.label ?? 'Public'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={panelStyles.bottomToolsSeparator} />
        <View style={panelStyles.postToolsRow}>
          <TouchableOpacity style={panelStyles.postToolButton} activeOpacity={0.75} onPress={handleMediaPress}>
            <Ionicons name="image-outline" size={16} color={Colors.textSecondary} />
            <Text style={panelStyles.postToolText}>Media</Text>
          </TouchableOpacity>
          {isCoach ? (
            <TouchableOpacity
              style={panelStyles.postToolButton}
              activeOpacity={0.75}
              onPress={() => activateClipsComposer('clips')}
            >
              <Ionicons name="film-outline" size={16} color={Colors.textSecondary} />
              <Text style={panelStyles.postToolText}>Clips</Text>
            </TouchableOpacity>
          ) : null}
          {!isCoach ? (
            <>
              <TouchableOpacity
                style={panelStyles.postToolButton}
                activeOpacity={0.75}
                onPress={() => activateClipsComposer('highlights')}
              >
                <Ionicons name="star-outline" size={16} color={Colors.textSecondary} />
                <Text style={panelStyles.postToolText}>Highlights</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={panelStyles.postToolButton}
                activeOpacity={0.75}
                onPress={() => activateClipsComposer('grinds')}
              >
                <Ionicons name="flash-outline" size={16} color={Colors.textSecondary} />
                <Text style={panelStyles.postToolText}>Grinds</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {composerMode !== 'clips' ? (
            <>
              {!isCoach ? (
                <TouchableOpacity style={panelStyles.postToolButton} activeOpacity={0.75} onPress={() => openToolPanel('stats')}>
                  <Ionicons name="stats-chart-outline" size={16} color={Colors.textSecondary} />
                  <Text style={panelStyles.postToolText}>Stats</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={panelStyles.postToolButton} activeOpacity={0.75} onPress={() => openToolPanel('tag')}>
                <Ionicons name="pricetag-outline" size={16} color={Colors.textSecondary} />
                <Text style={panelStyles.postToolText}>Tag</Text>
              </TouchableOpacity>
              <TouchableOpacity style={panelStyles.postToolButton} activeOpacity={0.75} onPress={() => openToolPanel('location')}>
                <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                <Text style={panelStyles.postToolText}>Location</Text>
              </TouchableOpacity>
              <TouchableOpacity style={panelStyles.postToolButton} activeOpacity={0.75} onPress={() => openToolPanel('gifs')}>
                <Ionicons name="happy-outline" size={16} color={Colors.textSecondary} />
                <Text style={panelStyles.postToolText}>GIFs</Text>
              </TouchableOpacity>
              <TouchableOpacity style={panelStyles.postToolButton} activeOpacity={0.75} onPress={() => openToolPanel('polls')}>
                <Ionicons name="bar-chart-outline" size={16} color={Colors.textSecondary} />
                <Text style={panelStyles.postToolText}>Polls</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>

      <View style={[panelStyles.footer, bgStyle, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[panelStyles.postButton, !canPressPost && panelStyles.postButtonDisabled]}
          onPress={() => void handlePost()}
          disabled={!canPressPost}
          accessibilityRole="button"
          accessibilityLabel={composerMode === 'clips' ? 'Post clip' : 'Post highlight'}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={panelStyles.postButtonText}>{composerMode === 'clips' ? 'Post Reel' : 'Post Highlight'}</Text>
              <Ionicons name="send" size={20} color="white" />
            </>
          )}
        </TouchableOpacity>
      </View>
        </>
      ) : null}

      {activeToolPanel ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeToolPanel}>
            <Animated.View style={[panelStyles.toolPanelBackdrop, { opacity: toolPanelBackdropOpacity }]} />
          </Pressable>
          <Animated.View
            style={[
              panelStyles.toolPanel,
              bgStyle,
              {
                height: TOOL_PANEL_HEIGHT,
                transform: [{ translateY: toolPanelTranslateY }],
              },
            ]}
          >
            <View style={panelStyles.toolPanelHeader}>
              <View style={[panelStyles.toolPanelHeaderSide, panelStyles.toolPanelHeaderSideLeft]}>
                <TouchableOpacity
                  onPress={activeToolPanel === 'editor' ? openEditorDiscardSheet : closeToolPanel}
                  style={panelStyles.toolPanelClose}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={panelStyles.toolPanelTitle} numberOfLines={1}>
                {toolPanelTitle}
              </Text>
              <View style={[panelStyles.toolPanelHeaderSide, panelStyles.toolPanelHeaderSideRight]}>
                {activeToolPanel === 'editor' ? (
                  <TouchableOpacity onPress={closeToolPanel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next">
                    <Text style={panelStyles.toolPanelNextText}>Next</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <View style={panelStyles.toolPanelBody}>
              {activeToolPanel === 'media' ? (
                <>
                  {loadingMedia ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : mediaPermissionStatus === 'denied' ? (
                    <View style={panelStyles.toolPanelEmptyWrap}>
                      <Text style={panelStyles.toolPanelEmptyText}>
                        Photo library access is off. Turn it on in Settings to attach photos and videos.
                      </Text>
                      {Platform.OS !== 'web' ? (
                        <TouchableOpacity style={panelStyles.webPickButton} onPress={() => void Linking.openSettings()}>
                          <Text style={panelStyles.webPickButtonText}>Open settings</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity style={panelStyles.webPickButton} onPress={() => void loadDeviceMedia()}>
                        <Text style={panelStyles.webPickButtonText}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : mediaPermissionStatus !== 'granted' || mediaAssets.length === 0 ? (
                    <View style={panelStyles.toolPanelEmptyWrap}>
                      <Text style={panelStyles.toolPanelEmptyText}>
                        {Platform.OS === 'web'
                          ? 'Select media from your device to populate this grid.'
                          : 'Choose photos and videos from your library.'}
                      </Text>
                      <TouchableOpacity style={panelStyles.webPickButton} onPress={() => void loadDeviceMedia()}>
                        <Text style={panelStyles.webPickButtonText}>Choose media</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <FlatList
                      data={mediaAssets}
                      keyExtractor={(item) => item.id}
                      numColumns={3}
                      columnWrapperStyle={panelStyles.mediaGridRow}
                      contentContainerStyle={panelStyles.mediaGridContent}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => {
                        const selected = pendingMediaSelection.some((entry) => entry.uri === item.uri);
                        return (
                          <TouchableOpacity
                            style={[panelStyles.mediaGridItem, selected && panelStyles.mediaGridItemSelected]}
                            activeOpacity={0.8}
                            onPress={() =>
                              setPendingMediaSelection((prev) => {
                                const alreadySelected = prev.some((entry) => entry.uri === item.uri);
                                if (alreadySelected) {
                                  return prev.filter((entry) => entry.uri !== item.uri);
                                }
                                if (composerMode === 'clips') {
                                  return [{ uri: item.uri, kind: item.kind, durationMs: item.durationMs ?? null }];
                                }
                                return [...prev, { uri: item.uri, kind: item.kind, durationMs: item.durationMs ?? null }];
                              })
                            }
                          >
                            <Image source={{ uri: item.uri }} style={panelStyles.mediaGridImage} />
                            {item.kind === 'video' ? (
                              <View style={panelStyles.mediaVideoBadge}>
                                <Ionicons name="videocam" size={12} color="white" />
                              </View>
                            ) : null}
                            {selected ? (
                              <View style={panelStyles.mediaSelectedBadge}>
                                <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        );
                      }}
                    />
                  )}
                  {pendingMediaSelection.length > 0 ? (
                    <TouchableOpacity style={panelStyles.mediaDoneButton} onPress={commitMediaSelectionAndClose}>
                      <Text style={panelStyles.mediaDoneButtonText}>Done</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : activeToolPanel === 'gifs' ? (
                <>
                  <View style={panelStyles.gifSearchRow}>
                    <TextInput
                      style={panelStyles.gifSearchInput}
                      placeholder="Search GIFs"
                      placeholderTextColor={Colors.textSecondary}
                      value={gifQuery}
                      onChangeText={setGifQuery}
                      onSubmitEditing={() => void runGifSearch()}
                      returnKeyType="search"
                    />
                    <TouchableOpacity style={panelStyles.gifSearchButton} onPress={() => void runGifSearch()}>
                      <Ionicons name="search" size={16} color={Colors.text} />
                    </TouchableOpacity>
                  </View>
                  {loadingGifs ? (
                    <ActivityIndicator color={Colors.primary} style={panelStyles.gifStatus} />
                  ) : gifsError ? (
                    <View style={panelStyles.toolPanelEmptyWrap}>
                      <Text style={panelStyles.toolPanelEmptyText}>{gifsError}</Text>
                      <TouchableOpacity style={panelStyles.webPickButton} onPress={() => void runGifSearch()}>
                        <Text style={panelStyles.webPickButtonText}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : gifResults.length === 0 ? (
                    <Text style={panelStyles.toolPanelEmptyText}>No GIFs found for that search.</Text>
                  ) : (
                    <FlatList
                      data={gifResults}
                      keyExtractor={(item) => item.id}
                      numColumns={2}
                      columnWrapperStyle={panelStyles.gifGridRow}
                      contentContainerStyle={panelStyles.gifGridContent}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => {
                        const selected = pendingGifSelection?.uri === item.fullUrl;
                        return (
                          <TouchableOpacity
                            style={[panelStyles.gifGridItem, selected && panelStyles.mediaGridItemSelected]}
                            activeOpacity={0.8}
                            onPress={() => setPendingGifSelection({ uri: item.fullUrl, kind: 'image' })}
                          >
                            <Image source={{ uri: item.previewUrl }} style={panelStyles.gifGridImage} />
                            {selected ? (
                              <View style={panelStyles.mediaSelectedBadge}>
                                <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        );
                      }}
                    />
                  )}
                  {pendingGifSelection ? (
                    <TouchableOpacity style={panelStyles.mediaDoneButton} onPress={commitGifSelectionAndClose}>
                      <Text style={panelStyles.mediaDoneButtonText}>Done</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : activeToolPanel === 'visibility' ? (
                <View style={panelStyles.visibilityList}>
                  {VISIBILITY_OPTIONS.map((option) => {
                    const selected = visibility === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[panelStyles.visibilityItem, selected && panelStyles.visibilityItemSelected]}
                        activeOpacity={0.8}
                        onPress={() => {
                          setVisibility(option.value);
                          closeToolPanel();
                        }}
                      >
                        <Text style={[panelStyles.visibilityItemText, selected && panelStyles.visibilityItemTextSelected]}>
                          {option.label}
                        </Text>
                        {selected ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : activeToolPanel === 'tag' ? (
                <View style={panelStyles.locationPanel}>
                  <View style={panelStyles.gifSearchRow}>
                    <TextInput
                      style={panelStyles.gifSearchInput}
                      placeholder="Search users by username"
                      placeholderTextColor={Colors.textSecondary}
                      value={tagSearchQuery}
                      onChangeText={setTagSearchQuery}
                      returnKeyType="search"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onSubmitEditing={() => void fetchTagSearchResults()}
                    />
                    <TouchableOpacity
                      style={panelStyles.gifSearchButton}
                      onPress={() => void fetchTagSearchResults()}
                      accessibilityRole="button"
                      accessibilityLabel="Search users"
                    >
                      <Ionicons name="search" size={16} color={Colors.text} />
                    </TouchableOpacity>
                  </View>
                  {taggedUsernames.length > 0 ? (
                    <View style={panelStyles.tagSelectedWrap}>
                      <Text style={panelStyles.tagSelectedLabel}>Tagged</Text>
                      <View style={panelStyles.tagChipRow}>
                        {taggedUsernames.map((u) => (
                          <View key={u.toLowerCase()} style={panelStyles.tagChip}>
                            <Text style={panelStyles.tagChipText}>@{u}</Text>
                            <TouchableOpacity
                              onPress={() => setTaggedUsernames((prev) => prev.filter((x) => x !== u))}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${u}`}
                            >
                              <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {!tagSearchQuery.trim() ? (
                    <Text style={panelStyles.locationHint}>
                      Type a username to find people on the app. Tap someone to tag them — tags show under your
                      caption on the feed (not in the caption box).
                    </Text>
                  ) : null}
                  {tagSearchLoading && tagSearchResults.length === 0 ? (
                    <ActivityIndicator color={Colors.primary} style={panelStyles.gifStatus} />
                  ) : tagSearchError && tagSearchResults.length === 0 ? (
                    <View style={panelStyles.toolPanelEmptyWrap}>
                      <Text style={panelStyles.toolPanelEmptyText}>{tagSearchError}</Text>
                      <TouchableOpacity style={panelStyles.webPickButton} onPress={() => void fetchTagSearchResults()}>
                        <Text style={panelStyles.webPickButtonText}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <FlatList
                      data={tagSearchResults}
                      keyExtractor={(item) => item.id}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={panelStyles.locationListContent}
                      ListEmptyComponent={
                        !tagSearchLoading && tagSearchQuery.trim().length > 0 ? (
                          <Text style={panelStyles.toolPanelEmptyText}>No users match that search.</Text>
                        ) : null
                      }
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={panelStyles.tagUserRow}
                          activeOpacity={0.75}
                          onPress={() => {
                            const clean = item.username.replace(/^@+/, '').trim();
                            if (!clean) return;
                            setTaggedUsernames((prev) => {
                              if (prev.some((u) => u.toLowerCase() === clean.toLowerCase())) return prev;
                              return [...prev, clean];
                            });
                            closeToolPanel();
                          }}
                        >
                          <View style={panelStyles.tagUserAvatar}>
                            <Text style={panelStyles.tagUserAvatarLetter}>
                              {item.username.replace(/^@+/, '').trim().slice(0, 1).toUpperCase() || '?'}
                            </Text>
                          </View>
                          <View style={panelStyles.locationRowTextWrap}>
                            <Text style={panelStyles.locationRowTitle} numberOfLines={1}>
                              @{item.username.replace(/^@+/, '')}
                            </Text>
                          </View>
                          <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </View>
              ) : activeToolPanel === 'location' ? (
                <View style={panelStyles.locationPanel}>
                  <View style={panelStyles.gifSearchRow}>
                    <TextInput
                      style={panelStyles.gifSearchInput}
                      placeholder="Search places"
                      placeholderTextColor={Colors.textSecondary}
                      value={locationSearchQuery}
                      onChangeText={setLocationSearchQuery}
                      returnKeyType="search"
                      onSubmitEditing={() => void fetchLocationResults()}
                    />
                    <TouchableOpacity
                      style={panelStyles.gifSearchButton}
                      onPress={() => void fetchLocationResults()}
                      accessibilityRole="button"
                      accessibilityLabel="Search places"
                    >
                      <Ionicons name="search" size={16} color={Colors.text} />
                    </TouchableOpacity>
                  </View>
                  {locationPermissionDenied ? (
                    <Text style={panelStyles.locationHint}>
                      Location access is off. Search for a place, or enable location for nearby suggestions.
                    </Text>
                  ) : null}
                  {postLocation ? (
                    <View style={panelStyles.locationSelectedRow}>
                      <Text style={panelStyles.locationSelectedText} numberOfLines={2}>
                        Selected: {postLocation}
                      </Text>
                      <TouchableOpacity onPress={() => setPostLocation(null)} hitSlop={8}>
                        <Text style={panelStyles.locationClearText}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {!locationSearchQuery.trim() ? (
                    <Text style={panelStyles.locationSectionLabel}>Near you</Text>
                  ) : null}
                  {locationLoading && locationSuggestions.length === 0 ? (
                    <ActivityIndicator color={Colors.primary} style={panelStyles.gifStatus} />
                  ) : locationError && locationSuggestions.length === 0 ? (
                    <View style={panelStyles.toolPanelEmptyWrap}>
                      <Text style={panelStyles.toolPanelEmptyText}>{locationError}</Text>
                      <TouchableOpacity style={panelStyles.webPickButton} onPress={() => void fetchLocationResults()}>
                        <Text style={panelStyles.webPickButtonText}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <FlatList
                      data={locationSuggestions}
                      keyExtractor={(item) => item.id}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={panelStyles.locationListContent}
                      ListEmptyComponent={
                        !locationLoading ? (
                          <Text style={panelStyles.toolPanelEmptyText}>
                            {!locationSearchQuery.trim() && locationPermissionDenied
                              ? 'Try searching for a city or venue.'
                              : 'No places match that search.'}
                          </Text>
                        ) : null
                      }
                      renderItem={({ item }) => {
                        const fullLabel = item.detail ? `${item.label}, ${item.detail}` : item.label;
                        return (
                          <TouchableOpacity
                            style={panelStyles.locationRow}
                            onPress={() => {
                              setPostLocation(fullLabel);
                              closeToolPanel();
                            }}
                            activeOpacity={0.75}
                          >
                            <Ionicons
                              name="location-outline"
                              size={18}
                              color={Colors.primary}
                              style={panelStyles.locationRowIcon}
                            />
                            <View style={panelStyles.locationRowTextWrap}>
                              <Text style={panelStyles.locationRowTitle} numberOfLines={2}>
                                {item.label}
                              </Text>
                              {item.detail ? (
                                <Text style={panelStyles.locationRowSubtitle} numberOfLines={2}>
                                  {item.detail}
                                </Text>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                    />
                  )}
                </View>
              ) : activeToolPanel === 'polls' ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={panelStyles.pollScrollContent}
                >
                  <Text style={panelStyles.pollSectionTitle}>Create poll</Text>
                  {selectedMediaItems.length > 0 ? (
                    <>
                      <View style={panelStyles.pollPreviewWrap}>
                        <View style={panelStyles.pollPreviewCarousel}>
                          <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={(event) => {
                              const pageWidth = event.nativeEvent.layoutMeasurement.width;
                              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                              setActivePreviewIndex(nextIndex);
                            }}
                          >
                            {selectedMediaItems.map((item) => (
                              <PostMedia
                                key={item.uri}
                                uri={item.uri}
                                mediaType={item.kind === 'video' ? 'video' : 'image'}
                                style={panelStyles.previewMedia}
                                mode="preview"
                              />
                            ))}
                          </ScrollView>
                          <View style={panelStyles.previewActions}>
                            {MEDIA_EDITOR_ENABLED ? (
                              <TouchableOpacity
                                style={panelStyles.previewEditButton}
                                onPress={() => openEditorPanel(activePreviewIndex)}
                              >
                                <Ionicons name="create-outline" size={14} color="white" />
                                <Text style={panelStyles.previewActionText}>Edit</Text>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                              style={panelStyles.previewRemoveButton}
                              onPress={() =>
                                setSelectedMediaItems((prev) => {
                                  const next = prev.filter((_, idx) => idx !== activePreviewIndex);
                                  const nextIndex = Math.max(0, Math.min(activePreviewIndex, next.length - 1));
                                  setActivePreviewIndex(nextIndex);
                                  return next;
                                })
                              }
                              accessibilityRole="button"
                              accessibilityLabel="Remove selected media"
                            >
                              <Ionicons name="trash-outline" size={16} color="white" />
                            </TouchableOpacity>
                          </View>
                          {selectedMediaItems.length > 1 ? (
                            <View style={panelStyles.previewDots}>
                              {selectedMediaItems.map((item, idx) => (
                                <View
                                  key={`${item.uri}-${idx}`}
                                  style={[panelStyles.previewDot, idx === activePreviewIndex && panelStyles.previewDotActive]}
                                />
                              ))}
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View style={panelStyles.pollMediaQuestionDivider} accessibilityRole="none" />
                    </>
                  ) : null}
                  <Text style={panelStyles.pollFieldLabel}>Question</Text>
                  <TextInput
                    style={panelStyles.pollInput}
                    placeholder="Ask something…"
                    placeholderTextColor={Colors.textSecondary}
                    value={pollQuestion}
                    onChangeText={setPollQuestion}
                    maxLength={200}
                    multiline
                  />
                  <View style={panelStyles.pollQuestionDivider} accessibilityRole="none" />
                  <Text style={panelStyles.pollFieldLabel}>Answer choices</Text>
                  {pollChoices.map((choice, idx) => (
                    <View key={`poll-opt-${idx}`} style={panelStyles.pollChoiceRow}>
                      <Text style={panelStyles.pollChoiceIndex}>{idx + 1}</Text>
                      <TextInput
                        style={panelStyles.pollChoiceInput}
                        placeholder={`Option ${idx + 1}`}
                        placeholderTextColor={Colors.textSecondary}
                        value={choice}
                        onChangeText={(t) => setPollChoiceAt(idx, t)}
                        maxLength={80}
                      />
                      {pollChoices.length > 2 ? (
                        <TouchableOpacity
                          style={panelStyles.pollRemoveChoice}
                          onPress={() => removePollChoiceRow(idx)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove option ${idx + 1}`}
                        >
                          <Ionicons name="close-circle" size={22} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      ) : (
                        <View style={panelStyles.pollRemoveChoiceSpacer} />
                      )}
                    </View>
                  ))}
                  {pollChoices.length < 4 ? (
                    <TouchableOpacity style={panelStyles.pollAddChoiceBtn} onPress={addPollChoiceRow} activeOpacity={0.75}>
                      <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                      <Text style={panelStyles.pollAddChoiceText}>Add option</Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={panelStyles.pollAfterChoicesDivider} accessibilityRole="none" />
                  <Text style={panelStyles.pollFieldLabel}>Poll duration</Text>
                  <Text style={panelStyles.pollHint}>How long people can vote before it closes.</Text>
                  <View style={panelStyles.pollDurationRow}>
                    {([1, 3, 7] as const).map((d) => {
                      const selected = pollDurationDays === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[panelStyles.pollDurationChip, selected && panelStyles.pollDurationChipSelected]}
                          onPress={() => setPollDurationDays(d)}
                          activeOpacity={0.8}
                        >
                          <Text style={[panelStyles.pollDurationChipText, selected && panelStyles.pollDurationChipTextSelected]}>
                            {d === 1 ? '1 day' : `${d} days`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={panelStyles.pollDurationMediaDivider} accessibilityRole="none" />
                  <TouchableOpacity
                    style={panelStyles.previewAddButtonUnder}
                    onPress={handleMediaPress}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Add photo or video to poll"
                  >
                    <Ionicons name="add" size={15} color={Colors.text} />
                    <Text style={panelStyles.previewAddText}>Add media</Text>
                  </TouchableOpacity>
                  <View style={panelStyles.pollMediaChipDivider} accessibilityRole="none" />
                  <TouchableOpacity
                    style={panelStyles.pollDoneButton}
                    onPress={() => void savePollDraftAndClose()}
                    activeOpacity={0.85}
                  >
                    <Text style={panelStyles.pollDoneButtonText}>Done</Text>
                  </TouchableOpacity>
                </ScrollView>
              ) : activeToolPanel === 'editor' ? (
                <View style={panelStyles.editorLayout}>
                  <ScrollView
                    style={panelStyles.editorScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={panelStyles.editorContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={[panelStyles.editorPreviewWrap, { height: editorMediaPreviewHeight }]}>
                      {editorTarget ? (
                        <PostMedia
                          uri={editorPreviewUri ?? editorTarget.uri}
                          mediaType={editorTarget.kind === 'video' ? 'video' : 'image'}
                          style={panelStyles.editorPreviewMedia}
                          mode="preview"
                        />
                      ) : (
                        <Text style={panelStyles.toolPanelEmptyText}>No media selected.</Text>
                      )}
                    </View>
                    {editorToolbarSection === 'text' ? (
                      <>
                        <Text style={panelStyles.editorSectionTitle}>Text overlay</Text>
                        <TextInput
                          style={panelStyles.editorInput}
                          placeholder="Add text overlay"
                          placeholderTextColor={Colors.textSecondary}
                          value={editorTextOverlay}
                          onChangeText={setEditorTextOverlay}
                        />
                      </>
                    ) : null}
                    {editorToolbarSection === 'filters' ? (
                      <>
                        <Text style={panelStyles.editorSectionTitle}>Filters</Text>
                        <View style={panelStyles.editorOptionRow}>
                          {EDITOR_FILTERS.map((filter) => (
                            <TouchableOpacity
                              key={filter}
                              style={[panelStyles.editorPill, editorFilter === filter && panelStyles.editorPillSelected]}
                              onPress={() => setEditorFilter(filter)}
                            >
                              <Text
                                style={[
                                  panelStyles.editorPillText,
                                  editorFilter === filter && panelStyles.editorPillTextSelected,
                                ]}
                              >
                                {filter === 'none' ? 'None' : filter.replace('art:', '')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    ) : null}
                    {editorToolbarSection === 'grading' ? (
                      <>
                        <Text style={panelStyles.editorSectionTitle}>Color grading</Text>
                        <View style={panelStyles.editorStepperRow}>
                          <Text style={panelStyles.editorStepperLabel}>Brightness: {editorBrightness}</Text>
                          <View style={panelStyles.editorStepperActions}>
                            <TouchableOpacity
                              style={panelStyles.editorStepBtn}
                              onPress={() => setEditorBrightness((v) => v - 10)}
                            >
                              <Text style={panelStyles.editorStepBtnText}>-</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={panelStyles.editorStepBtn}
                              onPress={() => setEditorBrightness((v) => v + 10)}
                            >
                              <Text style={panelStyles.editorStepBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={panelStyles.editorStepperRow}>
                          <Text style={panelStyles.editorStepperLabel}>Contrast: {editorContrast}</Text>
                          <View style={panelStyles.editorStepperActions}>
                            <TouchableOpacity
                              style={panelStyles.editorStepBtn}
                              onPress={() => setEditorContrast((v) => v - 10)}
                            >
                              <Text style={panelStyles.editorStepBtnText}>-</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={panelStyles.editorStepBtn}
                              onPress={() => setEditorContrast((v) => v + 10)}
                            >
                              <Text style={panelStyles.editorStepBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={panelStyles.editorStepperRow}>
                          <Text style={panelStyles.editorStepperLabel}>Saturation: {editorSaturation}</Text>
                          <View style={panelStyles.editorStepperActions}>
                            <TouchableOpacity
                              style={panelStyles.editorStepBtn}
                              onPress={() => setEditorSaturation((v) => v - 10)}
                            >
                              <Text style={panelStyles.editorStepBtnText}>-</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={panelStyles.editorStepBtn}
                              onPress={() => setEditorSaturation((v) => v + 10)}
                            >
                              <Text style={panelStyles.editorStepBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </>
                    ) : null}
                    {editorToolbarSection === 'crop' ? (
                      <>
                        <Text style={panelStyles.editorSectionTitle}>Crop</Text>
                        <Text style={panelStyles.editorCropHint}>
                          {composerMode === 'clips' ? 'Clips are locked to 9:16 vertical.' : 'Aspect ratio (fill crop)'}
                        </Text>
                        {composerMode === 'clips' ? (
                          <View style={panelStyles.editorOptionRow}>
                            <View style={[panelStyles.editorPill, panelStyles.editorPillSelected]}>
                              <Text style={[panelStyles.editorPillText, panelStyles.editorPillTextSelected]}>9:16</Text>
                            </View>
                          </View>
                        ) : (
                          <View style={panelStyles.editorOptionRow}>
                            {(['none', '1:1', '4:5', '16:9'] as const).map((crop) => (
                              <TouchableOpacity
                                key={crop}
                                style={[panelStyles.editorPill, editorCrop === crop && panelStyles.editorPillSelected]}
                                onPress={() => setEditorCrop(crop)}
                              >
                                <Text
                                  style={[
                                    panelStyles.editorPillText,
                                    editorCrop === crop && panelStyles.editorPillTextSelected,
                                  ]}
                                >
                                  {crop === 'none' ? 'Original' : crop}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </>
                    ) : null}
                    {editorToolbarSection === 'stickers' ? (
                      <View style={panelStyles.editorPlaceholderBlock}>
                        <Ionicons name="sparkles-outline" size={36} color={Colors.textSecondary} />
                        <Text style={panelStyles.editorPlaceholderTitle}>Stickers</Text>
                        <Text style={panelStyles.editorPlaceholderText}>Sticker packs and placement are coming soon.</Text>
                      </View>
                    ) : null}
                    {editorToolbarSection === 'music' ? (
                      isEditorVideo ? (
                        <>
                          <Text style={panelStyles.editorSectionTitle}>Trim</Text>
                          {composerMode === 'clips' ? (
                            <Text style={panelStyles.editorCropHint}>
                              Keep clips under {CLIP_MAX_DURATION_SECONDS}s for best playback.
                            </Text>
                          ) : null}
                          <View style={panelStyles.editorTrimRow}>
                            <TextInput
                              style={panelStyles.editorInputCompact}
                              placeholder="Start (sec)"
                              placeholderTextColor={Colors.textSecondary}
                              value={editorTrimStart}
                              onChangeText={setEditorTrimStart}
                              keyboardType="numeric"
                            />
                            <TextInput
                              style={panelStyles.editorInputCompact}
                              placeholder="End (sec)"
                              placeholderTextColor={Colors.textSecondary}
                              value={editorTrimEnd}
                              onChangeText={setEditorTrimEnd}
                              keyboardType="numeric"
                            />
                          </View>
                          <Text style={panelStyles.editorSectionTitle}>Speed</Text>
                          <View style={panelStyles.editorOptionRow}>
                            {[1, 0.5, 0.25].map((speed) => (
                              <TouchableOpacity
                                key={speed}
                                style={[panelStyles.editorPill, editorSpeed === speed && panelStyles.editorPillSelected]}
                                onPress={() => setEditorSpeed(speed as 1 | 0.5 | 0.25)}
                              >
                                <Text
                                  style={[
                                    panelStyles.editorPillText,
                                    editorSpeed === speed && panelStyles.editorPillTextSelected,
                                  ]}
                                >
                                  {speed}x
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <Text style={panelStyles.editorSectionTitle}>Volume</Text>
                          <View style={panelStyles.editorOptionRow}>
                            {[0, 50, 100, 150].map((vol) => (
                              <TouchableOpacity
                                key={vol}
                                style={[panelStyles.editorPill, editorVolume === vol && panelStyles.editorPillSelected]}
                                onPress={() => setEditorVolume(vol)}
                              >
                                <Text
                                  style={[
                                    panelStyles.editorPillText,
                                    editorVolume === vol && panelStyles.editorPillTextSelected,
                                  ]}
                                >
                                  {vol}%
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <Text style={panelStyles.editorSectionTitle}>Fade</Text>
                          <View style={panelStyles.editorStepperRow}>
                            <Text style={panelStyles.editorStepperLabel}>Fade In: {editorFadeInMs}ms</Text>
                            <View style={panelStyles.editorStepperActions}>
                              <TouchableOpacity
                                style={panelStyles.editorStepBtn}
                                onPress={() => setEditorFadeInMs((v) => Math.max(0, v - 250))}
                              >
                                <Text style={panelStyles.editorStepBtnText}>-</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={panelStyles.editorStepBtn}
                                onPress={() => setEditorFadeInMs((v) => v + 250)}
                              >
                                <Text style={panelStyles.editorStepBtnText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={panelStyles.editorStepperRow}>
                            <Text style={panelStyles.editorStepperLabel}>Fade Out: {editorFadeOutMs}ms</Text>
                            <View style={panelStyles.editorStepperActions}>
                              <TouchableOpacity
                                style={panelStyles.editorStepBtn}
                                onPress={() => setEditorFadeOutMs((v) => Math.max(0, v - 250))}
                              >
                                <Text style={panelStyles.editorStepBtnText}>-</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={panelStyles.editorStepBtn}
                                onPress={() => setEditorFadeOutMs((v) => v + 250)}
                              >
                                <Text style={panelStyles.editorStepBtnText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </>
                      ) : (
                        <View style={panelStyles.editorPlaceholderBlock}>
                          <Ionicons name="musical-notes-outline" size={36} color={Colors.textSecondary} />
                          <Text style={panelStyles.editorPlaceholderTitle}>Music & audio</Text>
                          <Text style={panelStyles.editorPlaceholderText}>
                            Trim, speed, and volume controls appear when you edit a video.
                          </Text>
                        </View>
                      )
                    ) : null}
                    {editorError ? <Text style={panelStyles.editorError}>{editorError}</Text> : null}
                  </ScrollView>
                  <View style={[panelStyles.editorBottomChrome, bgStyle, { paddingBottom: 10 + insets.bottom }]}>
                    <View style={panelStyles.editorActions}>
                      <TouchableOpacity
                        style={panelStyles.editorResetBtn}
                        onPress={() => {
                          setEditorTextOverlay('');
                          setEditorFilter('none');
                          setEditorBrightness(0);
                          setEditorContrast(0);
                          setEditorSaturation(0);
                          setEditorSpeed(1);
                          setEditorVolume(100);
                          setEditorFadeInMs(0);
                          setEditorFadeOutMs(0);
                          setEditorTrimStart('');
                          setEditorTrimEnd('');
                          setEditorCrop('none');
                          setEditorError(null);
                        }}
                      >
                        <Text style={panelStyles.editorResetBtnText}>Undo / Reset</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={panelStyles.editorApplyBtn}
                        onPress={() => void applyCloudinaryEdits()}
                        disabled={editorBusy || !editorTarget}
                      >
                        {editorBusy ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text style={panelStyles.editorApplyBtnText}>Apply Edits</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    <View style={panelStyles.editorToolsDivider} />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={panelStyles.editorToolsRowScroll}
                    >
                      {(
                        [
                          { id: 'crop' as const, label: 'Crop', icon: 'crop-outline' as const },
                          { id: 'filters' as const, label: 'Filters', icon: 'color-filter-outline' as const },
                          { id: 'grading' as const, label: 'Color grading', icon: 'color-palette-outline' as const },
                          { id: 'text' as const, label: 'Text overlay', icon: 'text-outline' as const },
                          { id: 'stickers' as const, label: 'Stickers', icon: 'happy-outline' as const },
                          { id: 'music' as const, label: 'Music', icon: 'musical-notes-outline' as const },
                        ] as const
                      ).map((tab) => {
                        const active = editorToolbarSection === tab.id;
                        return (
                          <TouchableOpacity
                            key={tab.id}
                            style={[panelStyles.editorToolTab, active && panelStyles.editorToolTabActive]}
                            onPress={() => setEditorToolbarSection(tab.id)}
                            activeOpacity={0.75}
                          >
                            <Ionicons
                              name={tab.icon}
                              size={20}
                              color={active ? Colors.primary : Colors.textSecondary}
                            />
                            <Text
                              style={[panelStyles.editorToolTabLabel, active && panelStyles.editorToolTabLabelActive]}
                              numberOfLines={2}
                            >
                              {tab.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              ) : (
                <Text style={panelStyles.toolPanelEmptyText}>{toolPanelTitle} options coming next.</Text>
              )}
            </View>
          </Animated.View>
        </>
      ) : null}

      {activeToolPanel === 'editor' && editorDiscardSheetVisible ? (
        <View style={panelStyles.editorDiscardOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditorDiscardSheet}>
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                panelStyles.editorDiscardBackdropFill,
                { opacity: editorDiscardBackdropOpacity },
              ]}
            />
          </Pressable>
          <Animated.View
            style={[
              panelStyles.editorDiscardSheet,
              bgStyle,
              {
                paddingBottom: 20 + insets.bottom,
                transform: [{ translateY: editorDiscardSheetY }],
              },
            ]}
          >
            <View style={panelStyles.editorDiscardHandle} />
            <Text style={panelStyles.editorDiscardTitle}>Delete draft?</Text>
            <Text style={panelStyles.editorDiscardSubtitle}>
              Your media, caption, and edits will be removed. You will stay on Create Post.
            </Text>
            <TouchableOpacity
              style={panelStyles.editorDiscardDeleteBtn}
              onPress={confirmEditorDiscardDelete}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Delete draft"
            >
              <Text style={panelStyles.editorDiscardDeleteText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={panelStyles.editorDiscardCancelBtn}
              onPress={closeEditorDiscardSheet}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={panelStyles.editorDiscardCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const panelStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  containerClipPick: {
    backgroundColor: Colors.background,
  },
  clipPickFill: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerClipPick: {
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerTitleClipPick: {
    color: Colors.text,
  },
  iconButton: {
    padding: 4,
  },
  iconButtonPlaceholder: {
    width: 32,
    height: 32,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  clipsSourceText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  captionComposer: {
    paddingBottom: 14,
  },
  captionInput: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 26,
    minHeight: 120,
    paddingVertical: 6,
    paddingHorizontal: 0,
    textAlignVertical: 'top',
  },
  postToolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
    alignItems: 'center',
  },
  bottomToolsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  audienceWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 10,
    marginBottom: 8,
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  audienceHint: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  audienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  audienceChipText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  locationPanel: {
    flex: 1,
  },
  locationHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 10,
    lineHeight: 17,
  },
  locationSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationSelectedText: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  locationClearText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  locationSectionLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  locationListContent: {
    paddingBottom: 28,
    paddingTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationRowIcon: {
    marginRight: 10,
  },
  locationRowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  locationRowTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  locationRowSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  tagUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  tagUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagUserAvatarLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  tagSelectedWrap: {
    marginBottom: 10,
  },
  tagSelectedLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  tagChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagChipText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  visibilityList: {
    paddingTop: 6,
    gap: 8,
  },
  visibilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  visibilityItemSelected: {
    borderColor: Colors.primary,
  },
  visibilityItemText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  visibilityItemTextSelected: {
    color: Colors.primary,
  },
  bottomToolsSeparator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: -16,
    marginBottom: 10,
  },
  previewWrap: {
    marginTop: 10,
  },
  previewAddButtonUnder: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  previewAddText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  previewCarousel: {
    width: '100%',
    height: 340,
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  previewMedia: {
    width: WINDOW_WIDTH - 32,
    height: 340,
  },
  previewMediaClips: {
    width: Math.min((WINDOW_WIDTH - 32) * 0.62, 280),
    alignSelf: 'center',
  },
  clipWarningText: {
    marginTop: 8,
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  previewActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  previewActionText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  previewRemoveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  previewDots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  previewDotActive: {
    width: 14,
    backgroundColor: 'white',
  },
  postToolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 9999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    minHeight: 34,
  },
  postToolText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  toolPanelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  toolPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  toolPanelHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toolPanelHeaderSide: {
    width: 72,
    justifyContent: 'center',
  },
  toolPanelHeaderSideLeft: {
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  toolPanelHeaderSideRight: {
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  toolPanelTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  toolPanelNextText: {
    color: Colors.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  toolPanelClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  editorDiscardOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
  },
  editorDiscardBackdropFill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  editorDiscardSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  editorDiscardHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  editorDiscardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  editorDiscardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  editorDiscardDeleteBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  editorDiscardDeleteText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FF3B30',
  },
  editorDiscardCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  editorDiscardCancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  toolPanelBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  toolPanelEmptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  toolPanelEmptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webPickButton: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  webPickButtonText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  mediaGridContent: {
    paddingBottom: 18,
  },
  mediaGridRow: {
    gap: 8,
    marginBottom: 8,
  },
  mediaGridItem: {
    width: '31.8%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  mediaGridItemSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  mediaGridImage: {
    width: '100%',
    height: '100%',
  },
  mediaVideoBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  mediaSelectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  mediaDoneButton: {
    marginTop: 10,
    marginBottom: 6,
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 130,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaDoneButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  gifSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  gifSearchInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.text,
    height: 40,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  gifSearchButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gifStatus: {
    marginTop: 24,
  },
  gifGridContent: {
    paddingBottom: 18,
  },
  gifGridRow: {
    gap: 8,
    marginBottom: 8,
  },
  gifGridItem: {
    width: '49%',
    aspectRatio: 1.2,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  gifGridImage: {
    width: '100%',
    height: '100%',
  },
  pollScrollContent: {
    paddingBottom: 32,
    paddingTop: 4,
  },
  pollSectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
  },
  pollFieldLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
  },
  pollHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: -4,
    marginBottom: 10,
  },
  pollInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  pollQuestionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: 8,
    marginBottom: 4,
  },
  pollMediaQuestionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: 6,
    marginBottom: 12,
  },
  pollAfterChoicesDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: 10,
    marginBottom: 10,
  },
  pollChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  pollChoiceIndex: {
    width: 22,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  pollChoiceInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 44,
  },
  pollRemoveChoice: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollRemoveChoiceSpacer: {
    width: 32,
  },
  pollAddChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 18,
    paddingVertical: 6,
    paddingRight: 12,
  },
  pollPreviewWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
  },
  pollPreviewCarousel: {
    width: WINDOW_WIDTH - 32,
    height: 340,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  pollAddChoiceText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  pollDurationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  pollDurationMediaDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: -4,
    marginBottom: 10,
  },
  pollMediaChipDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: 9,
    marginBottom: 10,
  },
  pollDurationChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pollDurationChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  pollDurationChipText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pollDurationChipTextSelected: {
    color: Colors.primary,
  },
  pollDoneButton: {
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 160,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  pollDoneButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  editorLayout: {
    flex: 1,
  },
  editorScroll: {
    flex: 1,
  },
  editorContent: {
    paddingBottom: 16,
    gap: 10,
  },
  editorBottomChrome: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    paddingTop: 10,
  },
  editorToolsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: 10,
    marginBottom: 4,
  },
  editorToolsRowScroll: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  editorToolTab: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 12,
    gap: 4,
  },
  editorToolTabActive: {
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  editorToolTabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 11,
  },
  editorToolTabLabelActive: {
    color: Colors.primary,
  },
  editorPlaceholderBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  editorPlaceholderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  editorPlaceholderText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  editorPreviewWrap: {
    width: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  editorPreviewMedia: {
    width: '100%',
    height: '100%',
  },
  editorSectionTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  editorCropHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: -4,
    marginBottom: 2,
  },
  editorInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.text,
    minHeight: 40,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  editorInputCompact: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.text,
    minHeight: 40,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  editorTrimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editorOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editorPill: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editorPillSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  editorPillText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  editorPillTextSelected: {
    color: Colors.primary,
  },
  editorStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  editorStepperLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  editorStepperActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editorStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorStepBtnText: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  editorError: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  editorResetBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorResetBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  editorApplyBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorApplyBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  postButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  postButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  postButtonDisabled: {
    opacity: 0.45,
  },
});

export function CreatePostProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    setVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, backdropOpacity]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: PANEL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }, [slideAnim, backdropOpacity]);

  return (
    <CreatePostContext.Provider value={{ open, close, visible }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={close}
      >
        <View style={modalStyles.wrapper}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close}>
            <Animated.View style={[modalStyles.backdrop, { opacity: backdropOpacity }]} />
          </Pressable>
          <Animated.View
            style={[
              modalStyles.panel,
              {
                height: PANEL_HEIGHT,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <CreatePostPanelContent onClose={close} visible={visible} />
          </Animated.View>
        </View>
      </Modal>
    </CreatePostContext.Provider>
  );
}

const modalStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  panel: {
    width: '100%',
    overflow: 'hidden',
  },
});
