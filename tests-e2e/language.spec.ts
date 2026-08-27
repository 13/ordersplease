import { test, expect } from '@playwright/test';

test.describe('a German browser', () => {
  test.use({ locale: 'de-DE' });

  test('gets German on a fresh install', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Spielen|Erster Tag/ })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });
});

test.describe('an Austrian browser', () => {
  test.use({ locale: 'de-AT' });

  test('resolves the region variant to German', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });
});

test.describe('an unsupported browser language', () => {
  test.use({ locale: 'fr-FR' });

  test('falls back to English', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Play|First Day/ })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
