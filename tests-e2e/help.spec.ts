// tests-e2e/help.spec.ts
import { test, expect } from '@playwright/test';

test('clicking a KPI ? button opens a popover with A/B/C sections', async ({ page }) => {
  await page.goto('/');
  // Pick the Liquidity Floor ? button (first KPI in section 1).
  const trigger = page.getByRole('button', { name: /help: liquidity floor/i }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/how it's calculated/i)).toBeVisible();
  await expect(dialog.getByText(/b\.\s*definitions/i)).toBeVisible();
  await expect(dialog.getByText(/impact on vault/i)).toBeVisible();
  await expect(dialog.getByRole('link', { name: /more info/i })).toHaveAttribute(
    'href',
    '/help/liquidity-need#liquidityFloor',
  );
});

test('Esc closes the popover and returns focus to the trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /help: liquidity floor/i }).first();
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('/help/liquidity-need renders all section entries', async ({ page }) => {
  await page.goto('/help/liquidity-need');
  await expect(page.getByRole('heading', { name: '1. Liquidity Need' })).toBeVisible();
  // Anchor for the Liquidity Floor entry exists.
  await expect(page.locator('#liquidityFloor')).toBeVisible();
});
