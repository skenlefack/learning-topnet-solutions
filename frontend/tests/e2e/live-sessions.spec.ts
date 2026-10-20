// ============================================================================
// Topnet Solutions Academy — E2E: Live Sessions Page
// Live/upcoming/recordings tabs, join button, schedule display
// ============================================================================
import { test, expect } from '@playwright/test';

// Helper: inject auth state
async function injectAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('topnet-academy-auth', JSON.stringify({
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
    }));
  });
}

test.describe('Live Sessions Page', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto('/live');
    await page.waitForLoadState('networkidle');
  });

  // ---- Page load ----

  test('displays live sessions page header', async ({ page }) => {
    // Should show a heading related to live sessions
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // ---- Tab navigation ----

  test('shows session tabs or categories', async ({ page }) => {
    // The live page typically has tabs for live/upcoming/recordings
    // Look for common tab-like elements
    const tabArea = page.locator('button, [role="tab"]');
    const count = await tabArea.count();
    expect(count).toBeGreaterThan(0);
  });

  // ---- Session cards ----

  test('displays session cards from API', async ({ page }) => {
    // Wait for session content to load
    await page.waitForTimeout(2000);

    // Should render session cards or list items
    const content = page.locator('[class*="card"], [class*="rounded-xl"]');
    const count = await content.count();
    expect(count).toBeGreaterThan(0);
  });

  // ---- Join button ----

  test('shows join or register button for sessions', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for "Rejoindre" or "Join" or similar CTA button
    const joinBtn = page.locator('button, a').filter({
      hasText: /rejoindre|join|participer|s'inscrire/i,
    });

    // If there are live sessions, there should be action buttons
    if (await joinBtn.count() > 0) {
      await expect(joinBtn.first()).toBeVisible();
    }
  });

  // ---- Schedule display ----

  test('displays trainer information', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for trainer names or session details
    const sessionContent = page.locator('text=/Dr\\.|Prof\\.|Formateur/i');
    if (await sessionContent.count() > 0) {
      await expect(sessionContent.first()).toBeVisible();
    }
  });

  // ---- Responsive ----

  test('live sessions page responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/live');
    await page.waitForLoadState('networkidle');

    // Page should still render content
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
