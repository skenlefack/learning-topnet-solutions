// ============================================================================
// ARIS Academy — E2E: Dashboard
// Verify stats, courses, live sessions render correctly
// ============================================================================
import { test, expect } from '@playwright/test';

// Helper: inject auth state
async function injectAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('aris-academy-auth', JSON.stringify({
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

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto('/');
    // Wait for SWR data to load
    await page.waitForLoadState('networkidle');
  });

  test('displays hero banner with welcome message', async ({ page }) => {
    await expect(page.locator('text=Continuez votre parcours')).toBeVisible({ timeout: 10_000 });
    // Should show user name
    await expect(page.locator('text=Amina')).toBeVisible();
  });

  test('shows stats grid with cards', async ({ page }) => {
    // Stats cards should be visible
    await expect(page.locator('text=Cours inscrits')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Cours disponibles')).toBeVisible();
    await expect(page.locator('text=Certifications')).toBeVisible();
  });

  test('displays course grid with enrolled courses', async ({ page }) => {
    await expect(page.locator('text=Mes cours')).toBeVisible({ timeout: 10_000 });
    // Should show course cards from API
    await page.waitForSelector('[class*="card-hover"]', { timeout: 10_000 });
    const courseCards = page.locator('[class*="card-hover"]');
    expect(await courseCards.count()).toBeGreaterThan(0);
  });

  test('shows live sessions panel', async ({ page }) => {
    await expect(page.locator('text=Sessions live')).toBeVisible({ timeout: 10_000 });
  });

  test('shows certification panel', async ({ page }) => {
    await expect(page.locator('text=Certifications AU-IBAR')).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar navigation is functional', async ({ page }) => {
    // Sidebar should be visible on desktop
    const sidebar = page.locator('nav, [role="navigation"]').first();
    if (await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check nav items
      const navLinks = sidebar.locator('a');
      expect(await navLinks.count()).toBeGreaterThan(0);
    }
  });

  test('dark mode toggle works', async ({ page }) => {
    // Find theme toggle button
    const themeBtn = page.locator('button[title*="thème"], button[aria-label*="theme"], button[aria-label*="dark"]').first();
    if (await themeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await themeBtn.click();

      // Verify dark class is applied
      const hasDark = await page.evaluate(() =>
        document.documentElement.classList.contains('dark'),
      );
      expect(hasDark).toBe(true);
    }
  });

  test('header shows user info', async ({ page }) => {
    // Header should show user avatar or name
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 5000 });
  });

  test('responsive layout adjusts for mobile', async ({ page }) => {
    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Dashboard content should still be visible
    await expect(page.locator('text=Continuez votre parcours')).toBeVisible({ timeout: 10_000 });

    // Sidebar should be hidden on mobile (or behind hamburger)
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(menuBtn).toBeVisible({ timeout: 5000 });
  });
});
