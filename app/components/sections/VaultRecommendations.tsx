'use client';
import { useSimulator } from '@/lib/useSimulator';
import { GOV_LLTVS } from '@/types/simulator';
import { useState } from 'react';
import { Kpi, formatPct, formatUSD } from '../Kpi';

const SMALLEST_GOV_LLTV = GOV_LLTVS.filter((lv) => lv > 0).sort((a, b) => a - b)[0]!;

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

  const tierTone =
    riskTier === 'Conservative'
      ? 'good'
      : riskTier === 'Moderate'
        ? 'warn'
        : riskTier === 'Aggressive'
          ? 'bad'
          : 'default';

  const tierHint =
    riskTier === 'Indeterminate'
      ? 'Drawdown + slippage + safety margin exceed what any governance LLTV can absorb. Tighten pool depth or lower safety margin.'
      : undefined;

  const recommendedLLTVPct = lltvDerivation.snapped
    ? `${(lltvDerivation.snapped * 100).toFixed(1)}%`
    : '—';

  const preLLTV = Math.max(0, inputs.lltv - inputs.preLLTVOffset);
  const preLiqDegenerate = inputs.preLiquidationEnabled && preLLTV < SMALLEST_GOV_LLTV;
  const preLiqValue = !inputs.preLiquidationEnabled
    ? 'Scenario off (no borrower authorizations assumed)'
    : preLiqDegenerate
      ? `Enabled, but pre-liq zone [${formatPct(preLLTV, 1)}, ${formatPct(inputs.lltv, 1)}] is below the smallest governance LLTV (${formatPct(SMALLEST_GOV_LLTV, 1)}) — review §4D`
      : 'Scenario on (all borrowers authorized), params per §4D';

  // Morpho architecture:
  //  · MARKET (Morpho Blue createMarket): loanToken, collateralToken, oracle,
  //    irm, lltv. Immutable once created.
  //  · PRE-LIQUIDATION CONTRACT: separate contract deployed alongside a
  //    market. Per-borrower opt-in (Morpho spec §4D).
  //  · VAULT (MetaMorpho): caps, fees, timelock, roles. Allocates supply into
  //    one or more markets.
  type Group = 'market' | 'preLiq' | 'vault';
  const rows: Array<{ group: Group; param: string; value: string; source: string }> = [
    // ─── Market parameters (immutable per Morpho Blue) ───────────────────
    {
      group: 'market',
      param: 'LLTV',
      value: recommendedLLTVPct + ' (snapped from raw ' + formatPct(lltvDerivation.raw, 2) + ')',
      source: '§5 LLTV derivation',
    },
    { group: 'market', param: 'IRM', value: 'AdaptiveCurveIRM', source: 'Only governance-approved option' },
    {
      group: 'market',
      param: 'Oracle',
      value: 'Manual NAV pusher (today) → Redstone (when live)',
      source: '§5 Oracle Configuration',
    },
    {
      group: 'market',
      param: 'MaxRate',
      value: '200% APR (protocol max)',
      source: 'AdaptiveCurveIRM protocol constant; informational',
    },
    {
      group: 'market',
      param: 'Dead deposit (market)',
      value: '1e9 shares to 0xdead',
      source: 'Per Morpho docs — at market deploy',
    },
    {
      group: 'market',
      param: 'Seed utilization',
      value: '$1 supply + $0.90 borrow at deploy',
      source: 'Avoid IRM rate decay',
    },
    // ─── Pre-liquidation contract (per-market, opt-in) ───────────────────
    {
      group: 'preLiq',
      param: 'Pre-liquidation',
      value: preLiqValue,
      source: 'Cuts bad debt — edit on /lltv',
    },
    // ─── Vault parameters (MetaMorpho) ───────────────────────────────────
    {
      group: 'vault',
      param: 'Timelock',
      value: '7 days',
      source: 'Incident response window; not the 3d cooldown',
    },
    {
      group: 'vault',
      param: 'Performance fee',
      value: formatPct(inputs.performanceFee, 1),
      source: 'Sidebar Section 5',
    },
    {
      group: 'vault',
      param: 'Management fee',
      value: formatPct(inputs.managementFee, 2),
      source: 'Sidebar Section 5',
    },
    {
      group: 'vault',
      param: 'Absolute cap',
      value: formatUSD(liquidity.requiredUSDM + liquidity.withdrawalBuffer_USD),
      source: '§1 = requiredUSDM + withdrawalBuffer',
    },
    { group: 'vault', param: 'Relative cap', value: '100%', source: 'Single-market vault at launch' },
    {
      group: 'vault',
      param: 'Dead deposit (vault)',
      value: '1e18 shares for 18-dec asset',
      source: 'Per Morpho docs',
    },
    {
      group: 'vault',
      param: 'Public Allocator',
      value: 'Disabled at launch (single market)',
      source: 'Re-evaluate when multi-market',
    },
    {
      group: 'vault',
      param: 'forceDeallocate',
      value: 'Enabled with small penalty',
      source: 'Noncustodial guarantee',
    },
    {
      group: 'vault',
      param: 'Sentinel role',
      value: 'Brix multisig (2-of-3)',
      source: 'Emergency de-risk',
    },
    {
      group: 'vault',
      param: 'Curator role',
      value: 'Brix risk multisig (3-of-5)',
      source: 'Day-to-day config',
    },
    {
      group: 'vault',
      param: 'Allocator role',
      value: 'Brix ops EOA + bot',
      source: 'Liquidity adapter management',
    },
  ];
  const marketRows = rows.filter((r) => r.group === 'market');
  const preLiqRows = rows.filter((r) => r.group === 'preLiq');
  const vaultRows = rows.filter((r) => r.group === 'vault');

  const renderTable = (tableRows: typeof rows) => (
    <table className="text-sm w-full border-collapse">
      <thead>
        <tr className="border-b border-brix-border">
          <th className="text-left py-1 pr-4">Parameter</th>
          <th className="text-left py-1 pr-4">Recommended value</th>
          <th className="text-left py-1">Source</th>
        </tr>
      </thead>
      <tbody>
        {tableRows.map((r) => (
          <tr key={r.param} className="border-b border-neutral-100 dark:border-neutral-900">
            <td className="py-1 pr-4 font-medium">{r.param}</td>
            <td className="py-1 pr-4 tabular-nums">{r.value}</td>
            <td className="py-1 text-xs text-neutral-500">{r.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <section id="section-vault-recommendations" className="space-y-6">
      <div>
        <div className="brix-kicker mb-2">05 · Deployment config</div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Deployment Recommendations
        </h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
          Three distinct deployment artifacts: the <strong>Morpho Blue market</strong>{' '}
          (immutable once created), an optional{' '}
          <strong>per-market pre-liquidation contract</strong> (borrower opt-in), and the{' '}
          <strong>MetaMorpho vault</strong> that supplies USDM into the market. The JSON
          below is a configuration template: fill contract addresses and convert the
          human-readable cap before submitting a deployment.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="Risk tier"
          value={riskTier}
          tone={tierTone}
          helpKey="riskTier"
          {...(tierHint ? { hint: tierHint } : {})}
        />
        <Kpi label="User LLTV" value={formatPct(inputs.lltv, 1)} />
        <Kpi
          label="Computed (snapped) LLTV"
          value={recommendedLLTVPct}
          hint={`raw ${formatPct(lltvDerivation.raw, 2)}`}
          helpKey="recommendedLLTV"
        />
      </div>

      {/* ─── Market parameters ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold">Market parameters</h3>
        <p className="text-xs text-neutral-500 mt-0.5 mb-2 max-w-2xl">
          Morpho Blue <code>createMarket</code> struct + per-market deployment actions.
          <strong> Immutable once created</strong>. LLTV must come from the
          governance-approved <code>GOV_LLTVS</code> set; edit calibration on{' '}
          <a href="/lltv" className="underline">/lltv</a>.
        </p>
        {renderTable(marketRows)}
      </div>

      {/* ─── Pre-liquidation contract ──────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold">Pre-liquidation contract</h3>
        <p className="text-xs text-neutral-500 mt-0.5 mb-2 max-w-2xl">
          Separate contract deployed alongside the market (Morpho spec §4D).{' '}
          <strong>Per-borrower opt-in</strong>, not part of the market struct or the
          vault. Edit parameters on{' '}
          <a href="/lltv" className="underline">/lltv</a>.
        </p>
        {renderTable(preLiqRows)}
      </div>

      {/* ─── Vault parameters ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-semibold">Vault parameters (MetaMorpho)</h3>
        <p className="text-xs text-neutral-500 mt-0.5 mb-2 max-w-2xl">
          MetaMorpho vault that allocates USDM into the market above. Fees, caps,
          timelock, and roles all live here. Edit fees on the sidebar (Section 5 · Vault
          Params).
        </p>
        {renderTable(vaultRows)}
      </div>

      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={onCopyJson}
          className="rounded border border-brix-border bg-brix-surface hover:border-brix-accent px-3 py-2 text-sm font-medium"
        >
          {copied ? 'Copied!' : 'Copy JSON'}
        </button>
        <details className="flex-1">
          <summary className="cursor-pointer text-sm text-neutral-400">
            Preview deployment JSON (<code>market</code> + <code>vault</code> +{' '}
            <code>preLiquidation</code>)
          </summary>
          <pre className="mt-2 p-3 text-xs bg-brix-surface rounded overflow-x-auto">
            {JSON.stringify(vaultJson, null, 2)}
          </pre>
        </details>
      </div>
    </section>
  );
}
