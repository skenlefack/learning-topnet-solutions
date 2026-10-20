'use client';
// ============================================================================
// LocaleSync — Syncs Zustand language → cookie + html lang/dir
// Reload is handled by setLanguage in the store, not here
// ============================================================================
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

const RTL_LOCALES = new Set(['ar']);

export default function LocaleSync() {
  const language = useAuthStore((s) => s.language);
  const hydrated = useAuthStore((s) => s._hydrated);

  useEffect(() => {
    if (!hydrated) return;

    // Sync cookie (without reload — reload is in setLanguage)
    document.cookie = `topnet-locale=${language}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    // Sync html attributes
    const html = document.documentElement;
    html.lang = language;
    html.dir = RTL_LOCALES.has(language) ? 'rtl' : 'ltr';
  }, [language, hydrated]);

  return null;
}
