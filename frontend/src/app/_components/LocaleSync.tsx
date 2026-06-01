'use client';
// ============================================================================
// LocaleSync — Syncs Zustand language → cookie + html lang/dir
// Reloads the page when locale changes so next-intl loads correct messages
// ============================================================================
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store';

const RTL_LOCALES = new Set(['ar']);

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? match[1] : undefined;
}

export default function LocaleSync() {
  const language = useAuthStore((s) => s.language);
  const initializedRef = useRef(false);

  useEffect(() => {
    const currentCookie = getCookie('aris-locale');

    // Sync html attributes
    const html = document.documentElement;
    html.lang = language;
    html.dir = RTL_LOCALES.has(language) ? 'rtl' : 'ltr';

    // Set cookie
    document.cookie = `aris-locale=${language}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    // Only reload if user actively changed the language (cookie differs from new value)
    // Skip on first mount to avoid reload loop
    if (initializedRef.current && currentCookie && currentCookie !== language) {
      window.location.reload();
    }
    initializedRef.current = true;
  }, [language]);

  return null;
}
