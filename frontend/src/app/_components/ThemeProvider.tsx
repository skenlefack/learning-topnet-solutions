'use client';
// ============================================================================
// Topnet Solutions Academy — Theme Provider
// Reads theme from Zustand, applies 'dark' class on <html>, persists choice
// ============================================================================
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAuthStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
}
