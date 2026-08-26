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

test('every destination is reachable from home', async ({ page }) => {
  const targets: Array<[RegExp, string]> = [
    [/Rush night/, '#/rush'],
    [/Daily challenge/, '#/daily'],
    [/Practice/, '#/practice'],
    [/Weekly/, '#/weekly'],
    [/Levels/, '#/levels'],
    [/My menu/, '#/menu'],
    [/Bar/, '#/bar'],
    [/Stats/, '#/stats'],
    [/Settings/, '#/settings'],
  ];
  for (const [name, hash] of targets) {
    await page.goto('/');
    await page.getByRole('button', { name }).click();
    await expect(page).toHaveURL(new RegExp(hash.replace('/', '\\/')));
  }
});

test('play button leads to tutorial or a level', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Play|First Day/ }).click();
  await expect(page).toHaveURL(/#\/(tutorial|game\/\d+)/);
});
