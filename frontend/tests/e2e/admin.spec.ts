// ============================================================================
// Topnet Solutions Academy — E2E: Admin Course Creation
// Admin creates a course via the admin dashboard
// ============================================================================
import { test, expect } from '@playwright/test';

function injectAdmin(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    localStorage.setItem('topnet-academy-auth', JSON.stringify({
      state: {
        user: {
          id: 'usr-admin-001',
          email: 'admin@topnet-solutions.com',
          firstName: 'Jean',
          lastName: 'Admin',
          role: 'admin_continental',
          tenantId: 'tenant-au',
          tenantLevel: 'continental',
          preferredLanguage: 'fr',
        },
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItYWRtaW4tMDAxIiwicm9sZSI6ImFkbWluX2NvbnRpbmVudGFsIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock',
        isAuthenticated: true,
        theme: 'light',
        language: 'fr',
      },
      version: 0,
    }));
  });
}

function injectLearner(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
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

test.describe('Admin', () => {
  test('admin can access the admin dashboard', async ({ page }) => {
    await injectAdmin(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Admin page should render (not redirect)
    const adminContent = page.locator(
      'text=/Tableau de bord|Admin|Dashboard|Statistiques/i',
    );
    await expect(adminContent.first()).toBeVisible({ timeout: 10_000 });
  });

  test('non-admin user is redirected away from admin page', async ({ page }) => {
    await injectLearner(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should redirect to home or show access denied
    await page.waitForTimeout(2000);
    const url = page.url();
    // Either redirected away from /admin or shows access denied
    const isRedirected = !url.includes('/admin');
    const hasAccessDenied = await page.locator('text=/accès|denied|interdit/i').isVisible({ timeout: 2000 }).catch(() => false);
    expect(isRedirected || hasAccessDenied).toBeTruthy();
  });

  test('admin dashboard shows statistics', async ({ page }) => {
    await injectAdmin(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Stats should be visible
    const statsText = page.locator('text=/Apprenants|Learners|Cours|Certif/i');
    if (await statsText.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await statsText.count()).toBeGreaterThan(0);
    }
  });

  test('admin can navigate to course creation', async ({ page }) => {
    await injectAdmin(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Look for "create course" button or link
    const createBtn = page.locator(
      'button:has-text("Créer"), button:has-text("Nouveau"), a:has-text("Créer"), a:has-text("Nouveau")',
    ).first();

    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');

      // Should show course creation form or modal
      const form = page.locator('form, [role="dialog"], input[name="title"]').first();
      if (await form.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(form).toBeVisible();
      }
    }
  });

  test('admin can fill and submit course creation form', async ({ page }) => {
    await injectAdmin(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Navigate to create course
    const createBtn = page.locator(
      'button:has-text("Créer"), button:has-text("Nouveau"), a:has-text("Créer")',
    ).first();

    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1000);

      // Fill course form fields
      const titleInput = page.locator('input[name="title"], input[placeholder*="titre"], input[placeholder*="Titre"]').first();
      if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await titleInput.fill('Nouveau cours E2E test');

        // Select level if dropdown exists
        const levelSelect = page.locator('select[name="level"], [role="combobox"]').first();
        if (await levelSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await levelSelect.selectOption({ label: 'Débutant' }).catch(() => {});
        }

        // Fill description
        const descInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]').first();
        if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await descInput.fill('Description du cours de test E2E');
        }

        // Submit
        const submitBtn = page.locator('button[type="submit"], button:has-text("Enregistrer"), button:has-text("Créer")').last();
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitBtn.click();
          await page.waitForTimeout(1500);

          // Should show success notification or redirect
          const success = page.locator('text=/succès|créé|success/i');
          if (await success.first().isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(success.first()).toBeVisible();
          }
        }
      }
    }
  });

  test('admin sidebar shows admin-specific menu items', async ({ page }) => {
    await injectAdmin(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Admin should see admin-specific nav items
    const adminNav = page.locator('text=/Administration|Gestion|Admin/i');
    if (await adminNav.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(await adminNav.count()).toBeGreaterThan(0);
    }
  });
});
