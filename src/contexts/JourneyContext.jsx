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
  const [isLoadingJourney, setIsLoadingJourney] = useState(false);

  const fetchActiveJourney = useCallback(async () => {
    if (!useDB || !user) return;
    setIsLoadingJourney(true);
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
      setIsLoadingJourney(false);
    }
  }, [useDB, user]);

  // Fetch once on login, clear on logout
  useEffect(() => {
    if (useDB) {
      fetchActiveJourney();
    } else {
      setActiveJourney(null);
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
