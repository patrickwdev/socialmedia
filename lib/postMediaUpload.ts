import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export const POST_MEDIA_BUCKET = 'post_media';

export type PostMediaUploadResult = { url: string | null; error: string | null };

async function readUriAsBytes(uri: string): Promise<ArrayBuffer | null> {
  try {
    if (uri.startsWith('data:')) {
      const base64 = uri.split(',')[1];
      if (!base64) return null;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
    if (uri.startsWith('blob:')) {
      const res = await fetch(uri);
      return res.arrayBuffer();
    }
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      return res.arrayBuffer();
    }
    const FileSystem = require('expo-file-system/legacy');
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch {
    return null;
  }
}

function extensionForUri(uri: string, mediaType: 'image' | 'video'): string {
  const path = uri.split('?')[0].toLowerCase();
  const m = path.match(/\.([a-z0-9]+)$/);
  if (m?.[1]) return m[1];
  return mediaType === 'video' ? 'mp4' : 'jpg';
}

function randomObjectId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function contentTypeForExt(ext: string, mediaType: 'image' | 'video'): string {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'mp4':
      return 'video/mp4';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
  }
}

/**
 * Upload a single post image or video to Supabase Storage under `post_media/{userId}/…`.
 */
export async function uploadPostMediaFile(
  localUri: string,
  userId: string,
  mediaType: 'image' | 'video'
): Promise<PostMediaUploadResult> {
  try {
    if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
      return { url: localUri, error: null };
    }
    const ext = extensionForUri(localUri, mediaType);
    const contentType = contentTypeForExt(ext, mediaType);
    const objectPath = `${userId}/${randomObjectId()}.${ext}`;
    const body = await readUriAsBytes(localUri);
    if (!body) {
      return { url: null, error: 'Could not read media file' };
    }
    const { data, error } = await supabase.storage.from(POST_MEDIA_BUCKET).upload(objectPath, body, {
      contentType,
      upsert: false,
    });
    if (error) return { url: null, error: error.message };
    const { data: urlData } = supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(data.path);
    return { url: urlData.publicUrl, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return { url: null, error: msg };
  }
}
