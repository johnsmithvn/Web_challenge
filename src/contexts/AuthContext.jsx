import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

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

  // Sign up with email + password
  const signUp = useCallback(async ({ email, password, displayName }) => {
    if (!isSupabaseEnabled) return { error: { message: 'Supabase chưa được cấu hình' } };
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name: displayName } },
    });
    return { data, error };
  }, []);

  // Sign in with email + password
  const signIn = useCallback(async ({ email, password }) => {
    if (!isSupabaseEnabled) return { error: { message: 'Supabase chưa được cấu hình' } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  // Sign in with Google OAuth
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseEnabled) return { error: { message: 'Supabase chưa được cấu hình' } };
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { data, error };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  // Update profile
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
