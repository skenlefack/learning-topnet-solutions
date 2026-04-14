import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

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
