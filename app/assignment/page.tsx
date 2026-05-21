'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/* ---------- types ---------- */

type Slide = {
  id: string;
  title: string;
  render: () => React.ReactNode;
};

/* ---------- shared atoms ---------- */

const ACCENT = '#5b9dff';

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-neutral-700 px-3 py-1 text-[13px] uppercase tracking-[0.18em] text-neutral-400">
      {children}
    </span>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 text-[13px] uppercase tracking-[0.22em] text-neutral-500">
      {children}
    </div>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span style={{ color: ACCENT }}>{children}</span>;
}

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
      {children}
    </h1>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="text-[22px] leading-[1.5] text-neutral-300">{children}</p>;
}

function Footnote({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.5] text-neutral-500">{children}</p>;
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function NumberBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="text-[12px] uppercase tracking-[0.22em] text-neutral-500">
        {label}
      </div>
      <div
        className="mt-3 font-mono text-4xl font-semibold tracking-tight md:text-5xl"
        style={{ color: ACCENT }}
      >
        {value}
      </div>
      {hint && <div className="mt-3 text-[15px] text-neutral-400">{hint}</div>}
    </Card>
  );
}

/* ---------- slides ---------- */

const slides: Slide[] = [
  /* 1. Cover ----------------------------------------------------------- */
  {
    id: 'cover',
    title: 'Cover',
    render: () => (
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <Tag>Brix · Internal</Tag>
          <Tag>2026-05-21</Tag>
        </div>
        <div>
          <Kicker>Morpho launch plan</Kicker>
          <H1>
            wiTRY <Accent>→</Accent> USDM
            <br />
            on Morpho Blue, MegaETH
          </H1>
          <p className="mt-8 max-w-2xl text-[24px] leading-[1.45] text-neutral-400">
            A pre-launch pitch for partners, parameters, and the one constraint
            that runs the whole market.
          </p>
        </div>
        <div className="flex items-end justify-between text-[14px] text-neutral-500">
          <div>Prepared by Gökhan · Brix</div>
          <div>Use → / ← to navigate · ? for shortcuts</div>
        </div>
      </div>
    ),
  },

  /* 2. Economy flow ---------------------------------------------------- */
  {
    id: 'economy-flow',
    title: 'The economy flow',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>02 · Economy flow</Kicker>
        <H2>
          One market, six actors, two kinds of flow.
        </H2>
        <div className="mt-8 flex-1">
          <EconomySvg />
        </div>
        <Footnote>
          Solid lines = asset flow. Dashed lines = incentive flow. Curator slot
          shown as TBD — see slide 6.
        </Footnote>
      </div>
    ),
  },

  /* 3. USDM liquidity requirement ------------------------------------- */
  {
    id: 'liquidity-need',
    title: 'USDM liquidity requirement',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>03 · How much USDM do we need?</Kicker>
        <H2>
          required supply <Accent>≈</Accent> borrow <Accent>÷</Accent>{' '}
          utilization
        </H2>
        <Body>
          Lenders supply USDM. Borrowers take USDM against wiTRY collateral.
          We size the supply to the borrow demand, with a buffer so we never
          sit at 100% utilization.
        </Body>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <NumberBlock
            label="Baseline A · $1M borrow"
            value="$1.11–1.25M"
            hint={
              <>
                USDM supply at 80–90% utilization. Add 10–20% buffer →{' '}
                <Accent>~$1.4M</Accent> healthy floor.
              </>
            }
          />
          <NumberBlock
            label="Baseline B · $5M borrow"
            value="$5.56–6.25M"
            hint={
              <>
                USDM supply at 80–90% utilization. Add 10–20% buffer →{' '}
                <Accent>~$7M</Accent> healthy floor.
              </>
            }
          />
        </div>
        <Footnote>
          Buffer rule: curators want headroom. A market pinned at 100%
          utilization can&apos;t service withdrawals and looks dead.
        </Footnote>
      </div>
    ),
  },

  /* 4. Tracking & managing -------------------------------------------- */
  {
    id: 'tracking',
    title: 'Tracking & managing liquidity',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>04 · Operations</Kicker>
        <H2>Watch six numbers. Act on three.</H2>
        <div className="mt-8 grid grid-cols-3 gap-4 text-[17px]">
          {[
            { k: 'Utilization', v: 'Stay 70–90%. Above 95% = trouble.' },
            { k: 'Idle USDM', v: 'Lender cushion for withdrawals.' },
            { k: 'Time at 100% util', v: 'If > 1h, raise borrow rate or supply cap.' },
            { k: 'Supply / borrow caps', v: 'Sized to Kumbaya pool — slide 9.' },
            { k: 'Curator allocation share', v: 'How much of vault TVL is ours.' },
            { k: 'Bad-debt P95', v: 'From our FX model. Slide 13.' },
          ].map(({ k, v }) => (
            <Card key={k}>
              <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
                {k}
              </div>
              <div className="mt-2 text-neutral-300">{v}</div>
            </Card>
          ))}
        </div>
        <div className="mt-8">
          <Body>
            Tools: the Morpho frontend for the live numbers, plus an internal
            dashboard powered by{' '}
            <a href="/" className="underline" style={{ color: ACCENT }}>
              this simulator
            </a>{' '}
            for forward-looking risk.
          </Body>
        </div>
      </div>
    ),
  },

  /* 5. Attracting liquidity — 3-layer stack --------------------------- */
  {
    id: 'attract',
    title: 'Attracting liquidity',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>05 · Bootstrapping</Kicker>
        <H2>
          Three layers of incentives.{' '}
          <Accent>One layer we pay for.</Accent>
        </H2>
        <div className="mt-8 grid grid-cols-3 gap-5">
          <IncentiveLayer
            n="1"
            name="Merkl program"
            who="Borrower-side"
            paidBy="Brix (3% fee)"
            detail="Merkl is the only first-class rewards rail on Morpho since MIP-111 (Jul 2025). 8-hour distribution cadence. Managed by feather.zone (TBV) so we don't run the campaign ops in-house."
          />
          <IncentiveLayer
            n="2"
            name="MegaETH rewards"
            who="Supply + borrow side"
            paidBy="MegaETH ecosystem"
            detail="MEGA token, MegaMafia points, KPI-tranche eligibility. Aave got from $0 → $1B on MegaETH on this rail. Free supply-side bootstrap we don't pay for."
            highlight
          />
          <IncentiveLayer
            n="3"
            name="Brix-native kicker"
            who="Borrowers only, if needed"
            paidBy="Brix"
            detail="Short-window borrower incentive. Only deploy if layers 1+2 underperform. Default: off."
          />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5">
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              Punchline
            </div>
            <div className="mt-2 text-[20px] leading-[1.5] text-neutral-200">
              Incentivize <Accent>borrowers</Accent>, not lenders. Lenders
              already earn yield from borrow APY — subsidizing them
              double-pays.
            </div>
          </Card>
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              The biggest distribution lever
            </div>
            <div className="mt-2 text-[20px] leading-[1.5] text-neutral-200">
              Curators <Accent>are</Accent> distribution. A signed curator
              brings their LPs with them. Slide 6.
            </div>
          </Card>
        </div>
      </div>
    ),
  },

  /* 6. Curator shortlist ---------------------------------------------- */
  {
    id: 'curators',
    title: 'Curator shortlist',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>06 · Who runs the vault</Kicker>
        <H2>
          Five candidates.{' '}
          <Accent>No fallback.</Accent>
        </H2>
        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-left text-[16px]">
            <thead className="bg-neutral-900/70 text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Curator</th>
                <th className="px-4 py-3">Why fit</th>
                <th className="px-4 py-3">Risk note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {[
                ['1', 'Re7 Labs', 'Most chain-agnostic curator (14 chains). Most likely first-mover on MegaETH.', '$14.65M Stream / xUSD exposure (Nov 2025).'],
                ['2', 'Gauntlet', '~$2B Morpho TVL. Brings pre-arranged MM liquidator networks — see ACRED precedent.', 'Premium fees. May want a bigger market.'],
                ['3', 'Steakhouse', 'French co-founder, Coinbase brand, conservative. Clean Stream record.', 'Selective on new chains; wants an institutional anchor.'],
                ['4', 'MEV Capital', 'French CEO, SG-FORGE rails. Explicit liquidation mandate (EURCV/USDCV).', '$25.42M Stream exposure — reputational rebuild ongoing.'],
                ['5', 'Wintermute / Armitage', 'Curator + in-house liquidator in one. Built for collateral others can\'t take.', 'Launched May 19, 2026 — track record is days old.'],
              ].map(([n, name, fit, risk]) => (
                <tr key={name as string} className="hover:bg-neutral-900/40">
                  <td className="px-4 py-3 font-mono text-neutral-500">{n}</td>
                  <td className="px-4 py-3 font-medium text-neutral-100">
                    {name}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{fit}</td>
                  <td className="px-4 py-3 text-neutral-400">{risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Footnote>
          <span className="mt-4 inline-block">
            Alphaping declined — they require their exclusive NAV auditor to
            publish on-chain NAV, which doesn&apos;t fit our setup.
          </span>
        </Footnote>
      </div>
    ),
  },

  /* 7. Partner stack --------------------------------------------------- */
  {
    id: 'partners',
    title: 'Partner stack',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>07 · The supporting cast</Kicker>
        <H2>One role, one partner.</H2>
        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-left text-[17px]">
            <thead className="bg-neutral-900/70 text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              <tr>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Choice</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {[
                ['Rewards rail', 'Merkl', 'Confirmed', 'Only first-class rewards rail on Morpho since MIP-111.'],
                ['Merkl program mgmt', 'feather.zone', 'To validate', 'Runs the campaign ops so we don\'t.'],
                ['Oracle', 'RedStone', 'Confirmed', 'Hybrid adaptive feed built for FX-hours / 24-7 mismatch.'],
                ['Risk monitoring', 'Hypernative', 'Recommended', 'Health-factor alerts + threat detection feed.'],
                ['Allocator bot', 'morpho-org/vault-v2-reallocation-bot', 'Self-host', 'Open-source. Run on a small VM with a hardware-backed key.'],
                ['OEV recapture (later)', 'Oval by UMA', 'Phase 2', 'Returns liquidation MEV to lenders. Wire once volume is meaningful.'],
              ].map(([role, choice, status, why]) => (
                <tr key={role as string} className="hover:bg-neutral-900/40">
                  <td className="px-5 py-3 font-medium text-neutral-200">{role}</td>
                  <td className="px-5 py-3 font-mono text-neutral-300">{choice}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={status as string} />
                  </td>
                  <td className="px-5 py-3 text-neutral-400">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },

  /* 8. Liquidations mechanics ----------------------------------------- */
  {
    id: 'liq-mechanics',
    title: 'Liquidations',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>08 · How a liquidation happens</Kicker>
        <H2>Four steps. One transaction. No CEX.</H2>
        <div className="mt-8 grid grid-cols-4 gap-4">
          {[
            { n: '1', t: 'Seize', d: 'Liquidator seizes wiTRY collateral from underwater position.' },
            { n: '2', t: 'Swap', d: 'Atomic swap wiTRY → USDM on Kumbaya (Uniswap v3 fork on MegaETH).' },
            { n: '3', t: 'Repay', d: 'Repay the borrower\'s USDM debt to Morpho.' },
            { n: '4', t: 'Pocket', d: 'Keep the LIF bonus (~5% at 86% LLTV).' },
          ].map(({ n, t, d }) => (
            <Card key={n}>
              <div className="font-mono text-3xl" style={{ color: ACCENT }}>
                {n}
              </div>
              <div className="mt-3 text-[20px] font-medium text-neutral-100">
                {t}
              </div>
              <div className="mt-2 text-[15px] leading-[1.5] text-neutral-400">
                {d}
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-5">
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              Atomic-only
            </div>
            <div className="mt-2 text-[18px] leading-[1.5] text-neutral-300">
              Liquidators can&apos;t hold TRY exposure between blocks. The
              wiTRY/USDM swap and the debt repayment must clear in one
              transaction. No CEX, no redemption rail. Pool depth is the
              binding constraint.
            </div>
          </Card>
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              MegaETH reality
            </div>
            <div className="mt-2 text-[18px] leading-[1.5] text-neutral-300">
              Single sequencer. No public mempool. Proximity-seat auctions.
              Classic Flashbots searcher competition doesn&apos;t exist here yet —
              we sign liquidators bilaterally.
            </div>
          </Card>
        </div>
      </div>
    ),
  },

  /* 9. Pool depth = binding constraint -------------------------------- */
  {
    id: 'pool-rule',
    title: 'The 5× rule',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>09 · The constraint that runs the market</Kicker>
        <H2>
          Max single liquidation <Accent>≤</Accent> pool depth <Accent>÷</Accent>{' '}
          5
        </H2>
        <div className="mt-6 grid grid-cols-[1.1fr_1fr] gap-6">
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              Why this rule exists
            </div>
            <div className="mt-3 space-y-3 text-[17px] leading-[1.55] text-neutral-300">
              <p>
                At 86% LLTV, LIF is only{' '}
                <Accent>~5%</Accent>. That bonus is the entire budget covering
                slippage + gas + the seconds of TRY exposure during the atomic
                tx.
              </p>
              <p>
                On a v3 pool with concentrated liquidity around spot, a swap
                equal to ~20% of one-sided depth produces roughly{' '}
                <Accent>1% slippage in calm markets</Accent> and ~3–4% under
                stress.
              </p>
              <p>
                Cap the largest single liquidation at 1/5 of pool depth:
              </p>
              <ul className="ml-4 list-disc space-y-2 text-neutral-400">
                <li>
                  Calm: 1% slippage → liquidator keeps ~4% → fast execution.
                </li>
                <li>
                  Stress / TRY gap: 3–4% slippage → still positive → liquidator
                  still acts.
                </li>
                <li>
                  Pre-liq chops the actual liquidation into smaller chunks →
                  real slippage usually well under 1%.
                </li>
              </ul>
            </div>
          </Card>
          <div className="flex flex-col gap-4">
            <NumberBlock
              label="LLTV"
              value="86%"
              hint="Set by Morpho governance tier. Costs us pool depth."
            />
            <NumberBlock
              label="LIF (slippage budget)"
              value="~5%"
              hint="The entire liquidator margin. Slippage eats this directly."
            />
            <Card>
              <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
                Mechanism
              </div>
              <div className="mt-2 text-[16px] leading-[1.55] text-neutral-300">
                Supply cap and per-position borrow cap are functions of{' '}
                <Accent>current</Accent> Kumbaya pool depth, reviewed monthly.
                Pool deepens → caps go up. Pool drains → caps go down.
              </div>
            </Card>
          </div>
        </div>
      </div>
    ),
  },

  /* 10. Slippage & pool sizing ---------------------------------------- */
  {
    id: 'pool-sizing',
    title: 'Slippage & pool sizing',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>10 · What to seed in Kumbaya</Kicker>
        <H2>
          Recommended pool: <Accent>$300–500k</Accent> @ $1M ·{' '}
          <Accent>$1.5–2.5M</Accent> @ $5M
        </H2>
        <Body>
          We size the Kumbaya wiTRY/USDM pool so the <em>typical</em>{' '}
          liquidation stays under 1% slippage and a <em>tail</em> liquidation
          stays inside LIF.
        </Body>
        <div className="mt-6 grid grid-cols-2 gap-5">
          <SlippageTable
            market="$1M borrow market"
            typical="$10k (1% of borrow)"
            tail="$100k (10% of borrow)"
            poolReco="$300k → $500k pool"
            rows={[
              ['Typical liq', '<0.3%', '<0.5%', '<1%'],
              ['Tail liq', '~1.5%', '~2.5%', '~4%'],
            ]}
          />
          <SlippageTable
            market="$5M borrow market"
            typical="$50k (1% of borrow)"
            tail="$500k (10% of borrow)"
            poolReco="$1.5M → $2.5M pool"
            rows={[
              ['Typical liq', '<0.3%', '<0.5%', '<1%'],
              ['Tail liq', '~1.5%', '~2.5%', '~4%'],
            ]}
          />
        </div>
        <Footnote>
          Slippage figures assume v3 concentrated liquidity around TRY/USD
          spot. MegaETH chain-LP seed via MegaMafia can subsidize part of this
          pool — see slide 5.
        </Footnote>
      </div>
    ),
  },

  /* 11. Liquidator stack ---------------------------------------------- */
  {
    id: 'liquidators',
    title: 'Liquidator stack',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>11 · Who actually liquidates</Kicker>
        <H2>
          Four tiers.{' '}
          <Accent>Layered, not stacked.</Accent>
        </H2>
        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-left text-[16px]">
            <thead className="bg-neutral-900/70 text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              <tr>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {[
                ['1', 'Wintermute / Armitage', 'Named, accountable, in-house', 'OTC: trade@wintermute.com. They run their own liquidators for every market they support. MegaETH backer.'],
                ['2', 'Brix internal bot', 'Guaranteed coverage, weeks 0–60', 'Fork morpho-org/morpho-blue-liquidation-bot. RedStone + Kumbaya pricer. Funded from treasury.'],
                ['3', 'Curator MM network', '2–4 pre-signed warm liquidators', 'Via Gauntlet (ACRED pattern: prime brokers + MMs). Bilateral coverage agreement.'],
                ['4', 'Permissionless / FastLane Atlas', 'Public bonus catchers', 'Publish bot fork. Atlas auction layer if MegaETH adopts it. Treated as bonus, not primary.'],
              ].map(([tier, op, role, notes]) => (
                <tr key={op as string} className="hover:bg-neutral-900/40">
                  <td className="px-4 py-3 font-mono text-2xl" style={{ color: ACCENT }}>
                    {tier}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-100">{op}</td>
                  <td className="px-4 py-3 text-neutral-300">{role}</td>
                  <td className="px-4 py-3 text-neutral-400">{notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Footnote>
          No CEX path. No redemption rail. Coverage = atomic swap depth ×
          pre-signed coverage.
        </Footnote>
      </div>
    ),
  },

  /* 12. Profitability + parameters ------------------------------------ */
  {
    id: 'params',
    title: 'Profitable liquidations + parameters',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>12 · The parameter sheet</Kicker>
        <H2>
          profit = (LIF − 1) × seized <Accent>−</Accent> slippage{' '}
          <Accent>−</Accent> gas
        </H2>
        <div className="mt-6 grid grid-cols-[1.05fr_1fr] gap-6">
          <div className="overflow-hidden rounded-lg border border-neutral-800">
            <table className="w-full text-left text-[16px]">
              <thead className="bg-neutral-900/70 text-[12px] uppercase tracking-[0.18em] text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Parameter</th>
                  <th className="px-4 py-3">Day 1</th>
                  <th className="px-4 py-3">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {[
                  ['LLTV', '86%', 'Morpho governance tier. Costs us pool depth.'],
                  ['LIF', '~5%', 'Derived from LLTV. The full liquidator budget.'],
                  ['Pre-liquidations', 'On', 'Chops liq into pool-sized chunks. Mandatory at 86% LLTV.'],
                  ['Supply cap', '5× live Kumbaya depth', 'Slide 9. Tracks the pool.'],
                  ['Per-wallet borrow cap', 'pool ÷ 5', 'No single position can blow the pool.'],
                  ['Vault factory', 'V1.1 (no bad-debt realization)', 'wiTRY share price can\'t decrease → ERC-4626 risk neutralized.'],
                ].map(([p, v, w]) => (
                  <tr key={p as string} className="hover:bg-neutral-900/40">
                    <td className="px-4 py-3 font-medium text-neutral-200">{p}</td>
                    <td className="px-4 py-3 font-mono text-neutral-100" style={{ color: ACCENT }}>
                      {v}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">{w}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-4">
            <Card>
              <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
                Three levers
              </div>
              <ol className="mt-3 ml-4 list-decimal space-y-2 text-[17px] leading-[1.55] text-neutral-300">
                <li>Pool depth (slide 9 — biggest lever).</li>
                <li>LIF tier (fixed by LLTV choice).</li>
                <li>Pre-liq cushion (chops the trade).</li>
              </ol>
            </Card>
            <Card>
              <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
                ERC-4626 footnote
              </div>
              <div className="mt-2 text-[16px] leading-[1.55] text-neutral-400">
                Morpho warns against flash-loanable ERC-4626 collateral. The
                V1.1 factory removes bad-debt realization → wiTRY share price
                can only go up. That&apos;s the mitigation.
              </div>
            </Card>
          </div>
        </div>
      </div>
    ),
  },

  /* 13. Pre-liq + risk ------------------------------------------------ */
  {
    id: 'preliq',
    title: 'Pre-liquidations',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>13 · The cliff vs the slope</Kicker>
        <H2>
          Pre-liq cuts bad-debt risk from <Accent>3–6%</Accent> to{' '}
          <Accent>~1%</Accent> per year.
        </H2>
        <Body>
          TRY can gap overnight. Without pre-liq, the position goes from
          healthy to underwater between two oracle updates and the liquidator
          misses the window. Pre-liq auto-deleverages gradually <em>before</em>{' '}
          health hits 1.
        </Body>
        <div className="mt-8 grid grid-cols-3 gap-5">
          <NumberBlock
            label="P(bad-debt) · no pre-liq"
            value="3–6%"
            hint="Per-year probability of a 3-day TRY drawdown big enough to cause bad debt at LLTV 86 / util 85%."
          />
          <NumberBlock
            label="P(bad-debt) · with pre-liq"
            value="~1%"
            hint="Same scenario with pre-liq enabled. Auto-deleverages early."
          />
          <NumberBlock
            label="Recommendation"
            value="On, day 1"
            hint="Not optional at 86% LLTV. This is how atomic-only liquidations survive an FX gap."
          />
        </div>
        <Footnote>
          Numbers from this repo&apos;s FX simulator at baseline — see{' '}
          <a href="/" className="underline" style={{ color: ACCENT }}>
            /
          </a>{' '}
          and{' '}
          <a href="/utilization" className="underline" style={{ color: ACCENT }}>
            /utilization
          </a>
          . Confidence: medium. Model is ours, not market-validated.
        </Footnote>
      </div>
    ),
  },

  /* 14. Recap + next steps -------------------------------------------- */
  {
    id: 'next-steps',
    title: 'Recap + next steps',
    render: () => (
      <div className="flex h-full flex-col">
        <Kicker>14 · What we recommended → what we do next</Kicker>
        <H2>
          Six bullets. <Accent>Six actions.</Accent>
        </H2>
        <div className="mt-6 grid grid-cols-2 gap-6">
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              Recap
            </div>
            <ol className="mt-3 ml-4 list-decimal space-y-2 text-[17px] leading-[1.5] text-neutral-300">
              <li>USDM supply ≈ borrow / utilization · buffer 10–20%.</li>
              <li>Curators are distribution. Sign one from the shortlist.</li>
              <li>3-layer incentives: Merkl + MegaETH + Brix kicker.</li>
              <li>Pool depth is the binding constraint. 5× rule.</li>
              <li>Liquidator stack: Wintermute → internal → MM net → public.</li>
              <li>Pre-liq on, day 1. LLTV 86%, LIF ~5%, V1.1 factory.</li>
            </ol>
          </Card>
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              Next steps
            </div>
            <ol className="mt-3 ml-4 list-decimal space-y-2 text-[17px] leading-[1.5] text-neutral-300">
              <li>Open curator outreach: Re7 first, Gauntlet second.</li>
              <li>Scope the Merkl campaign · validate feather.zone.</li>
              <li>Email Wintermute OTC (<span className="font-mono text-[15px]">trade@wintermute.com</span>).</li>
              <li>Open MegaMafia conversation for chain LP + MEGA rewards.</li>
              <li>Pool seed conversation with Kumbaya team (target slide 10).</li>
              <li>Deploy <span className="font-mono text-[15px]">morpho-org/pre-liquidation</span> contract.</li>
            </ol>
          </Card>
        </div>
        <div className="mt-8 flex items-end justify-between text-[14px] text-neutral-500">
          <div>Questions live in the appendix at /utilization and /</div>
          <div>End · 14 / 14</div>
        </div>
      </div>
    ),
  },
];

/* ---------- supporting components ---------- */

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    Confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    Recommended: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    'To validate': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    'Self-host': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    'Phase 2': 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
  };
  const cls = palette[status] ?? 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30';
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-[12px] uppercase tracking-[0.16em] ${cls}`}
    >
      {status}
    </span>
  );
}

function IncentiveLayer({
  n,
  name,
  who,
  paidBy,
  detail,
  highlight,
}: {
  n: string;
  name: string;
  who: string;
  paidBy: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={
        highlight ? 'border-[--accent-border] ring-1 ring-[--accent-ring]' : ''
      }
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-3xl" style={{ color: ACCENT }}>
          {n}
        </span>
        <span className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">
          Paid by · {paidBy}
        </span>
      </div>
      <div className="mt-4 text-[20px] font-medium text-neutral-100">
        {name}
      </div>
      <div className="text-[13px] uppercase tracking-[0.16em] text-neutral-500">
        {who}
      </div>
      <div className="mt-3 text-[15px] leading-[1.55] text-neutral-400">
        {detail}
      </div>
    </Card>
  );
}

function SlippageTable({
  market,
  typical,
  tail,
  poolReco,
  rows,
}: {
  market: string;
  typical: string;
  tail: string;
  poolReco: string;
  rows: string[][];
}) {
  return (
    <Card>
      <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
        {market}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[14px] text-neutral-400">
        <div>Typical: <span className="text-neutral-200">{typical}</span></div>
        <div>Tail: <span className="text-neutral-200">{tail}</span></div>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-neutral-800">
        <table className="w-full text-left text-[15px]">
          <thead className="bg-neutral-900/60 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            <tr>
              <th className="px-3 py-2">Trade</th>
              <th className="px-3 py-2">Pool $300k / 1.5M</th>
              <th className="px-3 py-2">Pool $400k / 2M</th>
              <th className="px-3 py-2">Pool $500k / 2.5M</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 font-mono text-neutral-200">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} className={`px-3 py-2 ${j === 0 ? 'font-sans text-neutral-400' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[15px]" style={{ color: ACCENT }}>
        Recommended seed: {poolReco}
      </div>
    </Card>
  );
}

function EconomySvg() {
  // Hand-drawn flow. 1200x520 viewBox.
  const nodes = {
    witryLP:   { x: 110, y: 100, label: 'wiTRY LPs',        sub: 'yield source' },
    borrower:  { x: 110, y: 280, label: 'Borrowers',        sub: 'post wiTRY' },
    lender:    { x: 110, y: 460, label: 'USDM lenders',     sub: 'supply USDM' },
    morpho:    { x: 540, y: 280, label: 'Morpho market',    sub: 'wiTRY ↔ USDM' },
    curator:   { x: 540, y: 80,  label: 'Curator',          sub: 'TBD — slide 6', dashed: true },
    megaeth:   { x: 540, y: 480, label: 'MegaETH / MegaMafia', sub: 'chain LP + MEGA' },
    kumbaya:   { x: 940, y: 200, label: 'Kumbaya AMM',      sub: 'wiTRY/USDM v3' },
    liq:       { x: 940, y: 380, label: 'Liquidators',      sub: 'Wintermute · internal · MMs' },
    merkl:     { x: 1080, y: 60, label: 'Merkl',            sub: 'rewards rail' },
  };
  function Node({
    cx, cy, label, sub, dashed = false,
  }: { cx: number; cy: number; label: string; sub: string; dashed?: boolean }) {
    return (
      <g>
        <rect
          x={cx - 100}
          y={cy - 32}
          width={200}
          height={64}
          rx={10}
          fill="#0e0e10"
          stroke={dashed ? '#52525b' : '#2a2a30'}
          strokeWidth={1.5}
          strokeDasharray={dashed ? '4 4' : undefined}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#e5e5e7" fontSize="15" fontWeight="600">
          {label}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#71717a" fontSize="12">
          {sub}
        </text>
      </g>
    );
  }
  function Arrow({
    from, to, dashed = false, color = '#3f3f46', label,
  }: { from: keyof typeof nodes; to: keyof typeof nodes; dashed?: boolean; color?: string; label?: string }) {
    const a = nodes[from];
    const b = nodes[to];
    // shrink endpoints toward node edges
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const start = { x: a.x + ux * 100, y: a.y + uy * 32 };
    const end = { x: b.x - ux * 100, y: b.y - uy * 32 };
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return (
      <g>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={color}
          strokeWidth={1.6}
          strokeDasharray={dashed ? '5 5' : undefined}
          markerEnd="url(#arrowhead)"
        />
        {label && (
          <text
            x={mid.x}
            y={mid.y - 6}
            textAnchor="middle"
            fill="#71717a"
            fontSize="11"
          >
            {label}
          </text>
        )}
      </g>
    );
  }
  return (
    <svg
      viewBox="0 0 1200 540"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="strokeWidth"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#52525b" />
        </marker>
      </defs>

      {/* asset arrows (solid) */}
      <Arrow from="witryLP" to="borrower" label="wiTRY yield" />
      <Arrow from="borrower" to="morpho" label="post wiTRY" />
      <Arrow from="lender" to="morpho" label="supply USDM" />
      <Arrow from="morpho" to="kumbaya" label="liq swap" />
      <Arrow from="kumbaya" to="liq" />
      <Arrow from="liq" to="morpho" label="repay USDM" />

      {/* MegaETH dual role */}
      <Arrow from="megaeth" to="morpho" label="seed USDM" />
      <Arrow from="megaeth" to="kumbaya" label="seed pool" />

      {/* incentive flows (dashed, accent) */}
      <Arrow from="merkl" to="borrower" dashed color={ACCENT} label="rewards" />
      <Arrow from="megaeth" to="lender" dashed color={ACCENT} label="MEGA + points" />
      <Arrow from="megaeth" to="borrower" dashed color={ACCENT} />

      {/* curator overseeing morpho */}
      <Arrow from="curator" to="morpho" dashed color="#71717a" label="curates" />

      {/* nodes */}
      <Node cx={nodes.witryLP.x} cy={nodes.witryLP.y} label={nodes.witryLP.label} sub={nodes.witryLP.sub} />
      <Node cx={nodes.borrower.x} cy={nodes.borrower.y} label={nodes.borrower.label} sub={nodes.borrower.sub} />
      <Node cx={nodes.lender.x} cy={nodes.lender.y} label={nodes.lender.label} sub={nodes.lender.sub} />
      <Node cx={nodes.morpho.x} cy={nodes.morpho.y} label={nodes.morpho.label} sub={nodes.morpho.sub} />
      <Node cx={nodes.curator.x} cy={nodes.curator.y} label={nodes.curator.label} sub={nodes.curator.sub} dashed />
      <Node cx={nodes.megaeth.x} cy={nodes.megaeth.y} label={nodes.megaeth.label} sub={nodes.megaeth.sub} />
      <Node cx={nodes.kumbaya.x} cy={nodes.kumbaya.y} label={nodes.kumbaya.label} sub={nodes.kumbaya.sub} />
      <Node cx={nodes.liq.x} cy={nodes.liq.y} label={nodes.liq.label} sub={nodes.liq.sub} />
      <Node cx={nodes.merkl.x} cy={nodes.merkl.y} label={nodes.merkl.label} sub={nodes.merkl.sub} />
    </svg>
  );
}

/* ---------- deck shell ---------- */

export default function AssignmentDeck() {
  const [index, setIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const total = slides.length;

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      setIndex(clamped);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${clamped + 1}`);
      }
    },
    [total],
  );

  // initial hash sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = parseInt(window.location.hash.replace('#', ''), 10);
    if (!Number.isNaN(h) && h >= 1 && h <= total) {
      setIndex(h - 1);
    }
  }, [total]);

  // keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        go(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        go(total - 1);
      } else if (e.key === '?') {
        setShowHelp((v) => !v);
      } else if (e.key === 'Escape') {
        setShowHelp(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, total]);

  const current = useMemo(() => slides[index]!, [index]);

  return (
    <div className="font-sans" style={{ background: '#0a0a0a' }}>
      <style>{`
        :root { --accent: ${ACCENT}; }
        html, body { background: #0a0a0a; }
        .slide { display: none; }
        .slide.is-active { display: flex; }
        @media print {
          .deck-chrome { display: none !important; }
          .slide { display: flex !important; page-break-after: always; height: 100vh; }
          .slide:last-child { page-break-after: auto; }
        }
        @media (max-width: 900px) {
          .slide-inner { transform: scale(0.85); transform-origin: top left; }
        }
      `}</style>

      {slides.map((s, i) => (
        <section
          key={s.id}
          role="region"
          aria-label={`Slide ${i + 1} of ${total}: ${s.title}`}
          className={`slide ${i === index ? 'is-active' : ''} h-screen w-screen items-stretch overflow-hidden`}
        >
          <div className="slide-inner mx-auto flex aspect-[16/9] h-full max-h-screen w-full max-w-[1600px] flex-col p-12 text-neutral-200">
            {s.render()}
          </div>
        </section>
      ))}

      {/* bottom chrome */}
      <div className="deck-chrome pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-center justify-between px-6 pb-5">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-neutral-800 bg-neutral-950/80 px-4 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="rounded-full px-3 py-1 text-[13px] uppercase tracking-[0.18em] text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="font-mono text-[13px] text-neutral-500">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === total - 1}
            className="rounded-full px-3 py-1 text-[13px] uppercase tracking-[0.18em] text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-40"
          >
            Next →
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Jump to slide ${i + 1}`}
              onClick={() => go(i)}
              className="h-2 w-2 rounded-full transition"
              style={{
                background: i === index ? ACCENT : '#3f3f46',
                transform: i === index ? 'scale(1.4)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        <div className="pointer-events-auto rounded-full border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-[12px] text-neutral-500 backdrop-blur">
          <span className="text-neutral-300">{current.title}</span>
        </div>
      </div>

      {showHelp && (
        <div
          className="deck-chrome fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur"
          onClick={() => setShowHelp(false)}
        >
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-neutral-200">
            <h3 className="text-2xl font-semibold">Keyboard shortcuts</h3>
            <ul className="mt-4 space-y-2 font-mono text-[15px]">
              <li><span className="text-neutral-500 mr-3">→ / Space</span> Next slide</li>
              <li><span className="text-neutral-500 mr-3">←</span> Previous slide</li>
              <li><span className="text-neutral-500 mr-3">Home / End</span> First / last</li>
              <li><span className="text-neutral-500 mr-3">?</span> Toggle this help</li>
              <li><span className="text-neutral-500 mr-3">Esc</span> Close help</li>
            </ul>
            <div className="mt-4 text-[13px] text-neutral-500">Click anywhere to dismiss.</div>
          </div>
        </div>
      )}
    </div>
  );
}
