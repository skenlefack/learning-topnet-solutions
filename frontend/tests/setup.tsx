import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';
import frMessages from '../messages/fr.json';

// ----------------------------------------------------------------------------
// next-intl mock — components calling useTranslations() get real fr.json values
// without needing to wrap each render() in NextIntlClientProvider.
// ----------------------------------------------------------------------------
vi.mock('next-intl', () => {
  const lookup = (path: string): any =>
    path.split('.').reduce<any>((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), frMessages);

  const interpolate = (template: string, params?: Record<string, unknown>) =>
    !params ? template : Object.entries(params).reduce(
      (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
      template,
    );

  const makeT = (namespace?: string) => {
    const fn = (key: string, params?: Record<string, unknown>) => {
      const fullPath = namespace ? `${namespace}.${key}` : key;
      const value = lookup(fullPath);
      if (typeof value === 'string') return interpolate(value, params);
      // Missing translation: return the key (matches next-intl 'silent' fallback)
      return fullPath;
    };
    fn.rich = (key: string, _values?: any) => fn(key);
    return fn;
  };

  return {
    useTranslations: (namespace?: string) => makeT(namespace),
    useLocale: () => 'fr',
    useFormatter: () => ({
      dateTime: (d: Date | string) => new Date(d).toLocaleString('fr'),
      number: (n: number) => n.toLocaleString('fr'),
      relativeTime: (d: Date | string) => new Date(d).toLocaleDateString('fr'),
    }),
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock IntersectionObserver for components that use it (StatsGrid count-up)
class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    // Immediately trigger as visible
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
globalThis.IntersectionObserver = MockIntersectionObserver as any;

// Mock requestAnimationFrame for count-up animations
let rafId = 0;
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
  rafId++;
  setTimeout(() => cb(performance.now()), 0);
  return rafId;
};
globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: new Proxy(actual.motion, {
      get: (_target, prop) => {
        // Return a simple forwardRef component for motion.div, motion.span, etc.
        if (typeof prop === 'string') {
          const Component = ({ children, ...props }: any) => {
            // Strip motion-specific props
            const {
              variants, initial, animate, exit, transition, whileHover,
              whileTap, whileInView, layout, layoutId, ...domProps
            } = props;
            const Tag = prop as any;
            return <Tag {...domProps}>{children}</Tag>;
          };
          Component.displayName = `motion.${String(prop)}`;
          return Component;
        }
        return (actual.motion as any)[prop];
      },
    }),
  };
});

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
