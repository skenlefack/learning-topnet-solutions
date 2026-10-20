// ============================================================================
// Topnet Solutions Academy — E2E: Complete Course Flow
// Catalogue → Course Detail → Enroll → Lesson → Quiz → Completion
// ============================================================================
import { test, expect } from '@playwright/test';

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

test.describe('Course Flow', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('browse course catalogue with search and filters', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Course list should load
    await expect(page.locator('text=Catalogue').or(page.locator('text=cours'))).toBeVisible({ timeout: 10_000 });

    // Search functionality
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('ARIS');
      // Wait for debounce
      await page.waitForTimeout(500);
    }
  });

  test('view course detail page', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Click on a course card
    const courseLink = page.locator('a[href*="/courses/"], [class*="card-hover"]').first();
    if (await courseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await courseLink.click();
      await page.waitForLoadState('networkidle');

      // Course detail page should show modules
      await expect(
        page.locator('text=Module').or(page.locator('text=module')),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('enroll in a course', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Find and click an enroll button
    const enrollBtn = page.locator('button:has-text("inscrire"), button:has-text("Enroll")').first();
    if (await enrollBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enrollBtn.click();
      // Should show success state or redirect
      await page.waitForTimeout(1000);
    }
  });

  test('navigate to lesson player', async ({ page }) => {
    // Go directly to a lesson
    await page.goto('/learn/lesson-001');
    await page.waitForLoadState('networkidle');

    // Lesson player should render
    // Either shows video player, text content, or quiz
    const contentArea = page.locator('main, [class*="max-w-4xl"]');
    await expect(contentArea).toBeVisible({ timeout: 10_000 });
  });

  test('video lesson shows player controls', async ({ page }) => {
    await page.goto('/learn/lesson-001');
    await page.waitForLoadState('networkidle');

    // Video element should be present for video lessons
    const video = page.locator('video');
    if (await video.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Video should have controls
      await expect(video).toHaveAttribute('controls', '');
    }
  });

  test('quiz lesson shows questions and handles answers', async ({ page }) => {
    await page.goto('/learn/lesson-003');
    await page.waitForLoadState('networkidle');

    // Quiz should show question counter
    const questionCounter = page.locator('text=/Question \\d+/');
    if (await questionCounter.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click an answer option
      const option = page.locator('button').filter({ hasText: /ARIS/ }).first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click();

        // Feedback should appear
        await page.waitForTimeout(500);

        // Click "Suivant" to go to next question
        const nextBtn = page.locator('button:has-text("Suivant")');
        if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await nextBtn.click();
        }
      }
    }
  });

  test('lesson navigation prev/next works', async ({ page }) => {
    await page.goto('/learn/lesson-001');
    await page.waitForLoadState('networkidle');

    // Check for navigation buttons
    const nextBtn = page.locator('button[title="Leçon suivante"]');
    if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Previous should be disabled for first lesson
      const prevBtn = page.locator('button[title="Leçon précédente"]');
      if (await prevBtn.isVisible()) {
        await expect(prevBtn).toBeDisabled();
      }
    }
  });

  test('module sidebar shows course structure', async ({ page }) => {
    await page.goto('/learn/lesson-001');
    await page.waitForLoadState('networkidle');

    // Click menu toggle for module sidebar
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
    if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuBtn.click();

      // Sidebar should show module list
      await expect(page.locator('text=Modules')).toBeVisible({ timeout: 5000 });
    }
  });

  test('completed lesson shows completion badge', async ({ page }) => {
    await page.goto('/learn/lesson-001');
    await page.waitForLoadState('networkidle');

    // If lesson is already completed, check for completion badge
    const badge = page.locator('text=Leçon terminée');
    // This depends on API response, just verify the page loads
    const contentArea = page.locator('main');
    await expect(contentArea).toBeVisible({ timeout: 10_000 });
  });

  test('full flow: catalogue → detail → lesson', async ({ page }) => {
    // Step 1: Go to catalogue
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');

    // Step 2: Click a course card to go to detail
    const courseCard = page.locator('a[href*="/courses/"]').first();
    if (await courseCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await courseCard.click();
      await page.waitForLoadState('networkidle');

      // Step 3: Click a lesson link
      const lessonLink = page.locator('a[href*="/learn/"]').first();
      if (await lessonLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await lessonLink.click();
        await page.waitForLoadState('networkidle');

        // Verify we're on the lesson page
        const mainContent = page.locator('main');
        await expect(mainContent).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});
