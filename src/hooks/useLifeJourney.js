import { useState, useCallback } from 'react';

const STORAGE_KEY = 'vl_life_journey_events';

const DEFAULT_EVENTS = [];

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_EVENTS;
  } catch {
    return DEFAULT_EVENTS;
  }
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function useLifeJourney() {
  const [events, setEvents] = useState(loadEvents);

  const addEvent = useCallback((event) => {
    setEvents(prev => {
      const next = [...prev, { ...event, id: Date.now(), type: event.emotion >= 0 ? 'positive' : 'negative' }]
        .sort((a, b) => a.age - b.age);
      saveEvents(next);
      return next;
    });
  }, []);

  const updateEvent = useCallback((id, updates) => {
    setEvents(prev => {
      const next = prev.map(e => e.id === id
        ? { ...e, ...updates, type: (updates.emotion ?? e.emotion) >= 0 ? 'positive' : 'negative' }
        : e
      ).sort((a, b) => a.age - b.age);
      saveEvents(next);
      return next;
    });
  }, []);

  const deleteEvent = useCallback((id) => {
    setEvents(prev => {
      const next = prev.filter(e => e.id !== id);
      saveEvents(next);
      return next;
    });
  }, []);

  const resetToDefault = useCallback(() => {
    saveEvents(DEFAULT_EVENTS);
    setEvents(DEFAULT_EVENTS);
  }, []);

  return { events, addEvent, updateEvent, deleteEvent, resetToDefault };
}
