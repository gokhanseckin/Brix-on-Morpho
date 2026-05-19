import { test, expect } from '@playwright/test';

const HEADINGS = [
  '1. USDM Liquidity Need',
  '2. FX Risk',
  '3. Liquidity Strategy',
  '4. Liquidation Design',
  '5. Vault V2 Parameter Recommendations',
];

// Read the KPI value (the <Kpi> component renders label in a sibling div above value)
async function getRequiredSteadyState(page: import('@playwright/test').Page): Promise<string> {
  const label = page.getByText('Required (steady-state)', { exact: true }).first();
  await label.waitFor();
  // Value is the immediately-following sibling div within the Kpi container.
  const value = label.locator('xpath=following-sibling::div[1]');
  await value.waitFor();
  return (await value.textContent())?.trim() ?? '';
}

async function getLltvFromUrl(page: import('@playwright/test').Page): Promise<string | null> {
  const url = new URL(page.url());
  return url.searchParams.get('lltv');
}

test.describe('Brix Morpho simulator smoke', () => {
  test('all 5 sections render', async ({ page }) => {
    await page.goto('/');
    for (const h of HEADINGS) {
      // headings may be rendered as sr-only (section anchor) AND inline (section component)
      const found = page.getByRole('heading', { name: h }).first();
      await expect(found).toBeAttached();
    }
  });

  test('LLTV reactivity updates Required (steady-state) KPI', async ({ page }) => {
    await page.goto('/');

    const before = await getRequiredSteadyState(page);

    // The LLTV select is the SelectField labeled "LLTV" in the sidebar.
    const lltvSelect = page.locator('label').filter({ has: page.locator('span', { hasText: /^LLTV$/ }) }).locator('select');
    await lltvSelect.waitFor();

    // Pick a different governance LLTV. Inspect options to choose one ≠ current.
    const options = await lltvSelect.locator('option').allTextContents();
    const currentValue = await lltvSelect.inputValue();

    // GOV_LLTVS values (string form). Use a value that is definitely different.
    const candidates = ['0.385', '0.625', '0.77', '0.86', '0.915', '0.945', '0.965', '0.98'];
    const target = candidates.find((c) => c !== currentValue) ?? '0.86';
    await lltvSelect.selectOption(target);

    // Wait for URL to update (nuqs).
    await page.waitForFunction(
      (t) => new URL(window.location.href).searchParams.get('lltv') === t,
      target,
    );

    const after = await getRequiredSteadyState(page);
    expect(after).not.toEqual(before);
    expect(options.length).toBeGreaterThan(1);
  });

  test('share link round-trip preserves LLTV', async ({ browser, page }) => {
    await page.goto('/');

    const lltvSelect = page.locator('label').filter({ has: page.locator('span', { hasText: /^LLTV$/ }) }).locator('select');
    await lltvSelect.waitFor();
    // Force a non-default value so the URL contains an explicit lltv.
    const candidates = ['0.385', '0.625', '0.77', '0.86', '0.915', '0.945', '0.965', '0.98'];
    const current = await lltvSelect.inputValue();
    const target = candidates.find((c) => c !== current) ?? '0.86';
    await lltvSelect.selectOption(target);
    await page.waitForFunction(
      (t) => new URL(window.location.href).searchParams.get('lltv') === t,
      target,
    );

    const sharedUrl = page.url();
    const sourceLltv = await getLltvFromUrl(page);
    expect(sourceLltv).toEqual(target);

    // Open a fresh context with the shared URL.
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto(sharedUrl);
    const lltv2 = p2.locator('label').filter({ has: p2.locator('span', { hasText: /^LLTV$/ }) }).locator('select');
    await lltv2.waitFor();
    await expect(lltv2).toHaveValue(target);
    await ctx.close();
  });
});
