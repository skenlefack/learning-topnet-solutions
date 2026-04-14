'use client';
// ============================================================================
// AU-IBAR Learning — Immersive Learn Layout
// Minimal shell — no sidebar/header. ThemeProvider only.
// ============================================================================
import ThemeProvider from '@/app/_components/ThemeProvider';

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
