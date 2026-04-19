import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from './AuthContext';

/**
 * JourneyContext — single source of truth for the active journey.
 *
 * Why: Multiple hooks (useHabitLogs, useFocusTimer, useCustomHabits)
 * need activeJourney.id to tag their writes. Without a context,
 * each would call Supabase independently → redundant fetches + race conditions.
 *
 * Provides:
 *   activeJourney     — user_journeys row | null
 *   setActiveJourney  — update after startJourney / completeJourney
 *   isLoadingJourney  — fetch in-progress flag
 *   refetchJourney    — force re-fetch (e.g. after startJourney)
 */

const JourneyContext = createContext(null);

export function JourneyProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  const [activeJourney,    setActiveJourney]    = useState(null);
  const [loadedUserId,     setLoadedUserId]     = useState(undefined); // undefined = initial

  // SYNCHRONOUSLY derive loading state to prevent React `useEffect` 1-tick race condition
  // where isAuthenticated becomes true but isLoadingJourney hasn't been set to true yet.
  let isLoadingJourney = false;
  if (useDB) {
    if (loadedUserId !== user.id) {
      isLoadingJourney = true; // Still fetching for this specific user
    }
  }

  const fetchActiveJourney = useCallback(async () => {
    if (!useDB || !user) return;
    try {
      const { data, error } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setActiveJourney(data || null);
    } catch (err) {
      console.warn('[JourneyContext] fetch error:', err.message);
    } finally {
      setLoadedUserId(user.id);
    }
  }, [useDB, user]);

  // Fetch once on login, clear on logout
  useEffect(() => {
    if (useDB) {
      setLoadedUserId(undefined); // Force loading state immediately
      fetchActiveJourney();
    } else {
      setActiveJourney(null);
      setLoadedUserId(null); // Guest user
    }
  }, [useDB]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <JourneyContext.Provider value={{
      activeJourney,
      setActiveJourney,
      isLoadingJourney,
      refetchJourney: fetchActiveJourney,
    }}>
      {children}
    </JourneyContext.Provider>
  );
}

/** Use inside any component or hook */
export function useActiveJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error('useActiveJourney must be used inside JourneyProvider');
  return ctx;
}
