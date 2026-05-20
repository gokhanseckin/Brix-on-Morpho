// tests-e2e/help.spec.ts
import { test, expect } from '@playwright/test';

test('clicking a KPI ? button opens a popover with calc / definitions / impact', async ({ page }) => {
  await page.goto('/');
  // Pick the Liquidity Floor ? button (first KPI in section 1).
  const trigger = page.getByRole('button', { name: /help: liquidity floor/i }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 3, name: /how it's calculated/i })).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 3, name: /definitions/i })).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 3, name: /impact on vault/i })).toBeVisible();
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

test('sidebar param tooltip is not clipped by the sidebar overflow', async ({ page }) => {
  // Regression: sidebar has overflow-y-auto which forces overflow-x:auto
  // and clips any absolute-positioned children. Tooltip should portal out
  // and render fully visible regardless of width vs. sidebar.
  await page.goto('/');
  // First "More info" trigger in the sidebar — it's the wiTRY TVL tooltip.
  const trigger = page.getByRole('button', { name: 'More info' }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  // The popover should be a direct child of <body> (portaled out), not
  // nested inside the <aside>.
  const isInBody = await dialog.evaluate((el) => el.parentElement === document.body);
  expect(isInBody).toBe(true);
  // Bounding box should fit within the viewport (not negative-left or
  // overflowing right).
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    if (viewport) expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
});

test('sidebar param tooltip with details shows More info link to the section page', async ({ page }) => {
  await page.goto('/');
  // simulationMode is the first sidebar param with rich `details` content.
  // Open the dropdown's tooltip by clicking the ? after the "Simulation mode" label.
  const trigger = page
    .locator('label')
    .filter({ has: page.locator('span', { hasText: 'Simulation mode' }) })
    .getByRole('button', { name: 'More info' })
    .first();
  await trigger.click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  const moreInfo = dialog.getByRole('link', { name: /more info/i });
  await expect(moreInfo).toHaveAttribute('href', '/help/fx-risk#simulationMode');
});

test('/help/fx-risk includes the simulationMode param entry', async ({ page }) => {
  await page.goto('/help/fx-risk#simulationMode');
  await expect(page.locator('#simulationMode')).toBeVisible();
  // The Options block lists all four modes.
  const entry = page.locator('#simulationMode');
  await expect(entry).toContainText('Bootstrap');
  await expect(entry).toContainText('GBM');
  await expect(entry).toContainText('GBM+Jumps');
  await expect(entry).toContainText('Scenario');
});

test('/help/liquidity-need renders all section entries', async ({ page }) => {
  await page.goto('/help/liquidity-need');
  await expect(page.getByRole('heading', { name: '1. Liquidity Need' })).toBeVisible();
  // Anchor for the Liquidity Floor entry exists.
  await expect(page.locator('#liquidityFloor')).toBeVisible();
});
