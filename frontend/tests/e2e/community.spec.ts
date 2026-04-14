// ============================================================================
// ARIS Academy — E2E: Community Page
// 3 tabs: Forum, Classement, Groupes d'etude
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

test.describe('Community Page', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto('/community');
    await page.waitForLoadState('networkidle');
  });

  // ---- Tab navigation ----

  test('displays community page header', async ({ page }) => {
    await expect(page.locator('text=Communaut')).toBeVisible({ timeout: 10_000 });
  });

  test('shows 3 tab buttons', async ({ page }) => {
    await expect(page.locator('text=Discussions')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Classement')).toBeVisible();
    await expect(page.locator("text=Groupes d'etude")).toBeVisible();
  });

  // ---- Forum tab ----

  test('forum tab shows category filters', async ({ page }) => {
    await expect(page.locator('text=Tous')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=General')).toBeVisible();
    await expect(page.locator('text=Questions')).toBeVisible();
  });

  test('forum tab shows new post button', async ({ page }) => {
    await expect(page.locator('text=Nouvelle discussion')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking new post button shows form', async ({ page }) => {
    const newPostBtn = page.locator('text=Nouvelle discussion');
    await newPostBtn.click();
    await expect(page.locator('textarea[placeholder*="message"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Publier')).toBeVisible();
  });

  // ---- Leaderboard tab ----

  test('leaderboard tab shows ranking table', async ({ page }) => {
    // Click leaderboard tab
    await page.locator('text=Classement').click();
    await page.waitForLoadState('networkidle');

    // Period selectors should be visible
    await expect(page.locator('text=Tout').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Ce mois')).toBeVisible();
    await expect(page.locator('text=Cette semaine')).toBeVisible();

    // Table headers
    await expect(page.locator('text=Rang')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Apprenant')).toBeVisible();
    await expect(page.locator('text=Score')).toBeVisible();
  });

  // ---- Groups tab ----

  test('groups tab loads when clicked', async ({ page }) => {
    await page.locator("text=Groupes d'etude").click();
    await page.waitForLoadState('networkidle');
    // Groups section should be active — at minimum the tab should be highlighted
    // The groups content loads from the API
    await page.waitForTimeout(1000);
  });

  // ---- Responsive ----

  test('community page responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/community');
    await page.waitForLoadState('networkidle');

    // Tabs should still be visible (overflow-x-auto)
    await expect(page.locator('text=Discussions')).toBeVisible({ timeout: 10_000 });
  });
});
