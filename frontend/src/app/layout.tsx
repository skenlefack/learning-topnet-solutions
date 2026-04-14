import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Noto_Sans_Arabic } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import ThemeProvider from './_components/ThemeProvider';
import LocaleSync from './_components/LocaleSync';
import './globals.css';

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AU-IBAR Learning | Online Training Platform',
  description: 'Online training platform of the African Union — Interafrican Bureau for Animal Resources. Capacity building for 55 Member States.',
  keywords: ['AU-IBAR', 'e-learning', 'training', 'African Union', 'capacity building', 'Africa'],
  authors: [{ name: 'AU-IBAR', url: 'https://au-ibar.org' }],
  openGraph: {
    title: 'AU-IBAR Learning',
    description: 'Online training platform for the 55 Member States of the African Union',
    url: 'https://learning.au-ibar.org',
    siteName: 'AU-IBAR Learning',
    locale: 'en',
    type: 'website',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A5632" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AU-IBAR Learning" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`font-sans antialiased ${notoSansArabic.variable}`}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <LocaleSync />
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-sans)',
                  padding: '0.75rem 1rem',
                },
                success: {
                  iconTheme: { primary: '#1A5632', secondary: '#fff' },
                },
                error: {
                  iconTheme: { primary: '#ef4444', secondary: '#fff' },
                },
              }}
            />
          </ThemeProvider>
        </NextIntlClientProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
