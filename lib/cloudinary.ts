export type CloudinaryUploadResourceType = 'image' | 'video' | 'raw' | 'auto';

export type CloudinaryUploadResult = {
  publicId: string;
  secureUrl: string;
  resourceType: CloudinaryUploadResourceType;
  width?: number;
  height?: number;
  duration?: number;
};

export type CloudinaryVideoEditOptions = {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'pad' | 'crop';
  startOffsetSec?: number;
  endOffsetSec?: number;
  textOverlay?: {
    text: string;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    gravity?: 'north' | 'south' | 'center' | 'west' | 'east';
  };
  filter?: 'none' | 'vibrance' | 'enhance' | 'art:incognito' | 'art:red_rock';
  brightness?: number;
  contrast?: number;
  saturation?: number;
  speed?: 1 | 0.5 | 0.25;
  volumePercent?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
};

export type CloudinaryImageEditOptions = {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'pad' | 'crop';
  textOverlay?: {
    text: string;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    gravity?: 'north' | 'south' | 'center' | 'west' | 'east';
  };
  filter?: 'none' | 'vibrance' | 'enhance' | 'art:incognito' | 'art:red_rock';
  brightness?: number;
  contrast?: number;
  saturation?: number;
};

type CloudinaryRawUploadResponse = {
  public_id: string;
  secure_url: string;
  resource_type: CloudinaryUploadResourceType;
  width?: number;
  height?: number;
  duration?: number;
  error?: { message?: string };
};

const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function sanitizeTextForOverlay(text: string) {
  return encodeURIComponent(text).replace(/%20/g, '%2520');
}

function mapSpeedToAccelerate(speed: number): number {
  if (speed === 1) return 0;
  if (speed === 0.5) return -50;
  if (speed === 0.25) return -75;
  return 0;
}

function buildVideoTransformations(options: CloudinaryVideoEditOptions): string {
  const transforms: string[] = [];

  if (options.crop && (options.width || options.height)) {
    const sizeParts = [options.width ? `w_${options.width}` : '', options.height ? `h_${options.height}` : '']
      .filter(Boolean)
      .join(',');
    transforms.push(`c_${options.crop}${sizeParts ? `,${sizeParts}` : ''}`);
  }

  if (typeof options.startOffsetSec === 'number') transforms.push(`so_${Math.max(0, options.startOffsetSec)}`);
  if (typeof options.endOffsetSec === 'number') transforms.push(`eo_${Math.max(0, options.endOffsetSec)}`);

  if (options.filter && options.filter !== 'none') {
    transforms.push(options.filter.startsWith('art:') ? `e_${options.filter}` : `e_${options.filter}`);
  }

  if (typeof options.brightness === 'number') transforms.push(`e_brightness:${clamp(options.brightness, -99, 100)}`);
  if (typeof options.contrast === 'number') transforms.push(`e_contrast:${clamp(options.contrast, -100, 100)}`);
  if (typeof options.saturation === 'number') transforms.push(`e_saturation:${clamp(options.saturation, -100, 100)}`);

  if (typeof options.speed === 'number' && options.speed !== 1) {
    const accelerate = mapSpeedToAccelerate(options.speed);
    if (accelerate !== 0) transforms.push(`e_accelerate:${accelerate}`);
  }

  if (typeof options.volumePercent === 'number') transforms.push(`e_volume:${clamp(options.volumePercent, 0, 200)}`);
  if (typeof options.fadeInMs === 'number' && options.fadeInMs > 0) transforms.push(`e_fade:${options.fadeInMs}`);
  if (typeof options.fadeOutMs === 'number' && options.fadeOutMs > 0) transforms.push(`e_fade:-${options.fadeOutMs}`);

  if (options.textOverlay?.text.trim()) {
    const family = options.textOverlay.fontFamily ?? 'Arial';
    const size = options.textOverlay.fontSize ?? 36;
    const color = (options.textOverlay.color ?? 'white').replace('#', 'rgb:');
    const gravity = options.textOverlay.gravity ?? 'south';
    const encoded = sanitizeTextForOverlay(options.textOverlay.text.trim());
    transforms.push(`l_text:${family}_${size}:${encoded},co_${color},g_${gravity}`);
  }

  return transforms.join('/');
}

