import { useEffect, useRef } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
// Deep imports avoid expo-av's Audio/Recording chain; Metro on web fails to resolve `./Recording.types`.
import Video from 'expo-av/build/Video';
import { ResizeMode } from 'expo-av/build/Video.types';
import type { Post } from '@/data/mock';

export type PostMediaMode = 'feed' | 'thumbnail' | 'detail' | 'preview';

type PostMediaProps = {
  uri: string;
  mediaType: Post['type'];
  style: StyleProp<ViewStyle>;
  mode?: PostMediaMode;
  isMutedOverride?: boolean;
  shouldPlayOverride?: boolean;
};

/**
 * Renders feed / profile / detail media. Videos use expo-av; images use RN Image (web-safe vs lucide).
 */
export function PostMedia({
  uri,
  mediaType,
  style,
  mode = 'feed',
  isMutedOverride,
  shouldPlayOverride,
}: PostMediaProps) {
  const videoRef = useRef<InstanceType<typeof Video> | null>(null);
  const isFeed = mode === 'feed';
  const isVideo = mediaType === 'video';
  const effectiveShouldPlay = isVideo ? (shouldPlayOverride ?? isFeed) : false;

  useEffect(() => {
    if (!isVideo) return;
    if (!effectiveShouldPlay) {
      void videoRef.current?.pauseAsync?.();
    }
  }, [isVideo, effectiveShouldPlay, uri]);

  if (mediaType === 'text' || mediaType === 'poll') {
    return <View style={style} />;
  }
  if (mediaType === 'video') {
    const isDetail = mode === 'detail';
    const resizeMode = mode === 'preview' ? ResizeMode.CONTAIN : ResizeMode.COVER;
    return (
      <Video
        ref={videoRef}
        source={{ uri }}
        style={style}
        resizeMode={resizeMode}
        isLooping={isFeed}
        isMuted={isMutedOverride ?? mode === 'thumbnail'}
        shouldPlay={effectiveShouldPlay}
        useNativeControls={isDetail}
      />
    );
  }
  return <Image source={{ uri }} style={style} resizeMode={mode === 'preview' ? 'contain' : 'cover'} />;
}
