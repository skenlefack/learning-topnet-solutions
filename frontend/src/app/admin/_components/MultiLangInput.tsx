'use client';
// ============================================================================
// AU-IBAR Learning — MultiLangInput
// Reusable input/textarea with 4 language tabs (FR/EN/AR/PT)
// ============================================================================
import { useState } from 'react';
import clsx from 'clsx';

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

  const handleChange = (text: string) => {
    onChange({ ...value, [activeLang]: text });
  };

  const inputClasses = clsx(
    'w-full px-3 py-2 rounded-lg text-sm',
    'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
    'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
    'focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20',
    activeLang === 'ar' && 'text-right',
  );

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="flex gap-0.5 mb-1.5">
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