function buildImageTransformations(options: CloudinaryImageEditOptions): string {
  const transforms: string[] = [];

  if (options.crop && (options.width || options.height)) {
    const sizeParts = [options.width ? `w_${options.width}` : '', options.height ? `h_${options.height}` : '']
      .filter(Boolean)
      .join(',');
    transforms.push(`c_${options.crop}${sizeParts ? `,${sizeParts}` : ''}`);
  }

  if (options.filter && options.filter !== 'none') {
    transforms.push(`e_${options.filter}`);
  }

  if (typeof options.brightness === 'number') transforms.push(`e_brightness:${clamp(options.brightness, -99, 100)}`);
  if (typeof options.contrast === 'number') transforms.push(`e_contrast:${clamp(options.contrast, -100, 100)}`);
  if (typeof options.saturation === 'number') transforms.push(`e_saturation:${clamp(options.saturation, -100, 100)}`);

  if (options.textOverlay?.text.trim()) {
    const family = options.textOverlay.fontFamily ?? 'Arial';
    const size = options.textOverlay.fontSize ?? 36;
    const color = (options.textOverlay.color ?? 'white').replace('#', 'rgb:');
    const gravity = options.textOverlay.gravity ?? 'south';
    const encoded = sanitizeTextForOverlay(options.textOverlay.text.trim());
    transforms.push(`l_text:${family}_${size}:${encoded},co_${color},g_${gravity}`);
  }

  return transforms.join('/');
}

export function buildCloudinaryVideoUrl(publicId: string, options: CloudinaryVideoEditOptions = {}) {
  if (!cloudName) throw new Error('Missing EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME');
  const base = `https://res.cloudinary.com/${cloudName}/video/upload`;
  const transforms = buildVideoTransformations(options);
  return transforms ? `${base}/${transforms}/${publicId}.mp4` : `${base}/${publicId}.mp4`;
}

export function buildCloudinaryImageUrl(publicId: string, options: CloudinaryImageEditOptions = {}) {
  if (!cloudName) throw new Error('Missing EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME');
  const base = `https://res.cloudinary.com/${cloudName}/image/upload`;
  const transforms = buildImageTransformations(options);
  return transforms ? `${base}/${transforms}/${publicId}` : `${base}/${publicId}`;
}

export async function uploadToCloudinary(
  fileUri: string,
  resourceType: CloudinaryUploadResourceType = 'auto'
): Promise<CloudinaryUploadResult> {
  if (!cloudName) throw new Error('Missing EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME');
  if (!uploadPreset) throw new Error('Missing EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET');

  const form = new FormData();
  const filename = fileUri.split('/').pop() ?? `upload-${Date.now()}`;
  const lower = filename.toLowerCase();
  const mimeType =
    lower.endsWith('.mp4')
      ? 'video/mp4'
      : lower.endsWith('.mov')
        ? 'video/quicktime'
        : lower.endsWith('.webm')
          ? 'video/webm'
          : lower.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
  form.append('file', { uri: fileUri, name: filename, type: mimeType } as unknown as Blob);
  form.append('upload_preset', uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    {
      method: 'POST',
      body: form,
    }
  );

  const payload = (await response.json()) as CloudinaryRawUploadResponse;
  if (!response.ok || payload.error?.message) {
    throw new Error(payload.error?.message ?? `Cloudinary upload failed (${response.status})`);
  }

  return {
    publicId: payload.public_id,
    secureUrl: payload.secure_url,
    resourceType: payload.resource_type,
    width: payload.width,
    height: payload.height,
    duration: payload.duration,
  };
}
