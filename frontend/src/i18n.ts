import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const SUPPORTED_LOCALES = ['en', 'fr', 'ar', 'pt'] as const;
const DEFAULT_LOCALE = 'en';

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const raw = cookieStore.get('aris-locale')?.value;
  const locale =
    raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)
      ? raw
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
