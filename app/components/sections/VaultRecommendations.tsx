'use client';
import { useSimulator } from '@/lib/useSimulator';
import { useState } from 'react';
import { Kpi, formatPct, formatUSD } from '../Kpi';

export function VaultRecommendations() {
  const { riskTier, lltvDerivation, vaultJson, liquidity, inputs } = useSimulator();
  const [copied, setCopied] = useState(false);

  const onCopyJson = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(JSON.stringify(vaultJson, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const tierTone = riskTier === 'Conservative' ? 'good' : riskTier === 'Moderate' ? 'warn' : 'bad';

  const recommendedLLTVPct = lltvDerivation.snapped
    ? `${(lltvDerivation.snapped * 100).toFixed(1)}%`
    : '—';

  const rows: Array<{ param: string; value: string; source: string }> = [
    {
      param: 'LLTV',
      value: recommendedLLTVPct + ' (snapped from raw ' + formatPct(lltvDerivation.raw, 2) + ')',
      source: '§5 LLTV derivation',
    },
    { param: 'IRM', value: 'AdaptiveCurveIRM', source: 'Only governance-approved option' },
    {
      param: 'Oracle',
      value: 'Manual NAV pusher (today) → Redstone (when live)',
      source: '§5 Oracle Configuration',
    },
    {
      param: 'Performance fee',
      value: formatPct(inputs.performanceFee, 1),
      source: 'Industry standard; well under 50% cap',
    },
    {
      param: 'Management fee',
      value: formatPct(inputs.managementFee, 2) + ' APR',
      source: 'Well under 5% cap',
    },
    {
      param: 'Timelock',
      value: '7 days',
      source: 'Incident response window; not the 3d cooldown',
    },
    {
      param: 'Absolute cap',
      value: formatUSD(liquidity.requiredUSDM + liquidity.withdrawalBuffer_USD),
      source: '§1 = requiredUSDM + withdrawalBuffer',
    },
    { param: 'Relative cap', value: '100%', source: 'Single-market vault at launch' },
    { param: 'MaxRate', value: '200% APR (protocol max)', source: 'Allows IRM to fully self-correct' },
    {
      param: 'Dead deposit (market)',
      value: '1e9 shares to 0xdead',
      source: 'Per Morpho docs',
    },
    {
      param: 'Dead deposit (vault)',
      value: '1e18 shares for 18-dec asset',
      source: 'Per Morpho docs',
    },
    {
      param: 'Seed utilization',
      value: '$1 supply + $0.90 borrow at deploy',
      source: 'Avoid IRM rate decay',
    },
    {
      param: 'Public Allocator',
      value: 'Disabled at launch (single market)',
      source: 'Re-evaluate when multi-market',
    },
    {
      param: 'forceDeallocate',
      value: 'Enabled with small penalty',
      source: 'Noncustodial guarantee',
    },
    {
      param: 'Pre-liquidation',
      value: inputs.preLiquidationEnabled ? 'Enabled, params per §4D' : 'Disabled',
      source: 'Cuts bad debt',
    },
    {
      param: 'Sentinel role',
      value: 'Brix multisig (2-of-3)',
      source: 'Emergency de-risk',
    },
    {
      param: 'Curator role',
      value: 'Brix risk multisig (3-of-5)',
      source: 'Day-to-day config',
    },
    {
      param: 'Allocator role',
      value: 'Brix ops EOA + bot',
      source: 'Liquidity adapter management',
    },
  ];

  return (
    <section id="section-vault-recommendations" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">5. Vault V2 Parameter Recommendations</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Aggregated configuration ready for deployment. Copy the JSON for direct use with the
          Morpho Blue + MetaMorpho deployment scripts.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Risk tier" value={riskTier} tone={tierTone} helpKey="riskTier" />
        <Kpi
          label="User LLTV"
          value={formatPct(inputs.lltv, 1)}
          hint={`recommended ${recommendedLLTVPct}`}
        />
        <Kpi
          label="Computed (snapped) LLTV"
          value={recommendedLLTVPct}
          hint={`raw ${formatPct(lltvDerivation.raw, 2)}`}
          helpKey="recommendedLLTV"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Recommendation table</h3>
        <table className="text-sm w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <th className="text-left py-1 pr-4">Parameter</th>
              <th className="text-left py-1 pr-4">Recommended value</th>
              <th className="text-left py-1">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.param} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-1 pr-4 font-medium">{r.param}</td>
                <td className="py-1 pr-4 tabular-nums">{r.value}</td>
                <td className="py-1 text-xs text-neutral-500">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={onCopyJson}
          className="rounded border border-neutral-400 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 px-3 py-2 text-sm font-medium"
        >
          {copied ? 'Copied!' : 'Copy JSON'}
        </button>
        <details className="flex-1">
          <summary className="cursor-pointer text-sm text-neutral-600 dark:text-neutral-400">
            Preview deployment JSON
          </summary>
          <pre className="mt-2 p-3 text-xs bg-neutral-100 dark:bg-neutral-900 rounded overflow-x-auto">
            {JSON.stringify(vaultJson, null, 2)}
          </pre>
        </details>
      </div>
    </section>
  );
}
