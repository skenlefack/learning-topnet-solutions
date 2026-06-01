'use client';
// ============================================================================
// AU-IBAR Learning — SYSTRAN Translation Hook
// Translates dynamic content (course titles, descriptions, etc.) via SYSTRAN
// Uses in-memory cache to avoid redundant API calls
// ============================================================================
import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/store';

const cache = new Map<string, string>();

function cacheKey(text: string, target: string) {
  return `${target}:${text.slice(0, 100)}`;
}

export function useTranslate() {
  const language = useAuthStore((s) => s.language);
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef(false);

  const translate = useCallback(async (texts: string[], source?: string): Promise<string[]> => {
    if (language === 'fr' && (!source || source === 'fr')) return texts;
    if (language === 'en' && source === 'en') return texts;

    // Check cache
    const results: (string | null)[] = texts.map(t => cache.get(cacheKey(t, language)) || null);
    const uncached = texts.filter((_, i) => !results[i]);

    if (uncached.length === 0) return results as string[];

    if (pendingRef.current) return texts; // avoid parallel calls
    pendingRef.current = true;
    setLoading(true);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: uncached, source: source || 'fr', target: language }),
      });

      if (!res.ok) return texts;

      const data = await res.json();
      const translated = data.translations || [];

      // Fill cache and results
      let idx = 0;
      for (let i = 0; i < results.length; i++) {
        if (!results[i]) {
          const t = translated[idx] || texts[i];
          cache.set(cacheKey(texts[i], language), t);
          results[i] = t;
          idx++;
        }
      }

      return results as string[];
    } catch {
      return texts;
    } finally {
      setLoading(false);
      pendingRef.current = false;
    }
  }, [language]);

  const translateOne = useCallback(async (text: string, source?: string): Promise<string> => {
    if (!text) return text;
    const [result] = await translate([text], source);
    return result;
  }, [translate]);

  return { translate, translateOne, loading, language };
}

// Helper: get text from MultiLangText, with SYSTRAN fallback
export function getLocalizedText(
  text: Record<string, string> | string | undefined,
  lang = 'fr',
): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.fr || text.en || Object.values(text)[0] || '';
}
