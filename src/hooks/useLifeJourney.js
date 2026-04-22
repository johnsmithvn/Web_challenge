import { useState, useCallback } from 'react';

const STORAGE_KEY = 'vl_life_journey_events';

const DEFAULT_EVENTS = [
  { id: 1, age: 5,  emotion: 5,  label: '5 tuổi',  desc: 'Sinh ra ở Nagoya, Nhật Bản', icon: '👶', type: 'positive' },
  { id: 2, age: 3,  emotion: -3, label: '3 tuổi',  desc: 'Bị té ngã và trầy chân',      icon: '🦶', type: 'negative' },
  { id: 3, age: 4,  emotion: 4,  label: '4 tuổi',  desc: 'Em gái ra đời',               icon: '👧', type: 'positive' },
  { id: 4, age: 5,  emotion: -5, label: '5 tuổi',  desc: 'Bị mắc kẹt trong bẫy cá',    icon: '🐟', type: 'negative' },
  { id: 5, age: 6,  emotion: 2,  label: '6 tuổi',  desc: 'Đi Tokyo Disneyland',         icon: '🏰', type: 'positive' },
  { id: 6, age: 7,  emotion: 4,  label: '7 tuổi',  desc: 'Gặp bạn thân Hayden N.',      icon: '🤝', type: 'positive' },
  { id: 7, age: 8,  emotion: -4, label: '8 tuổi',  desc: 'Bị lạc đường ở Nhật Bản',    icon: '😰', type: 'negative' },
  { id: 8, age: 9,  emotion: 4,  label: '9 tuổi',  desc: 'Giảng sinh ở Florida, Mỹ',   icon: '☀️', type: 'positive' },
  { id: 9, age: 10, emotion: 3,  label: '10 tuổi', desc: 'Đi Malaysia cùng gia đình',   icon: '✈️', type: 'positive' },
  { id: 10, age: 11, emotion: -5, label: '11 tuổi', desc: 'Bị đình chỉ học ở trường', icon: '🏫', type: 'negative' },
  { id: 11, age: 12, emotion: 2,  label: '12 tuổi', desc: 'Phẫu thuật cánh tay',       icon: '🏥', type: 'positive' },
  { id: 12, age: 13, emotion: 5,  label: '13 tuổi', desc: 'Đậu vào đội bóng rổ của trường', icon: '🏀', type: 'positive' },
];

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
