import * as Linking from 'expo-linking';

export type ParsedAuthCallback =
  | { kind: 'pkce'; code: string }
  | { kind: 'implicit'; access_token: string; refresh_token: string; type: string | null }
  | { kind: 'none' };

/**
 * Parses Supabase auth redirect URLs (PKCE ?code= or implicit #access_token=…).
 */
export function parseAuthCallbackUrl(url: string): ParsedAuthCallback {
  try {
    const parsed = Linking.parse(url);
    const rawCode = parsed.queryParams?.code;
    const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    if (typeof code === 'string' && code.length > 0) {
      return { kind: 'pkce', code };
    }

    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return { kind: 'none' };

    const params = new URLSearchParams(url.slice(hashIndex + 1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      return {
        kind: 'implicit',
        access_token,
        refresh_token,
        type: params.get('type'),
      };
    }
  } catch {
    /* ignore malformed URLs */
  }
  return { kind: 'none' };
}
