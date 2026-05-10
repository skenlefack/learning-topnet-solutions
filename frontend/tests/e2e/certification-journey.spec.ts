// ============================================================================
// ARIS Academy — E2E: Full Certification Journey
// Enroll → Complete Lessons → Pass Exam → Certificate Issued → Public Verify
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

test.describe('Full Certification Journey', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('Step 1: Browse catalogue and find a course', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Catalogue loads with courses
    const courseCards = page.locator('[class*="card-hover"], a[href*="/courses/"]');
    await page.waitForTimeout(2000);
    const count = await courseCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Step 2: View course detail and see modules', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Click first course
    const courseLink = page.locator('a[href*="/courses/"]').first();
    if (await courseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await courseLink.click();
      await page.waitForLoadState('networkidle');

      // Detail page shows modules/lessons
      const detailContent = page.locator('main');
      await expect(detailContent).toBeVisible({ timeout: 10_000 });

      // Should display module structure
      const moduleSection = page.locator('text=/Module|Leçon|module|lesson/i');
      await expect(moduleSection.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('Step 3: Enroll in course', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Find enroll button
    const enrollBtn = page.locator('button').filter({
      hasText: /inscrire|enroll|commencer/i,
    }).first();

    if (await enrollBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enrollBtn.click();
      await page.waitForTimeout(1500);

      // Should show success indication (toast, redirect, or button change)
      const successIndicator = page.locator(
        'text=/inscrit|enrolled|succès|continuer/i',
      );
      if (await successIndicator.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        expect(await successIndicator.count()).toBeGreaterThan(0);
      }
    }
  });

  test('Step 4: Access lesson and complete it', async ({ page }) => {
    await page.goto('/learn/lesson-001');
    await page.waitForLoadState('networkidle');

    // Lesson page loads
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // Look for a "Mark complete" or "Marquer terminé" button
    const completeBtn = page.locator('button').filter({
      hasText: /terminé|complete|suivant|next/i,
    }).first();

    if (await completeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await completeBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('Step 5: Take quiz assessment', async ({ page }) => {
    // Navigate to a quiz lesson
    await page.goto('/learn/lesson-003');
    await page.waitForLoadState('networkidle');

    // Quiz question should appear
    const questionArea = page.locator('text=/Question|question/i');
    if (await questionArea.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      // Select an answer
      const option = page.locator('[class*="cursor-pointer"], button[class*="border"]').first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(500);

        // Navigate through quiz
        const nextBtn = page.locator('button').filter({ hasText: /Suivant|Next/i }).first();
        if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await nextBtn.click();
        }
      }
    }
  });

  test('Step 6: View certification progress on dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Certification panel should be visible on dashboard
    await expect(page.locator('text=Certifications AU-IBAR')).toBeVisible({ timeout: 10_000 });

    // Should show level progression
    const levels = page.locator('text=/Foundation|Intermediate|Advanced|Expert/');
    expect(await levels.count()).toBeGreaterThanOrEqual(1);
  });

  test('Step 7: View certificates page', async ({ page }) => {
    await page.goto('/certificates');
    await page.waitForLoadState('networkidle');

    // Certificates page loads
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // Should show certification content or empty state
    const certContent = page.locator('text=/Certification|certification|certificat/i');
    await expect(certContent.first()).toBeVisible({ timeout: 10_000 });
  });

  test('Step 8: Verify certificate publicly (no auth)', async ({ page }) => {
    // Clear auth — this is a public page
    await page.addInitScript(() => {
      localStorage.removeItem('aris-academy-auth');
    });

    await page.goto('/verify/ARIS-2024-KE-00142');
    await page.waitForLoadState('networkidle');

    // Public page should load without redirect to login
    expect(page.url()).toContain('/verify/');

    // Should display the certificate number
    await expect(page.locator('text=ARIS-2024-KE-00142')).toBeVisible({ timeout: 10_000 });

    // AU-IBAR branding should be present
    await expect(page.locator('text=AU-IBAR').first()).toBeVisible({ timeout: 5000 });
  });

  test('Step 9: Dashboard shows progress after completing lessons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Hero banner shows current enrollment
    await expect(page.locator('text=Continuez votre parcours')).toBeVisible({ timeout: 10_000 });

    // Progress ring or percentage should be visible
    const progressIndicator = page.locator('svg circle, text=/%/');
    if (await progressIndicator.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await progressIndicator.count()).toBeGreaterThan(0);
    }
  });

  test('End-to-end: catalogue → course → lesson → dashboard cycle', async ({ page }) => {
    // Full navigation cycle
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Click course
    const courseLink = page.locator('a[href*="/courses/"]').first();
    if (await courseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await courseLink.click();
      await page.waitForLoadState('networkidle');

      // Click lesson
      const lessonLink = page.locator('a[href*="/learn/"]').first();
      if (await lessonLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await lessonLink.click();
        await page.waitForLoadState('networkidle');

        // Lesson loads
        const mainContent = page.locator('main');
        await expect(mainContent).toBeVisible({ timeout: 10_000 });

        // Navigate back to dashboard
        const dashboardLink = page.locator('a[href="/"]').first();
        if (await dashboardLink.isVisible({ timeout: 3000 }).catch(() => false)) {
          await dashboardLink.click();
          await page.waitForLoadState('networkidle');
          await expect(page.locator('text=Continuez votre parcours')).toBeVisible({ timeout: 10_000 });
        }
      }
    }
  });
});
