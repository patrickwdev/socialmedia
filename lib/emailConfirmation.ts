import * as Linking from 'expo-linking';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { parseAuthCallbackUrl } from '@/lib/parseAuthCallbackUrl';

/**
 * Path for Expo Router → `app/auth/confirm.tsx` → route `/auth/confirm`.
 *
 * Add the output of `getSignupEmailRedirectUrl()` to Supabase Dashboard:
 * Authentication → URL Configuration → Redirect URLs
 *
 * Examples:
 * - Expo dev / Expo Go: `exp://127.0.0.1:8081/--/auth/confirm` or `exp://192.168.x.x:8081/--/auth/confirm`
 * - Dev builds / production: `myapp://auth/confirm` (matches `"scheme": "myapp"` in app.json)
 */
export const SIGNUP_EMAIL_CONFIRM_PATH = 'auth/confirm';

export function getSignupEmailRedirectUrl(): string {
  return Linking.createURL(SIGNUP_EMAIL_CONFIRM_PATH);
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('[emailConfirmation] Add this URL to Supabase Redirect URLs:', getSignupEmailRedirectUrl());
}

export function urlLooksLikeSignupConfirmRoute(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('auth/confirm') || u.includes('email-confirmation');
}

/** Supabase sets this when the user has confirmed their email (OTP or link). */
export function isEmailVerified(user: User | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at);
}

function queryParam(parsed: ReturnType<typeof Linking.parse>, key: string): string | undefined {
  const raw = parsed.queryParams?.[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' ? v : undefined;
}

/**
 * Completes signup verification from a deep link (token_hash, PKCE code, or implicit tokens).
 */
export async function tryCompleteSignupConfirmationFromUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const parsed = Linking.parse(url);
    let tokenHash = queryParam(parsed, 'token_hash');
    let type = queryParam(parsed, 'type');

    const qPart = url.split('?')[1]?.split('#')[0];
    if (qPart) {
      const sp = new URLSearchParams(qPart);
      if (!tokenHash) tokenHash = sp.get('token_hash') ?? undefined;
      if (!type) type = sp.get('type') ?? undefined;
    }

    if (tokenHash && type === 'signup') {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' });
      return { ok: !error, error: error?.message };
    }

    const cb = parseAuthCallbackUrl(url);
    if (cb.kind === 'implicit') {
      const allowImplicit =
        cb.type === 'signup' || (cb.type == null && urlLooksLikeSignupConfirmRoute(url));
      if (allowImplicit) {
        const { error } = await supabase.auth.setSession({
          access_token: cb.access_token,
          refresh_token: cb.refresh_token,
        });
        return { ok: !error, error: error?.message };
      }
    }

    if (cb.kind === 'pkce' && urlLooksLikeSignupConfirmRoute(url)) {
      const { error } = await supabase.auth.exchangeCodeForSession(cb.code);
      return { ok: !error, error: error?.message };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid link' };
  }
  return { ok: false, error: 'Could not complete verification from this link.' };
}
