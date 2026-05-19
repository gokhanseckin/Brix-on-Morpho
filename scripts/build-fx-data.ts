// Downloads daily USD/TRY history from Yahoo Finance chart API (2015-01-01..today)
// and writes lib/usdtryData.json.
//
// Deviation note: The plan referenced FRED series `DEXTUUS` via fredgraph.csv,
// but that series has been discontinued (HTTP 404). Yahoo Finance's public
// chart endpoint for `TRY=X` is used as a drop-in replacement. The output
// JSON shape (`{ source, fetchedAt, rows: [{date, rate}] }`) is unchanged.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PERIOD1 = Math.floor(new Date('2015-01-01T00:00:00Z').getTime() / 1000);
const PERIOD2 = Math.floor(Date.now() / 1000);
const URL =
  `https://query1.finance.yahoo.com/v8/finance/chart/TRY=X?period1=${PERIOD1}&period2=${PERIOD2}&interval=1d`;

type Row = { date: string; rate: number };

type YahooChart = {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: { quote: Array<{ close: (number | null)[] }> };
    }> | null;
    error: unknown;
  };
};

async function main() {
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = (await res.json()) as YahooChart;
  const result = json.chart.result?.[0];
  if (!result) throw new Error(`Yahoo returned no result: ${JSON.stringify(json.chart.error)}`);
  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0]?.close ?? [];
  const rows: Row[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const close = closes[i];
    if (ts == null || close == null) continue;
    const rate = Number(close);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    rows.push({ date, rate });
  }
  // Yahoo can include duplicate dates around DST or stub rows — dedupe keep-last.
  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.date, r.rate);
  const dedup: Row[] = Array.from(byDate.entries())
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out = resolve(process.cwd(), 'lib/usdtryData.json');
  writeFileSync(
    out,
    JSON.stringify({
      source: 'Yahoo Finance TRY=X (daily)',
      fetchedAt: new Date().toISOString(),
      rows: dedup,
    }),
  );
  console.log(`Wrote ${dedup.length} rows → ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
