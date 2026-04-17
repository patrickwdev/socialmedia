import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export type ProfileMediaUploadResult = { url: string | null; error: string | null };

async function getBytesFromUri(uri: string): Promise<ArrayBuffer | null> {
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

/**
 * Upload a profile or banner image to Supabase Storage (same paths as signup / edit-profile).
 * Handles web blob URLs, data URLs, and native file URIs.
 */
export async function uploadUserProfileImage(
  uri: string,
  bucket: string,
  path: string
): Promise<ProfileMediaUploadResult> {
  try {
    if (uri.startsWith('http')) {
      return { url: uri, error: null };
    }
    const body = await getBytesFromUri(uri);
    if (!body) {
      return { url: null, error: 'Could not read image file' };
    }
    const { data, error } = await supabase.storage.from(bucket).upload(path, body, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) return { url: null, error: error.message };
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    const publicUrl = urlData.publicUrl;
    const cacheBuster = `v=${Date.now()}`;
    const separator = publicUrl.includes('?') ? '&' : '?';
    return { url: `${publicUrl}${separator}${cacheBuster}`, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return { url: null, error: msg };
  }
}
