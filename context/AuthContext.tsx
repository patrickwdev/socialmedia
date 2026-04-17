import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getSignupEmailRedirectUrl } from '@/lib/emailConfirmation';
import { tryApplyPendingSignupMedia } from '@/lib/pendingSignupMedia';

export type SignUpResult = {
  user: User;
  /** Null when Supabase requires email confirmation before issuing a session. */
  session: Session | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<{ data: SignUpResult | null; error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /** Use after updateUser() so the app sees the updated user without waiting for refresh (e.g. signup avatar/banner). */
  setUserFromUpdate: (user: User) => void;
};

export type SignUpMetadata = {
  full_name?: string;
  profile_name?: string;
  role?: string;
  username?: string;
  team?: string;
  org_type?: string;
  org_name?: string;
  role_title?: string;
  linkedin_link?: string;
  verification_link?: string;
  avatar_url?: string;
  banner_url?: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const updated = await tryApplyPendingSignupMedia(user);
      if (cancelled || !updated) return;
      setUser(updated);
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data?.session) {
        setSession(data.session);
        setUser(data.session.user ?? updated);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  };

  const signUp = async (email: string, password: string, metadata?: SignUpMetadata) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        // Supabase Dashboard → Authentication → URL Configuration → Redirect URLs must include this URL.
        emailRedirectTo: getSignupEmailRedirectUrl(),
      },
    });
    if (error) return { data: null, error };
    // Supabase may not return an error when email exists (e.g. if confirmation is on).
    // Empty identities means the email is already registered.
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      return {
        data: null,
        error: {
          message: 'This email is already registered. Sign in or use a different email.',
          name: 'AuthApiError',
          status: 422,
        } as AuthError,
      };
    }
    if (!data.user) return { data: null, error: null };
    return {
      data: {
        user: data.user,
        session: data.session ?? null,
      },
      error: null,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshSession = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session) {
      setSession(data.session);
      setUser(data.session.user ?? null);
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session);
      setUser(sessionData.session?.user ?? null);
    }
  };

  const setUserFromUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
    setUserFromUpdate,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
