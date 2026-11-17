/**
 * Theme state. The preference is mirrored into localStorage because the theme
 * must be applied before the vault is unlocked (and before React mounts, see
 * the inline bootstrap in main.tsx) — it is a display setting, never a secret.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ThemePreference } from '@/lib/types';

const STORAGE_KEY = 'passgen.theme';

interface ThemeContextValue {
  preference: ThemePreference;
  /** The theme actually applied once "system" has been resolved. */
  resolved: 'dark' | 'light';
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  } catch {
    /* storage blocked — fall back to the system preference */
  }
  return 'system';
}

function systemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveTheme(preference: ThemePreference): 'dark' | 'light' {
  return preference === 'system' ? systemTheme() : preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemValue, setSystemValue] = useState<'dark' | 'light'>(systemTheme);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const listener = (event: MediaQueryListEvent) => {
      setSystemValue(event.matches ? 'light' : 'dark');
    };
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  const resolved = preference === 'system' ? systemValue : preference;

  useEffect(() => {
    document.documentElement.dataset['theme'] = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    const color = resolved === 'dark' ? '#070b1c' : '#f3f4f9';
    if (meta) {
      meta.setAttribute('content', color);
    } else {
      const created = document.createElement('meta');
      created.name = 'theme-color';
      created.content = color;
      document.head.appendChild(created);
    }
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* non-fatal: the theme simply will not persist */
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
