'use client';
// ============================================================================
// LocaleSync — Syncs Zustand language → cookie + html lang/dir
// ============================================================================
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

const RTL_LOCALES = new Set(['ar']);

export default function LocaleSync() {
  const language = useAuthStore((s) => s.language);

  useEffect(() => {
    // Sync cookie
    document.cookie = `aris-locale=${language}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    // Sync html attributes
    const html = document.documentElement;
    html.lang = language;
    html.dir = RTL_LOCALES.has(language) ? 'rtl' : 'ltr';
  }, [language]);

  return null;
}
