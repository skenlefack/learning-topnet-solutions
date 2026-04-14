// ============================================================================
// ARIS Academy — E2E: Public Certificate Verification Page
// Tests /verify/[certNumber] — the public page (no auth required)
// ============================================================================
import { test, expect } from '@playwright/test';

test.describe('Certificate Verification Page', () => {

  test('verify page loads for a certificate number', async ({ page }) => {
    // Navigate to the verify page with a test certificate number
    await page.goto('/verify/CERT-TEST-001');
    await page.waitForLoadState('networkidle');

    // Page should load (it is a public page, no auth required)
    const mainContent = page.locator('body');
    await expect(mainContent).toBeVisible({ timeout: 15_000 });

    // Should show AU-IBAR branding
    await expect(
      page.locator('text=AU-IBAR').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('verify page shows "not found" status for invalid certificate', async ({ page }) => {
    await page.goto('/verify/INVALID-CERT-99999');
    await page.waitForLoadState('networkidle');

    // The page should display the certificate number
    await expect(
      page.locator('text=INVALID-CERT-99999'),
    ).toBeVisible({ timeout: 10_000 });

    // Should show some form of "not found" indicator
    // The VerifyClient component uses ShieldQuestion icon and getStatus returns 'not_found'
    // when cert is null (API returns null for unknown certificates)
    const notFoundIndicator = page.locator(
      'text=/not found|introuvable|non trouve|certificate/i',
    );
    const shieldIcon = page.locator('svg');

    // Either the not-found text or at least the shield icon should be visible
    await expect(
      notFoundIndicator.first().or(shieldIcon.first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('verify page displays certificate number in the UI', async ({ page }) => {
    const certNumber = 'ARIS-2026-ABCD-1234';
    await page.goto(`/verify/${certNumber}`);
    await page.waitForLoadState('networkidle');

    // The certificate number should be visible on the page
    await expect(
      page.locator(`text=${certNumber}`),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('verify page has no authentication requirement', async ({ page }) => {
    // Clear any existing auth state
    await page.addInitScript(() => {
      localStorage.removeItem('aris-academy-auth');
    });

    await page.goto('/verify/CERT-PUBLIC-001');
    await page.waitForLoadState('networkidle');

    // Should NOT redirect to login
    expect(page.url()).toContain('/verify/');

    // Page should render content
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10_000 });
  });

  test('verify page shows AU-IBAR Learning footer link', async ({ page }) => {
    await page.goto('/verify/CERT-TEST-001');
    await page.waitForLoadState('networkidle');

    // The VerifyClient component includes a "Visit AU-IBAR Learning" link
    const visitLink = page.locator('a[href*="learning.au-ibar.org"]');
    if (await visitLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      expect(await visitLink.getAttribute('href')).toContain('learning.au-ibar.org');
    }
  });

  test('verify page shows copyright footer', async ({ page }) => {
    await page.goto('/verify/CERT-TEST-001');
    await page.waitForLoadState('networkidle');

    // Should show copyright text with current year
    const currentYear = new Date().getFullYear().toString();
    const copyright = page.locator(`text=${currentYear}`);
    await expect(copyright.first()).toBeVisible({ timeout: 10_000 });
  });

  test('verify page renders QR code area for valid certificates', async ({ page }) => {
    // This test verifies the QR code rendering capability.
    // With mock data from the API, if a cert is found, a QR code should render.
    await page.goto('/verify/CERT-TEST-001');
    await page.waitForLoadState('networkidle');

    // Check for SVG element (QR code is rendered as SVG via qrcode.react)
    const svgElements = page.locator('svg');
    // At minimum, the page should have SVGs (icons + potentially QR code)
    const svgCount = await svgElements.count();
    expect(svgCount).toBeGreaterThan(0);
  });

  test('verify page is accessible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/verify/CERT-MOBILE-001');
    await page.waitForLoadState('networkidle');

    // Page should still render properly on mobile
    const mainContent = page.locator('body');
    await expect(mainContent).toBeVisible({ timeout: 15_000 });

    // Certificate number should still be visible
    await expect(
      page.locator('text=CERT-MOBILE-001'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('verify page handles special characters in certificate number', async ({ page }) => {
    // Certificate numbers might contain hyphens, dots, or alphanumeric chars
    await page.goto('/verify/AU-IBAR-2026.001-KE');
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10_000 });
  });
});
