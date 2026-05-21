import { test, expect } from '@playwright/test';

test('/swapliquidity renders all four sections', async ({ page }) => {
  await page.goto('/swapliquidity');
  await expect(page.locator('#section-pool-state')).toBeVisible();
  await expect(page.locator('#section-liquidator-swap')).toBeVisible();
  await expect(page.locator('#section-recovery')).toBeVisible();
  await expect(page.locator('#section-export')).toBeVisible();
});

test('changing pool fee tier updates URL', async ({ page }) => {
  await page.goto('/swapliquidity');
  await page.selectOption('select', '10000');
  await expect(page).toHaveURL(/poolFeeTier=10000/);
});

test('liquidator swap panel shows non-empty USDM output', async ({ page }) => {
  await page.goto('/swapliquidity');
  const usdmCard = page.locator('#section-liquidator-swap >> text=USDM received').locator('xpath=..');
  await expect(usdmCard).toContainText('$');
});

test('homepage section 4 now shows liquidator recovery KPI', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Liquidator recovery')).toBeVisible();
});
