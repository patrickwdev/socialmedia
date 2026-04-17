const TENOR_V2_BASE_URL = 'https://tenor.googleapis.com/v2';
const TENOR_V1_BASE_URL = 'https://g.tenor.com/v1';
const DEFAULT_TENOR_LEGACY_KEY = 'LIVDSRZULELA';
const DEFAULT_CLIENT_KEY = 'athlete_social_app';
const DEFAULT_LIMIT = 24;

export type GifItem = {
  id: string;
  previewUrl: string;
  fullUrl: string;
  altText: string;
};

type TenorMediaFormats = {
  tinygif?: { url?: string };
  gif?: { url?: string };
};

type TenorResult = {
  id: string;
  content_description?: string;
  media_formats?: TenorMediaFormats;
};

type TenorApiResponse = {
  results?: TenorResult[];
};

type TenorLegacyMedia = {
  tinygif?: { url?: string };
  gif?: { url?: string };
};

type TenorLegacyResult = {
  id: string;
  content_description?: string;
  media?: TenorLegacyMedia[];
};

type TenorLegacyApiResponse = {
  results?: TenorLegacyResult[];
};

function mapTenorResultToGif(result: TenorResult): GifItem | null {
  const previewUrl = result.media_formats?.tinygif?.url;
  const fullUrl = result.media_formats?.gif?.url ?? previewUrl;

  if (!previewUrl || !fullUrl) return null;

  return {
    id: result.id,
    previewUrl,
    fullUrl,
    altText: result.content_description ?? 'GIF',
  };
}

async function fetchFromTenor(path: string, params: Record<string, string>): Promise<GifItem[]> {
  const v2ApiKey = process.env.EXPO_PUBLIC_TENOR_API_KEY?.trim();
  if (v2ApiKey) {
    const clientKey = process.env.EXPO_PUBLIC_TENOR_CLIENT_KEY ?? DEFAULT_CLIENT_KEY;
    const search = new URLSearchParams({
      key: v2ApiKey,
      client_key: clientKey,
      limit: String(DEFAULT_LIMIT),
      media_filter: 'tinygif,gif',
      ...params,
    });

    const res = await fetch(`${TENOR_V2_BASE_URL}/${path}?${search.toString()}`);
    if (res.ok) {
      const json = (await res.json()) as TenorApiResponse;
      return (json.results ?? []).map(mapTenorResultToGif).filter((item): item is GifItem => Boolean(item));
    }
  }

  const legacyKey = process.env.EXPO_PUBLIC_TENOR_LEGACY_KEY ?? DEFAULT_TENOR_LEGACY_KEY;
  const legacySearch = new URLSearchParams({
    key: legacyKey,
    limit: String(DEFAULT_LIMIT),
    ...params,
  });
  const legacyPath = path === 'featured' ? 'trending' : 'search';
  const legacyRes = await fetch(`${TENOR_V1_BASE_URL}/${legacyPath}?${legacySearch.toString()}`);
  if (!legacyRes.ok) {
    throw new Error(`Failed to fetch GIFs (${legacyRes.status})`);
  }

  const legacyJson = (await legacyRes.json()) as TenorLegacyApiResponse;
  return (legacyJson.results ?? [])
    .map((result) => {
      const media = result.media?.[0];
      const previewUrl = media?.tinygif?.url;
      const fullUrl = media?.gif?.url ?? previewUrl;
      if (!previewUrl || !fullUrl) return null;
      return {
        id: result.id,
        previewUrl,
        fullUrl,
        altText: result.content_description ?? 'GIF',
      } satisfies GifItem;
    })
    .filter((item): item is GifItem => Boolean(item));
}

export async function fetchTrendingGifs(): Promise<GifItem[]> {
  return fetchFromTenor('featured', {});
}

export async function searchGifs(query: string): Promise<GifItem[]> {
  return fetchFromTenor('search', { q: query });
}
