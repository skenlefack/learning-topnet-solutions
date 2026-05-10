// ============================================================================
// AU-IBAR Learning — Auth Store (Zustand)
// Persisted to localStorage with hydration tracking
// ============================================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  tenantLevel: string;
  preferredLanguage: string;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  _hydrated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: 'fr' | 'en' | 'ar' | 'pt';
  setLanguage: (lang: 'fr' | 'en' | 'ar' | 'pt') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hydrated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      theme: 'light',
      toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
      language: 'fr',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'aris-academy-auth',
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hydrated: true });
      },
    },
  )
);
