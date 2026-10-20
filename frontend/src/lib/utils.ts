// ============================================================================
// Topnet Solutions Academy — Utility Helpers
// ============================================================================

/** Extract localised text from a JSONB multilang field. */
export function t(
  text: Record<string, string> | string | null | undefined,
  lang: string = 'en',
): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.en || text.fr || '';
}

/** Level badge metadata — i18n key + Tailwind color. */
export const LEVEL_META: Record<string, { i18nKey: string; color: string }> = {
  beginner: {
    i18nKey: 'levels.beginner',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  intermediate: {
    i18nKey: 'levels.intermediate',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  advanced: {
    i18nKey: 'levels.advanced',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  expert: {
    i18nKey: 'levels.expert',
    color: 'bg-brand-gold/10 text-brand-gold-dark dark:bg-brand-gold/20 dark:text-brand-gold',
  },
};

/** Lesson type icon + i18n key mapping. */
export const LESSON_TYPE_META: Record<string, { i18nKey: string; emoji: string }> = {
  video: { i18nKey: 'lessonTypes.video', emoji: '▶' },
  text: { i18nKey: 'lessonTypes.text', emoji: '📄' },
  quiz: { i18nKey: 'lessonTypes.quiz', emoji: '❓' },
  practical: { i18nKey: 'lessonTypes.practical', emoji: '🔧' },
  replay: { i18nKey: 'lessonTypes.replay', emoji: '🔁' },
};

/** Format minutes to "Xh Ymin". */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}
