/**
 * زر تبديل الثيم: داكن ← فاتح ← حسب النظام ← داكن.
 * - يحفظ الاختيار محليًا.
 * - لا يسبب hydration mismatch (لقطة الخادم ثابتة).
 * - يعمل بلوحة المفاتيح (زر حقيقي) وله تسمية واضحة.
 */

'use client';

import { useSyncExternalStore } from 'react';
import {
  getStoredThemeMode,
  setThemeMode,
  subscribeToThemeChanges,
  type ThemeMode,
} from '@/lib/theme/theme-mode';

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
};

const MODE_LABEL: Record<ThemeMode, string> = {
  dark: 'الوضع الحالي: داكن. اضغط للتبديل إلى الوضع الفاتح.',
  light: 'الوضع الحالي: فاتح. اضغط للتبديل إلى وضع النظام.',
  system: 'الوضع الحالي: حسب النظام. اضغط للتبديل إلى الوضع الداكن.',
};

function ModeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 2.5V5m0 14v2.5M2.5 12H5m14 0h2.5M5.3 5.3l1.8 1.8m9.8 9.8 1.8 1.8m0-13.4-1.8 1.8M7.1 16.9l-1.8 1.8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 20.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const mode = useSyncExternalStore(
    subscribeToThemeChanges,
    getStoredThemeMode,
    () => 'dark' as ThemeMode,
  );

  return (
    <button
      type="button"
      onClick={() => setThemeMode(NEXT_MODE[mode])}
      aria-label={MODE_LABEL[mode]}
      title={MODE_LABEL[mode]}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60 ${className}`}
    >
      <ModeIcon mode={mode} />
      <span className="sr-only">{MODE_LABEL[mode]}</span>
    </button>
  );
}
