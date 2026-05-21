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
  label: React.ReactNode;
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
        <Kicker>03 · USDM liquidity requirement</Kicker>
        <H2>
          required supply <Accent>≈</Accent> borrow <Accent>÷</Accent>{' '}
          utilization
        </H2>
        <div className="mt-6">
          <Body>
            Lenders supply USDM. Borrowers take USDM against wiTRY collateral.
            We size the supply to the borrow demand, with a buffer so we never
            sit at 100% utilization.
          </Body>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <NumberBlock
            label={
              <>
                Baseline A · <Accent>$1M borrow</Accent>
              </>
            }
            value="$1.11–1.25M"
            hint={
              <>
                USDM supply at 80–90% utilization. Add 10–20% buffer →{' '}
                <Accent>~$1.4M</Accent> healthy floor.
              </>
            }
          />
          <NumberBlock
            label={
              <>
                Baseline B · <Accent>$5M borrow</Accent>
              </>
            }
            value="$5.56–6.25M"
            hint={
              <>
                USDM supply at 80–90% utilization. Add 10–20% buffer →{' '}
                <Accent>~$7M</Accent> healthy floor.
              </>
            }
          />
        </div>
        <div className="mt-8 text-center">
          <Footnote>
            Buffer rule: curators want headroom. A market pinned at 100%
            utilization can&apos;t service withdrawals and looks dead.
          </Footnote>
        </div>
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
            { k: 'Utilization', v: 'Borrowed ÷ supplied. Stay 70–90%. Above 95% = trouble.' },
            { k: 'Idle USDM', v: 'Unborrowed supply. Lenders’ cushion for withdrawals.' },
            { k: 'Time stuck at 100% util', v: 'No new borrows, no withdrawals. If > 1h: lift supply cap, or push target util down so the rate curve bites sooner.' },
            { k: 'Supply / borrow caps', v: 'Hard ceilings. Sized to live Kumbaya depth — slide 9.' },
            { k: 'Curator allocation share', v: 'How much of the vault’s TVL is allocated to our market.' },
            { k: 'Bad-debt P95', v: '95th-percentile loss from the FX simulator. Slide 13.' },
          ].map(({ k, v }) => (
            <Card key={k}>
              <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
                {k}
              </div>
              <div className="mt-2 text-neutral-300">{v}</div>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Footnote>
            Tools: the Morpho frontend for the live numbers, plus an internal
            dashboard powered by{' '}
            <a href="/" className="underline" style={{ color: ACCENT }}>
              this simulator
            </a>{' '}
            for forward-looking risk.
          </Footnote>
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
            paidBy="Brix · rewards + 3% Merkl fee"
            detail="Merkl is the only first-class rewards rail on Morpho since MIP-111 (Jul 2025). 8-hour distribution cadence. Rewards can be iTRY, Brix points, or MegaETH Terminal points. Merkl takes a 3% maintenance fee on top of distributed rewards — cheap when rewards are Brix points (free to mint), real cost when they're iTRY."
          />
          <IncentiveLayer
            n="2"
            name="MegaETH rewards"
            who="Supply + borrow side"
            paidBy="MegaETH ecosystem"
            detail="MEGA token, MegaETH Terminal points, KPI-tranche eligibility. Expected supply-side bootstrap, pending allocation — not guaranteed."
            highlight
          />
          <IncentiveLayer
            n="3"
            name="Brix points"
            who="Borrowers (and lenders only if needed)"
            paidBy="Brix"
            detail="Deploy on-chain Brix points on MegaETH to reward borrowers. Extend to USDM lenders only if layers 1+2 don't pull enough supply."
          />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5">
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              Punchline
            </div>
            <div className="mt-2 text-[20px] leading-[1.5] text-neutral-200">
              We don&apos;t pay to subsidize lenders —{' '}
              <Accent>MegaETH Terminal points</Accent> can cover that side.
              Brix capital goes to <Accent>borrowers</Accent>, where it
              unlocks the flywheel.
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
        <H2>Five candidates.</H2>
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
        <H2>Four steps. One transaction.</H2>
        <div className="mt-8 grid grid-cols-4 gap-4">
          {[
            { n: '1', t: 'Call', d: 'Liquidator calls liquidate() on the underwater position. Morpho opens an onMorphoLiquidate callback.' },
            { n: '2', t: 'Swap', d: 'Inside the callback, Morpho releases wiTRY to the liquidator, who swaps it to USDM on Kumbaya.' },
            { n: '3', t: 'Settle', d: 'Callback closes. Morpho pulls the USDM debt from the liquidator. Atomic, zero working capital.' },
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
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              Atomic-only
            </div>
            <div className="mt-2 text-[16px] leading-[1.5] text-neutral-300">
              Liquidators can&apos;t hold TRY exposure between blocks. The
              wiTRY/USDM swap and the debt repayment must clear in one
              transaction. If Kumbaya is too thin, the liquidator repays a
              smaller chunk.
            </div>
          </Card>
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              MegaETH reality
            </div>
            <div className="mt-2 text-[16px] leading-[1.5] text-neutral-300">
              Single sequencer. No public mempool. Proximity-seat auctions.
              Classic Flashbots searcher competition doesn&apos;t exist here
              yet — we keep one liquidator on retainer; anyone else can also
              liquidate.
            </div>
          </Card>
          <Card>
            <div className="text-[13px] uppercase tracking-[0.18em] text-neutral-500">
              Opt-in early exit
            </div>
            <div className="mt-2 text-[16px] leading-[1.5] text-neutral-300">
              Borrowers can opt in to a softer rule: at a lower LTV set by
              Brix, a small slice of their position is sold off at a smaller
              penalty. Stops the 86% blowup before it happens.
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
          Borrow cap <Accent>≤</Accent> pool depth <Accent>÷</Accent> 5
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
                We can&apos;t cap a swap on Kumbaya — the AMM accepts any
                size. The control we <em>do</em> have is on the Morpho side:
                size the borrow cap so a worst-case 100% liquidation lands
                near 20% of pool depth. Beyond that, the liquidator simply
                doesn&apos;t sign the tx.
              </p>
              <ul className="ml-4 list-disc space-y-2 text-neutral-400">
                <li>
                  Calm: ~1% slippage → liquidator keeps ~4% → fast execution.
                </li>
                <li>
                  Stress / TRY gap: 3–4% slippage → still positive → liquidator
                  still acts.
                </li>
                <li>
                  Pre-liq fires earlier and in smaller chunks → typical
                  slippage well under 1%.
                </li>
                <li>
                  Pool drains faster than caps adjust → liquidator walks →
                  bad debt unless pre-liq already cleared the position.
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
                How we enforce it
              </div>
              <ol className="mt-2 space-y-1.5 text-[14px] leading-[1.5] text-neutral-300">
                <li>
                  <span className="font-mono text-neutral-500">1.</span>{' '}
                  Market borrow cap ={' '}
                  <Accent>1× live Kumbaya depth</Accent>. Morpho-native hard
                  ceiling on total debt.
                </li>
                <li>
                  <span className="font-mono text-neutral-500">2.</span>{' '}
                  Hypernative alert when any wallet&apos;s debt &gt; pool ÷ 5.
                  Operational alarm, not prevention.
                </li>
                <li>
                  <span className="font-mono text-neutral-500">3.</span>{' '}
                  Pre-liq opt-in gated by Brix points. Soft,
                  incentive-aligned.
                </li>
                <li>
                  <span className="font-mono text-neutral-500">4.</span>{' '}
                  Dutch-auction LIF inside pre-liq. Any size eventually
                  becomes profitable to liquidate.
                </li>
              </ol>
              <div className="mt-3 text-[12px] leading-[1.4] text-neutral-500">
                Morpho Blue has no native per-wallet cap. Sybil concentration
                is bounded, not solved.
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
        <H2>Recommended AMM liquidity</H2>
        <div className="mt-6">
          <Body>
            Seed the Kumbaya wiTRY/USDM pool to{' '}
            <Accent>$300–500k</Accent> if we launch the{' '}
            <Accent>$1M</Accent> borrow market, or to{' '}
            <Accent>$1.5–2.5M</Accent> for the <Accent>$5M</Accent> market.
            Sized so the typical liquidation clears under 1% slippage and a
            tail liquidation still fits inside the ~5% LIF budget.
          </Body>
        </div>
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
          Coverage = atomic swap depth × pre-signed coverage.
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
                  ['Pre-liquidations', 'On · opt-in', 'Gated by Brix points. Dutch-auction LIF chops large positions.'],
                  ['Market borrow cap', '1× live Kumbaya depth', 'Morpho-native hard ceiling on total debt. Slide 9.'],
                  ['Per-wallet target', '≤ pool ÷ 5', 'Not enforceable on Morpho Blue. Hypernative alert; respond by lowering market cap.'],
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
  // Cleaner grid. 1400×640 viewBox. No diagonal crossings between
  // unrelated flows. Liquidator cycle expressed as bidirectional arrows.
  const NODE_W = 200;
  const NODE_H = 64;
  const nodes = {
    // left column: actor side
    witryLP:  { x: 140,  y: 100, label: 'wiTRY LPs',         sub: 'yield source' },
    borrower: { x: 140,  y: 310, label: 'Borrowers',         sub: 'post wiTRY' },
    lender:   { x: 140,  y: 540, label: 'USDM lenders',      sub: 'supply USDM' },
    // center column: protocol + bootstrap
    merkl:    { x: 700,  y: 100, label: 'Merkl',             sub: 'rewards rail' },
    morpho:   { x: 700,  y: 310, label: 'Morpho market',     sub: 'wiTRY ↔ USDM' },
    megaeth:  { x: 700,  y: 540, label: 'MegaETH / MegaMafia', sub: 'chain LP + MEGA' },
    // right column: liquidation + curation
    curator:  { x: 1240, y: 100, label: 'Curator',           sub: 'TBD — slide 6', dashed: true },
    kumbaya:  { x: 1240, y: 220, label: 'Kumbaya AMM',       sub: 'wiTRY/USDM v3' },
    liq:      { x: 1240, y: 400, label: 'Liquidators',       sub: 'Wintermute · internal · MMs' },
  } as const;

  function Node({
    cx, cy, label, sub, dashed = false,
  }: { cx: number; cy: number; label: string; sub: string; dashed?: boolean }) {
    return (
      <g>
        <rect
          x={cx - NODE_W / 2}
          y={cy - NODE_H / 2}
          width={NODE_W}
          height={NODE_H}
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

  // Compute the point on a node's bounding-box border closest to the
  // direction of `target`. Prevents the line from cutting into the box.
  function anchor(n: { x: number; y: number }, target: { x: number; y: number }) {
    const dx = target.x - n.x;
    const dy = target.y - n.y;
    const halfW = NODE_W / 2;
    const halfH = NODE_H / 2;
    if (dx === 0 && dy === 0) return { x: n.x, y: n.y };
    const tx = dx === 0 ? Infinity : halfW / Math.abs(dx);
    const ty = dy === 0 ? Infinity : halfH / Math.abs(dy);
    const t = Math.min(tx, ty);
    return { x: n.x + dx * t, y: n.y + dy * t };
  }

  function Arrow({
    from, to, dashed = false, color = '#3f3f46', label, labelOffset = -8, bidir = false, perp = 0, labelT = 0.5,
  }: {
    from: keyof typeof nodes;
    to: keyof typeof nodes;
    dashed?: boolean;
    color?: string;
    label?: string | string[];
    labelOffset?: number;
    bidir?: boolean;
    perp?: number; // perpendicular shift to avoid overlap with reverse arrow
    labelT?: number; // 0 = at start node, 1 = at end node, 0.5 = midpoint
  }) {
    const a = nodes[from];
    const b = nodes[to];
    let start = anchor(a, b);
    let end = anchor(b, a);
    if (perp) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      start = { x: start.x + nx * perp, y: start.y + ny * perp };
      end = { x: end.x + nx * perp, y: end.y + ny * perp };
    }
    const mid = {
      x: start.x + (end.x - start.x) * labelT,
      y: start.y + (end.y - start.y) * labelT,
    };
    const markerStart = bidir ? `url(#arrowhead-${dashed ? 'd' : 's'})` : undefined;
    const markerEnd = `url(#arrowhead-${dashed ? 'd' : 's'})`;
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
          markerEnd={markerEnd}
          markerStart={markerStart}
        />
        {label && (() => {
          const lines = Array.isArray(label) ? label : [label];
          const lineH = 14;
          // center the block vertically around mid.y + labelOffset
          const blockH = (lines.length - 1) * lineH;
          const y0 = mid.y + labelOffset - blockH / 2;
          return (
            <text
              x={mid.x}
              y={y0}
              textAnchor="middle"
              fill={dashed ? color : '#a1a1aa'}
              fontSize="12"
              style={{ paintOrder: 'stroke', stroke: '#0a0a0a', strokeWidth: 4 }}
            >
              {lines.map((ln, i) => (
                <tspan key={i} x={mid.x} dy={i === 0 ? 0 : lineH} fill={i === 0 ? undefined : '#71717a'} fontSize={i === 0 ? 12 : 11}>
                  {ln}
                </tspan>
              ))}
            </text>
          );
        })()}
      </g>
    );
  }

  return (
    <svg
      viewBox="0 0 1400 640"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker id="arrowhead-s" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="strokeWidth" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#52525b" />
        </marker>
        <marker id="arrowhead-d" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="strokeWidth" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={ACCENT} />
        </marker>
      </defs>

      {/* ---- asset flows (solid) ---- */}
      {/* left column verticals */}
      <Arrow from="witryLP" to="borrower" label="wiTRY yield" />
      <Arrow from="borrower" to="morpho" label="post wiTRY" />
      <Arrow from="lender" to="morpho" label="supply USDM" />

      {/* MegaETH bootstrap (center vertical + diagonal to kumbaya) */}
      <Arrow from="megaeth" to="morpho" label="seed USDM" />
      {/* "seed pool" crosses the morpho→liq line — bias label toward megaeth */}
      <Arrow from="megaeth" to="kumbaya" label="seed pool" labelT={0.18} labelOffset={-10} />

      {/* liquidation cycle: bidirectional pairs, no crossings */}
      {/* bias label toward morpho so it doesn't sit on the crossing point */}
      <Arrow from="morpho" to="liq" label={['seize wiTRY ⇄ repay USDM', '(atomic liquidation)']} bidir labelT={0.32} />
      <Arrow from="liq" to="kumbaya" label="wiTRY ⇄ USDM swap" bidir />

      {/* ---- incentive + curation (dashed) ---- */}
      <Arrow from="merkl" to="borrower" dashed color={ACCENT} label="rewards" />
      <Arrow from="megaeth" to="lender" dashed color={ACCENT} label="MEGA + points" />
      <Arrow from="curator" to="morpho" dashed color="#71717a" label="curates" />

      {/* ---- nodes (drawn last so they sit above lines) ---- */}
      {(Object.keys(nodes) as Array<keyof typeof nodes>).map((k) => {
        const n = nodes[k];
        const dashed = ('dashed' in n ? (n as { dashed?: boolean }).dashed : false) ?? false;
        return (
          <Node
            key={k}
            cx={n.x}
            cy={n.y}
            label={n.label}
            sub={n.sub}
            dashed={dashed}
          />
        );
      })}
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
