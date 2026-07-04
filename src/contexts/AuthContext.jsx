import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { logger } from '../utils/logger';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile from DB
  const fetchProfile = useCallback(async (userId) => {
    if (!isSupabaseEnabled || !userId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  }, []);

  // Init: restore session
  useEffect(() => {
    if (!isSupabaseEnabled) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else setProfile(null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Sign Up ─────────────────────────────────────────────────────
  // Fields: username (required), email (required), password, displayName (optional)
  const signUp = useCallback(async ({ username, email, password, displayName }) => {
    if (!isSupabaseEnabled) return { error: { message: 'Supabase chưa được cấu hình' } };

    // 1. Check username uniqueness before creating auth user (via rpc — profiles
    //    is no longer cross-user readable)
    const { data: usernameTaken } = await supabase
      .rpc('username_exists', { p_username: username.trim().toLowerCase() });

    if (usernameTaken) return { error: { message: 'username_taken' } };

    // 2. Create Supabase auth user with real email
    //    Pass username in metadata so DB trigger can also read it
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          name:     displayName || username,
          username: username.trim().toLowerCase(),
        },
      },
    });

    if (error) return { error };

    // 3. Upsert profile with username + email
    //    The trigger may have already created a row with id only,
    //    so we use upsert with ignoreDuplicates=false to UPDATE existing row
    if (data?.user) {
      const { error: profErr } = await supabase.from('profiles').upsert({
        id:           data.user.id,
        username:     username.trim().toLowerCase(),
        email:        email.trim().toLowerCase(),
        display_name: displayName?.trim() || username,
      }, { onConflict: 'id', ignoreDuplicates: false });

      // If RLS blocked the upsert (e.g. email confirmation required),
      // retry via raw SQL approach — at minimum the username is in auth metadata
      // so the updated trigger will pick it up
      if (profErr) {
        logger.warn('[signUp] Profile upsert blocked by RLS, username saved in auth metadata:', profErr.message);
      }
    }

    return { data, error: null };
  }, []);

  // ── Sign In ─────────────────────────────────────────────────────
  // loginId: can be username OR email
  const signIn = useCallback(async ({ loginId, password }) => {
    if (!isSupabaseEnabled) return { error: { message: 'Supabase chưa được cấu hình' } };

    const trimmed = loginId.trim();
    let emailToUse = trimmed;

    // If no @ → it's a username → resolve email via SECURITY DEFINER rpc
    // (profiles.email is no longer directly readable by other users).
    if (!trimmed.includes('@')) {
      const { data: email, error: lookupErr } = await supabase
        .rpc('login_email', { p_username: trimmed.toLowerCase() });

      if (lookupErr || !email) {
        return { error: { message: 'username_not_found' } };
      }
      emailToUse = email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });
    return { data, error };
  }, []);

  // ── Google OAuth ──────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseEnabled) return { error: { message: 'Supabase chưa được cấu hình' } };
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { data, error };
  }, []);

  // ── Sign Out ──────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  // ── Update profile ────────────────────────────────────────────
  const updateProfile = useCallback(async (updates) => {
    if (!isSupabaseEnabled || !user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (data) setProfile(data);
    return { data, error };
  }, [user]);

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    isSupabaseEnabled,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    fetchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
