import { test, expect } from '@playwright/test';

test('Monte Carlo (1000 paths × 90 days) completes under 3000ms (best-effort)', async ({ page }) => {
  // Force pathCount=1000 horizon=90 via URL.
  const url = '/?pathCount=1000&simulationHorizonDays=90';

  const start = Date.now();
  await page.goto(url);

  // Wait for the "Paths simulated" KPI to display the actual number.
  // The Kpi label sits above the value div; we wait for "1000" to appear in the value.
  const pathsKpi = page
    .getByText('Paths simulated', { exact: true })
    .locator('xpath=following-sibling::div[1]');
  await pathsKpi.waitFor();
  await expect(pathsKpi).toHaveText('1000', { timeout: 30_000 });
  const elapsed = Date.now() - start;

  // Log the timing for the report.
  // Includes navigation/hydration/worker boot — so an upper bound on worker run time.
  console.log(`PERF: time-to-first-result (1000×90) = ${elapsed}ms`);

  // Soft budget: 3000ms. We do not fail the test above this — performance work
  // is best-effort per the spec. Use a generous hard ceiling instead.
  expect(elapsed).toBeLessThan(30_000);
});
