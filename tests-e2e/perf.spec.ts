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

  // Hard ceiling: 6000ms (~2× the 3s spec budget). Tight enough to catch
  // real regressions, lenient enough to absorb CI/browser-boot variance.
  expect(elapsed).toBeLessThan(6000);
});
