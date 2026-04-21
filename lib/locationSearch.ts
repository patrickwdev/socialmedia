export type LocationSuggestion = {
  id: string;
  label: string;
  detail?: string;
};

const PHOTON_BASE = 'https://photon.komoot.io/api/';

type PhotonProps = {
  name?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
};

function formatPhotonFeature(
  feature: unknown,
  index: number,
): LocationSuggestion | null {
  if (!feature || typeof feature !== 'object') return null;
  const f = feature as {
    geometry?: { coordinates?: unknown };
    properties?: unknown;
  };
  const coords = f.geometry?.coordinates;
  const lon = Array.isArray(coords) && typeof coords[0] === 'number' ? coords[0] : null;
  const lat = Array.isArray(coords) && typeof coords[1] === 'number' ? coords[1] : null;
  const p = (f.properties ?? {}) as PhotonProps;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const street = typeof p.street === 'string' ? p.street.trim() : '';
  const city = typeof p.city === 'string' ? p.city.trim() : '';
  const district = typeof p.district === 'string' ? p.district.trim() : '';
  const state = typeof p.state === 'string' ? p.state.trim() : '';
  const country = typeof p.country === 'string' ? p.country.trim() : '';

  const label = name || street || district || city || state || country;
  if (!label) return null;

  const detailParts = [city && city !== label ? city : null, state || country].filter(Boolean) as string[];
  const detail = detailParts.length ? detailParts.join(', ') : undefined;
  const id =
    lon != null && lat != null ? `p-${lon.toFixed(5)}-${lat.toFixed(5)}-${index}` : `p-${index}-${label}`;

  return { id, label, detail };
}

function mapPhotonResponse(data: unknown): LocationSuggestion[] {
  if (!data || typeof data !== 'object' || !('features' in data)) return [];
  const { features } = data as { features?: unknown[] };
  if (!Array.isArray(features)) return [];
  const out: LocationSuggestion[] = [];
  features.forEach((feature, index) => {
    const row = formatPhotonFeature(feature, index);
    if (row) out.push(row);
  });
  return out;
}

/** Forward geocode / place search (optionally biased toward lat/lon). */
export async function searchPhotonPlaces(
  query: string,
  opts?: { lat?: number; lon?: number; limit?: number },
): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  const limit = opts?.limit ?? 14;
  let url = `${PHOTON_BASE}?q=${encodeURIComponent(q)}&limit=${limit}&lang=en`;
  if (opts?.lat != null && opts?.lon != null) {
    url += `&lat=${opts.lat}&lon=${opts.lon}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('Place search failed');
  const data: unknown = await res.json();
  return mapPhotonResponse(data);
}

const NEARBY_SEED_QUERIES = ['cafe', 'park', 'gym', 'restaurant', 'school', 'stadium', 'library', 'field'];

/** Suggested places around coordinates (Photon, multiple short queries merged). */
export async function fetchNearbyPlaceSuggestions(lat: number, lon: number): Promise<LocationSuggestion[]> {
  const groups = await Promise.all(
    NEARBY_SEED_QUERIES.map((seed) => searchPhotonPlaces(seed, { lat, lon, limit: 3 })),
  );
  const merged: LocationSuggestion[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.label.toLowerCase()}|${(item.detail ?? '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged.slice(0, 16);
}
