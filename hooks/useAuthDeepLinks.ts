import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  tryApplyPasswordRecoveryFromUrl,
  urlLooksLikePasswordRecoveryRoute,
} from '@/lib/passwordRecovery';
import {
  tryCompleteSignupConfirmationFromUrl,
  urlLooksLikeSignupConfirmRoute,
} from '@/lib/emailConfirmation';

/**
 * Handles password-recovery deep links and signup email-confirmation deep links.
 * Recovery is checked first so reset-password URLs are not mistaken for signup.
 */
export function useAuthDeepLinks() {
  const router = useRouter();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const process = async (url: string | null) => {
      if (!url) return;
      if (handledRef.current === url) return;

      if (urlLooksLikePasswordRecoveryRoute(url)) {
        const ok = await tryApplyPasswordRecoveryFromUrl(url);
        if (ok) {
          handledRef.current = url;
          router.replace('/reset-password');
        }
        return;
      }

      if (urlLooksLikeSignupConfirmRoute(url)) {
        const { ok, error } = await tryCompleteSignupConfirmationFromUrl(url);
        if (ok) {
          handledRef.current = url;
          // Verification is saved server-side; sign out so the user signs in explicitly on the login screen.
          await supabase.auth.signOut();
          // Native dialog (Expo mobile cannot show an HTML page for exp:// / custom-scheme redirects).
          Alert.alert(
            'Your email has been confirmed',
            'You can now sign in with your email and password.',
            [
              {
                text: 'OK',
                onPress: () =>
                  router.replace({ pathname: '/auth/login', params: { verified: '1' } }),
              },
            ],
            { cancelable: false }
          );
        } else if (error) {
          Alert.alert('Verification failed', error);
        }
      }
    };

    void Linking.getInitialURL().then(process);
    const sub = Linking.addEventListener('url', ({ url }) => void process(url));
    return () => sub.remove();
  }, [router]);
}
