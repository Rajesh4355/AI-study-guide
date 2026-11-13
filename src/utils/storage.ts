import type { StudySession } from '../types/study';
import { DEMO_STUDY_SESSION } from './studySession';

const SESSIONS_STORAGE_KEY = 'studydeck_sessions_v1';
const ACTIVE_SESSION_ID_KEY = 'studydeck_active_session_v1';
const THEME_STORAGE_KEY = 'studydeck_theme_v1';

export type ThemeMode = 'light' | 'dark';

export function loadSavedSessions(): StudySession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) {
      return [DEMO_STUDY_SESSION];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [DEMO_STUDY_SESSION];
    }
    const valid = parsed.filter(
      (item): item is StudySession =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        Boolean(item.deck) &&
        Array.isArray(item.deck.flashcards) &&
        Array.isArray(item.deck.quiz)
    );
    return valid;
  } catch {
    return [DEMO_STUDY_SESSION];
  }
}

export function saveSessions(sessions: StudySession[]): void {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function saveActiveSessionId(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(ACTIVE_SESSION_ID_KEY);
    } else {
      localStorage.setItem(ACTIVE_SESSION_ID_KEY, id);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // Ignore
  }
  return 'light';
}

export function saveThemeMode(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore
  }
}
