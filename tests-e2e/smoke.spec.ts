import { test, expect } from '@playwright/test';

test('home boots and play button is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Orders, Please');
  await expect(page.getByRole('button', { name: /Play|First Day/ })).toBeVisible();
});

test('tutorial coach shows guidance text', async ({ page }) => {
  await page.goto('/#/tutorial');
  const coach = page.locator('.coach');
  await expect(coach).toBeVisible();
  await expect(coach).not.toBeEmpty();
});
