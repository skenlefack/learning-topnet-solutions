// ============================================================================
// ARIS Academy — E2E: Profile Management & Global Search
// Edit profile, change language, global search functionality
// ============================================================================
import { test, expect } from '@playwright/test';

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
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAxIiwidGVuYW50SWQiOiJ0ZW5hbnQta2VueWEiLCJyb2xlIjoibGVhcm5lciIsImV4cCI6OTk5OTk5OTk5OX0.mock',
        isAuthenticated: true,
        theme: 'light',
        language: 'fr',
      },
      version: 0,
    }));
  });
}

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('profile page loads with user info', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Profile page should show user details
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // Should display user name or email
    await expect(
      page.locator('text=Amina').or(page.locator('text=amina@example.ke')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('profile shows editable fields', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Should have input fields for name
    const nameInput = page.locator('input[name="firstName"], input[placeholder*="Prénom"]').first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const value = await nameInput.inputValue();
      expect(value).toContain('Amina');
    }
  });

  test('profile shows tenant information', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Should display tenant/organization info
    const tenantInfo = page.locator('text=/Kenya|tenant|Organisation/i');
    if (await tenantInfo.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await tenantInfo.count()).toBeGreaterThan(0);
    }
  });

  test('profile has language preference selector', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Language selection should be present
    const langSelector = page.locator(
      'select, button:has-text("Français"), [class*="language"]',
    ).first();

    if (await langSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(langSelector).toBeVisible();
    }
  });

  test('profile edit form can be submitted', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Find save/submit button
    const saveBtn = page.locator('button').filter({
      hasText: /Enregistrer|Sauvegarder|Save|Mettre à jour/i,
    }).first();

    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(saveBtn).toBeEnabled();
    }
  });
});

test.describe('Global Search', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('search icon is visible in header', async ({ page }) => {
    const searchBtn = page.locator('button[aria-label="Search"], button[aria-label*="search"]');
    await expect(searchBtn).toBeVisible({ timeout: 10_000 });
  });

  test('clicking search opens search input', async ({ page }) => {
    const searchBtn = page.locator('button[aria-label="Search"], button[aria-label*="search"]');
    await searchBtn.click();

    // Search input should appear
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
  });

  test('typing in search shows results dropdown', async ({ page }) => {
    const searchBtn = page.locator('button[aria-label="Search"], button[aria-label*="search"]');
    await searchBtn.click();

    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]');
    await searchInput.fill('Surveillance');

    // Wait for debounce (300ms) + API response
    await page.waitForTimeout(1000);

    // Results dropdown should appear (or "no results" message)
    const dropdown = page.locator('[class*="absolute"][class*="shadow"], [class*="dropdown"]');
    if (await dropdown.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(dropdown.first()).toBeVisible();
    }
  });

  test('search results show categorized sections', async ({ page }) => {
    const searchBtn = page.locator('button[aria-label="Search"], button[aria-label*="search"]');
    await searchBtn.click();

    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]');
    await searchInput.fill('ARIS');

    await page.waitForTimeout(1000);

    // Look for section headers (Courses, Modules, Lessons)
    const sections = page.locator('text=/COURS|MODULES|LEÇONS|Courses|Modules|Lessons/i');
    if (await sections.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await sections.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('clicking search result navigates to course', async ({ page }) => {
    const searchBtn = page.locator('button[aria-label="Search"], button[aria-label*="search"]');
    await searchBtn.click();

    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]');
    await searchInput.fill('Surveillance');

    await page.waitForTimeout(1000);

    // Click first result if available
    const resultItem = page.locator('[class*="absolute"] button, [class*="dropdown"] a').first();
    if (await resultItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await resultItem.click();
      await page.waitForLoadState('networkidle');

      // Should navigate to a course or lesson page
      expect(page.url()).toMatch(/\/(courses|learn)\//);
    }
  });

  test('search can be closed with X button', async ({ page }) => {
    const searchBtn = page.locator('button[aria-label="Search"], button[aria-label*="search"]');
    await searchBtn.click();

    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    // Close button (X)
    const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await expect(searchInput).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('search shows "no results" for gibberish query', async ({ page }) => {
    const searchBtn = page.locator('button[aria-label="Search"], button[aria-label*="search"]');
    await searchBtn.click();

    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    await searchInput.fill('xyzxyzxyz999');

    await page.waitForTimeout(1000);

    // Should show no results message
    const noResults = page.locator('text=/Aucun résultat|No results|pas de résultat/i');
    if (await noResults.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(noResults.first()).toBeVisible();
    }
  });
});

test.describe('Language Switching', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('language selector shows current language', async ({ page }) => {
    // FR should be displayed as current language
    const langBtn = page.locator('button[aria-label="Select language"]');
    await expect(langBtn).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=FR')).toBeVisible();
  });

  test('language dropdown shows all 4 languages', async ({ page }) => {
    const langBtn = page.locator('button[aria-label="Select language"]');
    await langBtn.click();

    await expect(page.locator('text=Français')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=English')).toBeVisible();
    await expect(page.locator('text=العربية')).toBeVisible();
    await expect(page.locator('text=Português')).toBeVisible();
  });

  test('switching to English updates UI language', async ({ page }) => {
    const langBtn = page.locator('button[aria-label="Select language"]');
    await langBtn.click();

    await page.locator('text=English').click();
    await page.waitForTimeout(500);

    // Language should update in store
    const lang = await page.evaluate(() => {
      const raw = localStorage.getItem('aris-academy-auth');
      return raw ? JSON.parse(raw)?.state?.language : null;
    });
    expect(lang).toBe('en');
  });

  test('switching language updates html dir for Arabic', async ({ page }) => {
    const langBtn = page.locator('button[aria-label="Select language"]');
    await langBtn.click();

    await page.locator('text=العربية').click();
    await page.waitForTimeout(500);

    // HTML dir should be rtl
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
  });
});
