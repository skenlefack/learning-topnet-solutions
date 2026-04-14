// ============================================================================
// ARIS Academy — E2E: Login Flow
// Tests the login modal on the landing page with dev credentials
// ============================================================================
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {

  test('landing page loads and shows login button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The landing page should have the AU-IBAR Learning branding
    await expect(
      page.locator('text=AU-IBAR').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Login button should be present in the navbar
    const loginBtn = page.locator('button').filter({ hasText: /connexion|login|se connecter/i }).first();
    await expect(loginBtn).toBeVisible({ timeout: 10_000 });
  });

  test('clicking login opens the login modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click the login button
    const loginBtn = page.locator('button').filter({ hasText: /connexion|login|se connecter/i }).first();
    await loginBtn.click();

    // The modal should appear with email and password fields
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 5_000 });

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 5_000 });

    // Submit button should be present
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible({ timeout: 3_000 });
  });

  test('login with valid dev credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open login modal
    const loginBtn = page.locator('button').filter({ hasText: /connexion|login|se connecter/i }).first();
    await loginBtn.click();

    // Fill in credentials
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('serge@au-ibar.org');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('academy2026');

    // Submit the form
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Should redirect to dashboard (either / or /dashboard)
    await page.waitForURL((url) =>
      url.pathname === '/' || url.pathname.includes('/dashboard'),
      { timeout: 15_000 },
    );

    // Verify auth state was stored
    const authState = await page.evaluate(() => {
      const raw = localStorage.getItem('aris-academy-auth');
      return raw ? JSON.parse(raw) : null;
    });

    expect(authState?.state?.isAuthenticated).toBe(true);
    expect(authState?.state?.token).toBeTruthy();
    expect(authState?.state?.user?.email).toBe('serge@au-ibar.org');
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open login modal
    const loginBtn = page.locator('button').filter({ hasText: /connexion|login|se connecter/i }).first();
    await loginBtn.click();

    // Fill in wrong credentials
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('serge@au-ibar.org');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('wrong-password');

    // Submit
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Error message should appear
    await expect(
      page.locator('[class*="bg-"][class*="dc3545"]').or(
        page.locator('text=/invalid|incorrect|erreur|identifiants/i'),
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('login modal can be closed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open login modal
    const loginBtn = page.locator('button').filter({ hasText: /connexion|login|se connecter/i }).first();
    await loginBtn.click();

    // Modal should be visible
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 5_000 });

    // Close the modal (click the X button or backdrop)
    const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x, svg[class*="x"]') }).first();
    if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      // Click backdrop
      await page.locator('.fixed.inset-0 .absolute.inset-0').first().click({ force: true });
    }

    // Modal should be hidden
    await expect(emailInput).not.toBeVisible({ timeout: 3_000 });
  });

  test('login with different roles (learner)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open login modal
    const loginBtn = page.locator('button').filter({ hasText: /connexion|login|se connecter/i }).first();
    await loginBtn.click();

    // Fill in learner credentials
    await page.locator('input[type="email"]').fill('learner@kenya.go.ke');
    await page.locator('input[type="password"]').fill('academy2026');
    await page.locator('button[type="submit"]').click();

    // Should redirect
    await page.waitForURL((url) =>
      url.pathname === '/' || url.pathname.includes('/dashboard'),
      { timeout: 15_000 },
    );

    // Verify correct user data stored
    const authState = await page.evaluate(() => {
      const raw = localStorage.getItem('aris-academy-auth');
      return raw ? JSON.parse(raw) : null;
    });

    expect(authState?.state?.user?.role).toBe('learner');
    expect(authState?.state?.user?.tenantId).toBe('kenya');
  });
});
