/**
 * Theme system: Dark (default) / Light / System.
 *
 * - Selection is saved locally in the browser.
 * - An inline script in the <head> applies the mode before the first render to prevent flicker.
 * - All functions are safe during server-side rendering (no "window is not defined" errors).
 */

export type ThemeMode = 'dark' | 'light' | 'system';

export const THEME_STORAGE_KEY = 'orixios.theme';
export const THEME_CHANGED_EVENT = 'orixios:theme-changed';
export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_MODE;
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(raw) ? raw : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') {
    return true;
  }
  if (mode === 'light') {
    return false;
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia(DARK_QUERY).matches;
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('dark', resolveIsDark(mode));
}

export function setThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage failure should not prevent visual switching.
  }
  applyTheme(mode);
  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT));
  }
}

/**
 * Subscribe to theme changes (local switch, another tab, or system preference change
 * during "System" mode). Designed to work with useSyncExternalStore.
 */
export function subscribeToThemeChanges(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  let mediaCleanup: (() => void) | null = null;

  const syncMediaListener = () => {
    if (mediaCleanup) {
      mediaCleanup();
      mediaCleanup = null;
    }
    if (getStoredThemeMode() === 'system' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia(DARK_QUERY);
      const onChange = () => {
        applyTheme('system');
        listener();
      };
      media.addEventListener?.('change', onChange);
      mediaCleanup = () => media.removeEventListener?.('change', onChange);
    }
  };

  const onThemeEvent = () => {
    syncMediaListener();
    listener();
  };

  window.addEventListener(THEME_CHANGED_EVENT, onThemeEvent);
  window.addEventListener('storage', onThemeEvent);
  syncMediaListener();

  return () => {
    window.removeEventListener(THEME_CHANGED_EVENT, onThemeEvent);
    window.removeEventListener('storage', onThemeEvent);
    if (mediaCleanup) {
      mediaCleanup();
    }
  };
}
