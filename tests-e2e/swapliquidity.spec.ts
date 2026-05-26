import { test, expect } from '@playwright/test';

test('/swapliquidity renders all four sections', async ({ page }) => {
  await page.goto('/swapliquidity');
  await expect(page.locator('#section-pool-state')).toBeVisible();
  await expect(page.locator('#section-slippage-curve')).toBeVisible();
  await expect(page.locator('#section-liquidator-swap')).toBeVisible();
  await expect(page.locator('#section-recovery')).toBeVisible();
});

test('changing pool fee tier updates URL', async ({ page }) => {
  await page.goto('/swapliquidity');
  // Sidebar has multiple selects (LLTV first, then Fee tier). Scope by label.
  const feeTierSelect = page.locator('label', { hasText: /^Fee tier/ }).locator('select');
  await feeTierSelect.selectOption('10000');
  await expect(page).toHaveURL(/poolFeeTier=10000/);
});

test('liquidator swap panel shows non-empty USDM output', async ({ page }) => {
  await page.goto('/swapliquidity');
  // The Kpi component nests label + value in sibling divs inside a card; go up
  // two levels from the label text to reach the card containing the $ value.
  const usdmCard = page
    .locator('#section-liquidator-swap >> text=USDM received')
    .locator('xpath=ancestor::div[contains(@class,"border")][1]');
  await expect(usdmCard).toContainText('$');
});

test('homepage section 4 shows P95 residual Morpho debt KPI', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=P95 residual Morpho debt (USD)').first()).toBeVisible();
});

test('every sidebar field exposes a help affordance', async ({ page }) => {
  await page.goto('/swapliquidity');
  // Editable sidebar fields (Fee tier, AMM TVL, Core, Absorb) each render an
  // InfoTooltip "?" trigger. Read-only rows (LLTV, TVL etc.) intentionally omit
  // tooltips. Asserting ≥4 guards against silent tooltip regressions.
  const sidebar = page.locator('aside');
  const helpTriggers = sidebar.locator('button, [role="button"]').filter({ hasText: /\?/ });
  await expect(helpTriggers.first()).toBeVisible();
  const count = await helpTriggers.count();
  expect(count).toBeGreaterThanOrEqual(4);
});

test('every output section exposes at least one help popover trigger', async ({ page }) => {
  await page.goto('/swapliquidity');
  for (const sectionId of ['#section-pool-state', '#section-slippage-curve', '#section-liquidator-swap', '#section-recovery']) {
    const section = page.locator(sectionId);
    const helpButtons = section.locator('button').filter({ hasText: /\?/ });
    expect(await helpButtons.count(), `${sectionId} should have ≥1 help button`).toBeGreaterThanOrEqual(1);
  }
});

test('/help/swap-liquidity deep-dive page renders', async ({ page }) => {
  await page.goto('/help/swap-liquidity');
  await expect(page.locator('h2', { hasText: 'Swap Liquidity Lab' })).toBeVisible();
  await expect(page.locator('text=The asymmetric ladder we use')).toBeVisible();
  await expect(page.locator('text=Liquidator execution shortfall')).toBeVisible();
  await expect(page.locator('text=Preset export schema')).not.toBeVisible();
  await expect(page.locator('text=Glossary')).toBeVisible();
  await expect(page.locator('text=Code map')).toBeVisible();
});
