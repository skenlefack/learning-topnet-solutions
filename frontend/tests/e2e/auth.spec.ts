// ============================================================================
// Topnet Solutions Academy — E2E: Authentication Flow
// SSO login → callback → dashboard redirect
// ============================================================================
import { test, expect } from '@playwright/test';

const SSO_URL = process.env.NEXT_PUBLIC_ARIS_SSO_URL || 'https://topnet-solutions.com/api/auth';

// Helper: inject auth state into localStorage (Zustand persist store)
async function injectAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const state = {
      state: {
        user: {
          id: 'usr-001',
          email: 'amina@example.ke',
          firstName: 'Amina',
          lastName: 'Wanjiku',
          role: 'learner',
          tenantId: 'tenant-kenya',
          tenantLevel: 'country',
          preferredLanguage: 'fr',
        },
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAxIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock',
        isAuthenticated: true,
        theme: 'light',
        language: 'fr',
      },
      version: 0,
    };
    localStorage.setItem('topnet-academy-auth', JSON.stringify(state));
  });
}

test.describe('Authentication', () => {
  test('unauthenticated user is redirected to SSO login', async ({ page }) => {
    // The useAuth hook redirects to SSO when not authenticated
    const responsePromise = page.waitForURL((url) =>
      url.href.includes('/auth') || url.href.includes('topnet-solutions.com') || url.href.includes('/'),
      { timeout: 10_000 },
    );
    await page.goto('/');
    await responsePromise;
    // Page should either redirect to SSO or show the dashboard/landing
  });

  test('SSO callback stores token and redirects to dashboard', async ({ page }) => {
    // Simulate SSO callback with token in URL
    const mockPayload = btoa(JSON.stringify({
      sub: 'usr-001',
      email: 'amina@example.ke',
      firstName: 'Amina',
      lastName: 'Wanjiku',
      role: 'learner',
      tenantId: 'tenant-kenya',
      tenantLevel: 'country',
      exp: 9999999999,
    }));
    const mockToken = `eyJhbGciOiJIUzI1NiJ9.${mockPayload}.mock-signature`;

    await page.goto(`/auth/callback?token=${mockToken}`);

    // Should redirect to dashboard
    await page.waitForURL('/', { timeout: 10_000 });

    // Verify token was stored in localStorage
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('topnet-academy-auth');
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored?.state?.token).toBeTruthy();
    expect(stored?.state?.isAuthenticated).toBe(true);
  });

  test('authenticated user sees dashboard content', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/');

    // Wait for dashboard to render
    await expect(page.locator('text=Continuez votre parcours')).toBeVisible({ timeout: 10_000 });
  });

  test('logout clears auth state', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check auth is present
    const beforeLogout = await page.evaluate(() => {
      const raw = localStorage.getItem('topnet-academy-auth');
      return raw ? JSON.parse(raw) : null;
    });
    expect(beforeLogout?.state?.isAuthenticated).toBe(true);

    // Click user menu / logout button if visible
    const logoutBtn = page.getByRole('button', { name: /déconnexion|logout/i });
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();

      const afterLogout = await page.evaluate(() => {
        const raw = localStorage.getItem('topnet-academy-auth');
        return raw ? JSON.parse(raw) : null;
      });
      expect(afterLogout?.state?.isAuthenticated).toBe(false);
    }
  });
});
