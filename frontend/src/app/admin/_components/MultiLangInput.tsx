'use client';
// ============================================================================
// AU-IBAR Learning — MultiLangInput
// Reusable input/textarea with 4 language tabs (FR/EN/AR/PT)
// Includes SYSTRAN auto-translate button
// ============================================================================
import { useState, useCallback } from 'react';
import clsx from 'clsx';
import { Languages, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const LANGS = [
  { code: 'fr' as const, label: 'FR' },
  { code: 'en' as const, label: 'EN' },
  { code: 'ar' as const, label: 'AR' },
  { code: 'pt' as const, label: 'PT' },
];

type LangCode = 'fr' | 'en' | 'ar' | 'pt';

interface MultiLangInputProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  className?: string;
}

export default function MultiLangInput({
  value,
  onChange,
  label,
  placeholder,
  multiline = false,
  rows = 3,
  required = false,
  className,
}: MultiLangInputProps) {
  const [activeLang, setActiveLang] = useState<LangCode>('fr');
  const [translating, setTranslating] = useState(false);

  const handleChange = (text: string) => {
    onChange({ ...value, [activeLang]: text });
  };

  // Auto-translate: takes the source language text and fills missing languages via SYSTRAN
  const handleAutoTranslate = useCallback(async () => {
    // Find source: first non-empty language (prefer fr)
    const sourceLang = (['fr', 'en', 'ar', 'pt'] as LangCode[]).find(l => value[l]?.trim());
    if (!sourceLang) {
      toast.error('Saisissez du texte dans au moins une langue avant de traduire');
      return;
    }
    const sourceText = value[sourceLang]!.trim();

    // Find target languages that are empty
    const targets = (['fr', 'en', 'ar', 'pt'] as LangCode[]).filter(
      l => l !== sourceLang && !value[l]?.trim()
    );
    if (targets.length === 0) {
      toast('Toutes les langues sont déjà remplies', { icon: '\u2139\uFE0F' });
      return;
    }

    setTranslating(true);
    const updated = { ...value };

    try {
      // Call SYSTRAN for each target language in parallel
      const results = await Promise.allSettled(
        targets.map(async (target) => {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: [sourceText], source: sourceLang, target }),
          });
          if (!res.ok) throw new Error(`Erreur traduction ${target}`);
          const data = await res.json();
          return { lang: target, text: data.translations?.[0] || '' };
        })
      );

      let filled = 0;
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.text) {
          updated[r.value.lang] = r.value.text;
          filled++;
        }
      }

      onChange(updated);
      if (filled > 0) {
        toast.success(`${filled} langue${filled > 1 ? 's' : ''} traduite${filled > 1 ? 's' : ''} (${sourceLang.toUpperCase()} \u2192 ${targets.map(t => t.toUpperCase()).join(', ')})`);
      } else {
        toast.error('La traduction a échoué');
      }
    } catch {
      toast.error('Erreur lors de la traduction automatique');
    } finally {
      setTranslating(false);
    }
  }, [value, onChange]);

  const inputClasses = clsx(
    'w-full px-3 py-2 rounded-lg text-sm',
    'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
    'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
    'focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20',
    activeLang === 'ar' && 'text-right',
  );

  // Show translate button only if at least one lang has text and at least one is empty
  const hasSource = (['fr', 'en', 'ar', 'pt'] as LangCode[]).some(l => value[l]?.trim());
  const hasEmpty = (['fr', 'en', 'ar', 'pt'] as LangCode[]).some(l => !value[l]?.trim());
  const showTranslate = hasSource && hasEmpty;

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="flex items-center gap-0.5 mb-1.5">
        {LANGS.map(lang => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setActiveLang(lang.code)}
            className={clsx(
              'px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors',
              activeLang === lang.code
                ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                : 'text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800',
              value[lang.code] && activeLang !== lang.code && 'text-green-600 dark:text-green-400',
            )}
          >
            {lang.label}
          </button>
        ))}
        {showTranslate && (
          <button
            type="button"
            onClick={handleAutoTranslate}
            disabled={translating}
            title="Traduire automatiquement (SYSTRAN)"
            className={clsx(
              'ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors',
              'bg-blue-50 text-blue-600 hover:bg-blue-100',
              'dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {translating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Languages className="w-3 h-3" />
            )}
            {translating ? 'Traduction...' : 'Auto-traduire'}
          </button>
        )}
      </div>
      {multiline ? (
        <textarea
          value={value[activeLang] || ''}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder || `${label || 'Texte'} (${activeLang.toUpperCase()})`}
          rows={rows}
          dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
          className={clsx(inputClasses, 'resize-none')}
          required={required && activeLang === 'fr'}
        />
      ) : (
        <input
          type="text"
          value={value[activeLang] || ''}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder || `${label || 'Texte'} (${activeLang.toUpperCase()})`}
          dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
          className={inputClasses}
          required={required && activeLang === 'fr'}
        />
      )}
    </div>
  );
}
