import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { parseAuthCallbackUrl } from '@/lib/parseAuthCallbackUrl';

/** Path segment used with Linking.createURL — add this URL to Supabase Auth redirect allow list. */
export const PASSWORD_RECOVERY_PATH = 'reset-password';

export function getPasswordRecoveryRedirectUrl(): string {
  return Linking.createURL(PASSWORD_RECOVERY_PATH);
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // Copy this URL into Supabase → Authentication → URL Configuration → Redirect URLs
  console.log(
    '[passwordRecovery] getPasswordRecoveryRedirectUrl():',
    getPasswordRecoveryRedirectUrl()
  );
}

export function urlLooksLikePasswordRecoveryRoute(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('reset-password') || u.includes('update-password');
}

/**
 * Applies recovery tokens from a deep link (implicit hash or PKCE on our recovery route).
 * @returns whether a session was established from this URL.
 */
export async function tryApplyPasswordRecoveryFromUrl(url: string): Promise<boolean> {
  const parsed = parseAuthCallbackUrl(url);
  const allowImplicit =
    parsed.kind === 'implicit' &&
    (parsed.type === 'recovery' || urlLooksLikePasswordRecoveryRoute(url));
  const allowPkce =
    parsed.kind === 'pkce' && urlLooksLikePasswordRecoveryRoute(url);

  if (allowImplicit) {
    const { error } = await supabase.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    });
    return !error;
  }

  if (allowPkce) {
    const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
    return !error;
  }

  return false;
}
