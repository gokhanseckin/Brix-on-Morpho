# Morpho Protocol Partner & Tooling Stack for a New Asset Issuer

## TL;DR
- **Rewards**: Merkl (built by Angle Labs, a16z-backed) is the de-facto and only first-class reward distribution rail for Morpho since MIP-111 (July 2025); set up vault/market campaigns via Merkl Studio in minutes at a 3% maintenance fee (0.5% for airdrops). The Universal Rewards Distributor (URD) remains usable as a self-hosted alternative, and Royco is the only meaningfully comparable third-party alternative (but is not natively integrated into the Morpho UI).
- **Liquidators**: For Morpho Blue, the canonical solution is to self-deploy the official `morpho-org/morpho-blue-liquidation-bot` (TypeScript, configurable pricers, Flashbots support, pre-liquidation aware) or community variants. There is essentially no commercial "liquidation-bot-as-a-service" product — instead, professional liquidators are independent MEV searchers, while curators (MEV Capital, Wintermute/Armitage, kpk) handle liquidation flow inside their vault offerings, and Oval by UMA recaptures oracle-extractable value back to lenders.
- **Allocators**: Use the official `morpho-org/vault-v2-reallocation-bot` (open-source, V2-native, with `equilizeUtilizations` and `apyRange` strategies) for self-operation, designate the PublicAllocator contract for permissionless just-in-time reallocation for borrowers, or hire a professional curator (Gauntlet, Steakhouse, MEV Capital, Re7, Block Analitica, kpk, Yearn, Hyperithm, Keyrock, Wintermute/Armitage, Anthias Labs, K3 Capital, Bitwise, RockawayX, Apostro, B.Protocol) who provides the Allocator role as part of their curation service.

---

## Key Findings

The Morpho stack is unbundled by design. Asset issuers do not need to negotiate a single "integration partner" — they need three role-specific contracts/services: a **reward distributor** (almost always Merkl), a **liquidator network** (almost always self-deployed or community-run, since the protocol's Liquidation Incentive Factor compensates open-market MEV searchers), and an **Allocator/rebalancer** (either an in-house bot using the open-source reallocation bot, or a professional curator who takes the Allocator role on the vault).

For an issuer launching with an ERC-20 vault asset and an ERC-4626 token as collateral, the practical sequence is: (1) deploy a Morpho Blue market with the RedStone oracle; (2) deploy a Morpho Vault V2 (or hire a curator to do so); (3) wire the Allocator role to a bot or curator multisig; (4) launch a Merkl campaign to bootstrap supply/borrow; (5) ensure at least one liquidator is monitoring the market — either by self-running a bot or by partnering with a curator whose mandate covers liquidation handling. Morpho's own docs warn that ERC-4626 vault tokens used as collateral carry specific share-price-decrease risk; the issuer should design the market with this in mind (cap usage, prefer the V1.1 factory which has no bad-debt realization, and avoid scenarios where most of the share supply is flash-loanable).

---

## Details

### 1. Merkl & Reward Distribution

**What it is.** Merkl is an off-chain reward computation + on-chain Merkle-root distribution system built by Angle Labs (the team behind the EURA stablecoin) and backed by a16z. Since Morpho governance proposal MIP-111 in July 2025, **all** Morpho rewards (MORPHO incentives and third-party token incentives alike) are distributed exclusively through Merkl; the legacy Universal Rewards Distributor (URD) only handles unclaimed historical balances at `rewards-legacy.morpho.org`. Merkl recomputes the reward Merkle tree on an 8-hour cadence (versus URD's weekly cycle) and surfaces APRs through the Morpho API and a white-labeled "Merkl on Morpho" frontend.

**How it works for an issuer.**
1. Go to `studio.merkl.xyz/create-campaign`, connect the wallet holding the reward token, and select **Lending & Borrowing → Morpho**.
2. Choose the campaign target:
   - **Vault-level** (incentivize depositors into one specific Morpho Vault V1 or V2 — simplest, rewards distributed linearly pro-rata to shares),
   - **Market-level supply / borrow / collateral** (target a single Morpho Blue market with separate APRs for supply and borrow), or
   - **Multi-market / token-wide** (incentivize a token across *every* Morpho market where it appears — designed for stablecoin issuers).
3. Set total rewards, dates, start/end (campaigns can run from 1 hour to 6 months+; minimum ≈ $1/hour of incentives).
4. (Optional) Configure blacklists (e.g., your own treasury), whitelists, boosts, and forwarder logic (Merkl auto-detects MetaMorpho/Vault V2 contracts as forwarders so rewards flow to end-depositors, not the vault contract itself).
5. Confirm + sign. The campaign appears in the Merkl app within ~1 hour. Users claim at `app.merkl.xyz` (or via the Morpho UI's "Claim on Merkl" button).

**Pricing.** Standard incentive campaigns carry a **3% maintenance fee** taken from the reward budget; airdrop-type campaigns are **0.5%**. Custom/large programs can be negotiated bilaterally.

**Key Merkl features relevant to a new asset issuer:**
- **Forwarded market campaigns to vault depositors.** If you incentivize a Morpho Blue market that a vault allocates into, Merkl automatically cascades those rewards to the vault's end-depositors — works for both V1 and V2.
- **Token-wide cascade campaigns.** A single campaign can incentivize "anyone holding/lending/borrowing TOKEN across every Morpho market" — ideal if your token will be listed in many markets.
- **Token wrappers / auto-vault deposit on claim.** Rewards can be auto-deposited into an ERC-4626 vault (e.g., your Morpho vault) at claim time, allowing autocompounding.
- **Cross-chain.** Incentivize activity on one chain, distribute the reward token on another.
- **Smart-contract recipient handling.** If your vault asset is held by smart contracts that cannot claim (e.g., a bundler), contact Merkl *before* the campaign to redirect — unclaimable rewards are not recoverable post-hoc.

**Repos / links:**
- Studio: `studio.merkl.xyz/create-campaign`
- Docs: `docs.merkl.xyz`, plus `docs.morpho.org/build/rewards/concepts/reward-campaigns`
- Contracts: `github.com/AngleProtocol/merkl-contracts` (DistributionCreator + Distributor; audited twice by Code4rena)
- API: `api.merkl.xyz/v4/...` (the Morpho GraphQL API also pre-aggregates Merkl rewards in `vaultV2ByAddress.rewards`).
- Morpho's Merkl distributor on Ethereum mainnet: `0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae`.

**Alternatives.**
- **Universal Rewards Distributor (URD)** — `github.com/morpho-org/universal-rewards-distributor`. Still operational; you can self-deploy a URD with your own Merkle-tree computation (manual or via Gelato), set timelock/updaters, and run a fully sovereign distribution. Used pre-MIP-111. Best if you want full control, don't want to pay Merkl's 3%, or have a custom eligibility logic Merkl cannot express. Caveat: Morpho's frontend will *not* surface URD-distributed rewards automatically anymore — only Merkl is in the canonical flow.
- **Royco.** The closest functional competitor, but charges higher fees than Merkl, lacks Merkl's automatic "forwarder" mechanism for vault-deposited liquidity, and is not integrated into the Morpho app. Workable for niche launches, not recommended as a primary rail for Morpho.
- **Gelato / Zodiac Delay Modifier on top of URD.** A pattern (referenced in the URD docs) for protocols wanting a queued, automated, on-chain-only distribution without paying any third-party fee.

For a first-time Morpho issuer, the recommendation is unambiguous: use Merkl. You get the Morpho-native UI surface, API integration, the 8-hour distribution cadence, and forwarder logic for free.

---

### 2. Liquidator Bot Operators & Services

**The structural fact:** Morpho's protocol design does not require — and does not have — a single "appointed liquidator." Liquidation is permissionless. The market's Liquidation Incentive Factor (LIF, typically ~1.05 for 86% LLTV markets, up to a max of 1.15) is the bonus a liquidator collects, and the entire LIF goes to the liquidator (Morpho takes zero). The job of an asset issuer is therefore to **ensure at least one well-funded liquidator is monitoring the market** — not to procure liquidation as a managed service. Below are the practical options.

#### A) Official / open-source bots you can self-deploy

| Repo | Stack | Notes |
|---|---|---|
| `morpho-org/morpho-blue-liquidation-bot` ★ | TypeScript + Solidity, Ponder indexer | The canonical bot. Multi-chain, configurable pricers (DefiLlama, MorphoApi, Chainlink registry, Uniswap V3), Flashbots integration via `FLASHBOTS_PRIVATE_KEY`, supports pre-liquidations, configurable cooldowns + "always realize bad debt" mode. Requires deploying your own gated executor contract. Last released v2.0.0 (Jun 2025); v3 in active development. |
| `morpho-org/morpho-liquidation-bot-educational` | TS + Solidity | Naive educational implementation; useful as a reference. |
| `morpho-org/morpho-liquidation-flash` | TS + Solidity | Older flash-loan-based liquidator; built for Morpho-Compound/Aave Optimizer rather than Blue, but contains useful Maker-DAI-flashloan + Uniswap-V3 swap patterns. |
| `crisog/morpho-liquidator` | TS + Solidity | Independent third-party reference; uses ParaSwap for swaps, supports flash-loan-funded liquidation, no upfront capital needed. |
| `etherhood/Liquidator-Morpho` | Rust + Solidity | Community Rust bot. Lists Flashbots, 1inch, batching, gas/profitability as TODOs — useful as a high-performance starting point but flagged as "not production ready". |
| `zach030/morpho-liquidator-bot` | Go + Solidity | Community Go implementation. |
| `morpho-org/pre-liquidation` | Solidity factory | Lets a borrower opt into custom pre-liquidation parameters (preLLTV, preLCF, preLIF) before the LLTV is crossed — enables auto-deleverage and auto-close patterns and can be paired with OEV-aware oracles. |

Practical deployment notes: budget at least one Postgres-backed Ponder indexer instance (or point to a hosted one via `PONDER_SERVICE_URL`), one EOA with a private key holding the bot's gas and capital, and ideally Flashbots/private-RPC submission to avoid front-running. The bot's market whitelist mechanism is the primary safety control — *only* whitelist markets where the oracle is trustworthy.

#### B) Third-party services and named liquidator operators

There is **no mature "liquidation-bot-as-a-service" product** for Morpho — Morpho is explicitly designed so that MEV searchers compete on the open market for liquidation bonuses. The substitutes are:

- **MEV Capital** — As curator of the Société Générale-FORGE EURCV/USDCV Morpho vaults, MEV Capital explicitly took on liquidation management. From their official announcement: *"MEV Capital will act as a curator of EURCV and USDCV Morpho vaults, supervise the list of eligible crypto collateral assets, ensure optimal capital allocation, and manage efficient liquidations of undercollateralized vault positions."* This is the cleanest precedent for an issuer outsourcing liquidation to a named team via the curator relationship.
- **Wintermute (Armitage)** — Wintermute launched Armitage on **May 19, 2026** with two USDC vaults on Morpho, and Armitage explicitly handles liquidations through Wintermute's own trading infrastructure rather than relying on external liquidators. Per The Block, Armitage supports *"collateral types that other curators cannot,"* and Wintermute CEO Evgeny Gaevoy stated: *"DeFi lending has reached a scale where strategy and risk management matter as much as access."* The pitch: faster execution during volatility and market stress. Available to issuers willing to onboard as a vault under Wintermute's curation.
- **kpk (karpatkey)** — Runs "agent-powered vaults" on Morpho. The Rebalancing Agent and Exit Agent (the latter wired to Hypernative event triggers) react in seconds to oracle staleness, liquidity stress, or price divergence by reallocating capital, preventing liquidation rather than profiting from it. Closest analog to "liquidation infrastructure-as-a-service" on the lender side.
- **Oval by UMA** — A third-party oracle layer deployed on specific Morpho markets (initially by Re7 and Gauntlet) that captures the oracle-extractable value of the liquidation transaction itself and returns part of the revenue to lenders as bad-debt protection. *"Oval will reclaim OEV leaked during liquidations generated on the fast-growing lending primitive Morpho."* Worth integrating if your collateral is volatile and you want to capture liquidation MEV for protocol depositors.
- **Hypernative** — Officially partnered with Morpho for risk monitoring; provides threat detection and health-factor alerts that protocols and curators (kpk, Wintermute, Wave) use to drive automated responses. Not itself a liquidator, but the standard "what triggers the response" layer.
- **B.Protocol** — Despite their original BAMM backstop product, B.Protocol does **not** operate a liquidation backstop on Morpho. Their Morpho involvement is as a risk curator (with Block Analitica) using their SmartLTV framework. There is no governance thread proposing a BAMM-style backstop for Morpho.
- **Morpho's `liquidation.morpho.org` app** — A manual, last-resort UI maintained by Morpho Labs. The Morpho Tool Suite docs explicitly say it *"serves primarily as a backup mechanism when bots fail or for testing purposes."* Not a substitute for production infrastructure.

#### C) Specific concerns for an ERC-20 vault asset + ERC-4626 collateral

Morpho's own security guidance ("Vault as asset" docs) is explicit that ERC-4626 vaults whose share price can decrease and where most shares can be flash-loaned are **not recommended** as Morpho collateral, because liquidation amplification is hard to mitigate. If you proceed:
- Use a vault created with the **MetaMorpho Factory V1.1** (which has *no* bad-debt realization, so the share price cannot decrease) or a Morpho Vault V2 with conservative liquidity assumptions.
- Price the collateral by its exchange rate via `MorphoChainlinkOracleV2` (your RedStone feed should target the underlying, then the oracle adapter converts via `convertToAssets`).
- Set conservative LLTVs and supply caps — even with V1.1, illiquid ERC-4626 collateral creates uncomfortable liquidator math.
- Strongly consider deploying a **pre-liquidation contract** (`morpho-org/pre-liquidation`) so liquidators auto-deleverage gradually rather than seizing in one shot — much friendlier to ERC-4626 collateral.

**Recommendation:** run your own bot (forking `morpho-org/morpho-blue-liquidation-bot`) as the baseline; additionally, partner with a curator (MEV Capital, Wintermute, kpk, or Gauntlet) whose mandate includes liquidation handling for assurance; deploy a pre-liquidation contract; and evaluate Oval for OEV recapture once volume is meaningful.

---

### 3. Allocator / Reallocation Bot Operators

**Role recap.** In Morpho Vaults V2, the **Allocator** is the active execution role: it calls `allocate` / `deallocate` to move idle assets into and out of approved Adapters, sets the `liquidityAdapter` (the adapter that absorbs deposits and serves withdrawals first), and sets `maxRate`. The Allocator role is recommended to be a **hot-key EOA driven by a bot** or a fast-response multisig — *not* the same address as the Curator. The Curator's compromise impact is high; the Allocator's compromise impact is bounded (per Morpho docs: *"can misallocate funds between already approved adapters, potentially leading to suboptimal yield … cannot introduce new, unapproved risks"*).

#### A) Open-source bots

| Repo | Notes |
|---|---|
| `morpho-org/vault-v2-reallocation-bot` ★ | The canonical V2 bot. TypeScript, RPC-only, uses the Morpho API + Morpho SDK. Strategies shipped today: **`equilizeUtilizations`** (rebalances to equalize borrow utilization across listed markets with a configurable delta threshold, default 2.5%) and **`apyRange`** (keeps each market's borrow APY within a global / per-vault / per-market range). New strategies are pluggable via a `Strategy` interface (`findReallocation`). Configured per-chain in `apps/config/config.ts`. The bot's EOA must hold the Allocator role on every whitelisted vault. Multi-chain ready. Maintained on `main`, with active commits as of May 2026. |
| `morpho-org/public-allocator` | The **PublicAllocator** smart contract: a permissionless allocator that the Curator can authorize, allowing borrowers (or a frontend / bundler) to trigger just-in-time liquidity reallocation between a vault's listed markets, bounded by per-market `maxIn` / `maxOut` flow caps. Not a bot, but a critical complementary contract. |
| `morpho-org/morpho-snippets` | Solidity helpers / reference code used by allocators and reallocation logic. |

For Vault V1, the equivalent operational pattern is `reallocate(MarketAllocation[])` called manually from the Curator App or scripted; for V2, the bot above replaces the manual workflow.

#### B) Public Allocator — the "free" semi-allocator

Even if you run your own Allocator bot, you should also enable the **Public Allocator** as an additional allocator on your vault (V1) or via the equivalent V2 mechanism. It costs nothing operationally and dramatically improves borrower UX: when a borrower's target market lacks liquidity, the Morpho frontend (or any bundler) calls `reallocateTo` on the PublicAllocator, which atomically pulls liquidity from other listed markets up to the flow-cap limits. This *aggregates* isolated Morpho market liquidity into something resembling a shared pool from the borrower's perspective. Configure `maxIn` / `maxOut` per market to bound risk; an optional fee can be charged.

#### C) Professional Allocator / curator providers

Most issuers do not run the Allocator role themselves — they hire a curator who takes both the Curator role (risk configuration) and the Allocator role (execution), and runs their own internal reallocation bots. Note that all of these firms are also curators; "allocation" is part of their service, not a separate product.

| Firm | Profile | Morpho status |
|---|---|---|
| **Gauntlet** | Quantitative risk-modeling firm; previously parameterized Aave & Compound. Largest Morpho curator: per Zbandut & Goldstein (arXiv:2512.11976v1, Dec 12, 2025) *"Gauntlet dominates the ecosystem with about $2 billion (27.6% of total TVL)."* | Top of market; pick if you want institutional credibility + quant rigor. |
| **Steakhouse Financial** | Conservative stablecoin-focused curator; curates the Coinbase USDC vault on Morpho. ~$1.29B Morpho TVL (17.8% share per the same arXiv paper). Charges low fees (<3% reported). | Pick for low-volatility, "money-market" style mandates. |
| **MEV Capital** | Active cross-protocol allocator: per eco.com's *Best Stablecoin Vaults in 2026*, *"the firm monitors utilization curves on every supported market and rebalances when an alternative venue offers at least 75 basis points of additional yield at equivalent risk."* Fees: *"12-15%."* Also explicitly offers liquidation management (see §2). | Active management + already integrated with SocGen-FORGE; willing to take liquidation responsibility. |
| **Re7 Labs** | Opinionated, forward-looking curator; rebalances aggressively. ~10–15% fees per eco.com. | Yield-seeking; less suited to predictable steady-state APY. |
| **Block Analitica** | Maker-heritage curator focused on long-horizon collateral risk. | Pick for RWA-adjacent or tail-risk-aware mandates. |
| **Hyperithm** | Crypto hedge-fund manager (Tokyo/Seoul); backed by Coinbase/Samsung/Kakao/Hashed. Active Morpho curator. | Pick for Asia-region market making + curation. |
| **K3 Capital** | Top-five curator by TVL (~$478M / 6.6% per arXiv:2512.11976v1); avoided the Stream/xUSD blowup. | Pick for conservative, well-screened collateral. |
| **Keyrock** | Major market maker; runs Keyrock USDC Vault and Keyrock USDC Vault V2 on Morpho — the V2 vault is explicitly designed for cross-Morpho-protocol allocation. | Pick if you want a market-maker-backed allocator. |
| **Wintermute (Armitage)** | Launched May 19, 2026 with two USDC vaults on Morpho; handles its own liquidations. | Pick for market-maker-grade execution + integrated liquidation. |
| **kpk (karpatkey)** | "Agent-powered vaults" with deterministic on-chain Rebalancing Agent + Exit Agent (Hypernative-triggered). | Pick if you want automated, alert-driven reallocation. |
| **Anthias Labs** | Boutique risk firm; curator of the Moonwell Ecosystem USDC vault on Morpho. Builds monitoring/tooling. | Pick for high-touch, advisory-style curation. |
| **Yearn** | Curates Yearn-branded Morpho vaults with reallocator bots (EOA-managed) holding the reallocator role; Curator role on 2/3 multisig; Owner on Yearn SAM 4/7. | Pick if you want established DeFi-native infra and Yearn distribution. |
| **B.Protocol** | Risk curator with SmartLTV; co-launched Flagship USDC & ETH MetaMorpho vaults with Block Analitica. | Pick for an additional risk-modeling layer; no liquidation backstop. |
| **Bitwise** | Launched institutional non-custodial curation on Morpho in Jan 2026 targeting ~6% APY. | Pick if your audience is U.S. RIA-channel institutional. |
| **RockawayX** | Entered curation in 2026; team blends KPMG/SocGen TradFi vets with ex-MEV Capital crypto specialists. | Pick for institutional risk-underwriting profile. |
| **Apostro** | Conservative risk specialist. | Pick for tight risk parameters. |

#### D) Practical pattern for a new issuer

The recommended setup, in order:
1. **Designate the Allocator role to a hot-key EOA you control** (or to the curator's address if you hired one). Never use a single EOA as Owner — Owner should be a multisig.
2. **Deploy the open-source reallocation bot** (`vault-v2-reallocation-bot`) on a small VM with the Allocator key, whitelisted to your vault, with the `apyRange` strategy initially (it's the easier strategy to reason about at launch when utilization is volatile).
3. **Enable the Public Allocator** with conservative `maxIn`/`maxOut` flow caps so that borrowers from your asset's markets get just-in-time liquidity without you needing to react.
4. **Set timelocks**: a starter timelock of 1 day is fine during config bootstrap; harden to ≥ 1 week before serious TVL accrues. The `decreaseAbsoluteCap` / `decreaseRelativeCap` functions are not timelocked — your Sentinel can de-risk instantly.
5. **Appoint Sentinel(s)** separately from Curator and Allocator — multiple addresses can hold this role and can reactively reduce caps or deallocate in an emergency.
6. **Long-term**: if TVL crosses ~$50M or you need a recognizable risk brand for distribution, hand the Curator + Allocator roles to a named curator from the table above. Gauntlet, Steakhouse, MEV Capital, and Keyrock are the most institutionally credentialed picks; kpk is the pick if automation/agent-driven response is the differentiator.

---

## Recommendations (decision-ready)

**For an ERC-20 vault asset issuer launching a Morpho Blue market + a Morpho Vault V2 (with an ERC-4626 token as collateral somewhere in the system):**

1. **Rewards (week 1):** Open a BD ticket on Merkl Discord, launch a single market-level supply campaign + a vault-level supply campaign via Merkl Studio. Budget the 3% maintenance fee. Reserve URD as a fallback only if you have an exotic eligibility rule Merkl cannot encode.
2. **Liquidations (pre-launch):** Fork `morpho-org/morpho-blue-liquidation-bot`, configure with your market's whitelist, deploy your gated executor contract, fund the EOA with a $25K–$100K floor of the loan asset, enable Flashbots, and run from at least two geographic regions for redundancy. Additionally, deploy a `morpho-org/pre-liquidation` contract with conservative parameters (e.g., `preLLTV` = `LLTV - 3%`, `preLCF1 = 0.1`, `preLCF2 = 1.0`) to auto-deleverage gracefully — critical when ERC-4626 shares are collateral. If you do not want to run your own bot, hire MEV Capital or kpk as curator with explicit liquidation responsibility, or partner with Wintermute via the Armitage program.
3. **Allocation (pre-launch):** Deploy `morpho-org/vault-v2-reallocation-bot` on a dedicated VM, start with `apyRange` strategy, hold the Allocator key in a hardware-backed signer. Enable the PublicAllocator on the vault with conservative flow caps. Owner → 3-of-5 multisig; Curator → 2-of-3 multisig; Allocator → bot EOA + curator multisig; Sentinel → DAO multisig + Hypernative-driven automation address.

**Thresholds that should change the plan:**
- **TVL > $50M or institutional distribution required** → hand Curator role to Gauntlet or Steakhouse; keep Allocator bot or migrate to curator's bot.
- **Volatile collateral / OEV concerns** → integrate Oval by UMA on the relevant markets (see Re7 / Gauntlet deployments as references).
- **Reward burn rate > ~$25K/day** → switch from standard Merkl campaigns to a custom multi-campaign program (negotiate fee with Merkl BD).
- **Bad debt observed > 0.1% of TVL** → review pre-liquidation parameters and tighten LLTV via curator; consider migrating to a curator with explicit liquidation handling (MEV Capital, Wintermute).

---

## Caveats

- **No formal liquidation-as-a-service market exists for Morpho.** Treat the named curators (MEV Capital, Wintermute, kpk) as the substitutes for one; the underlying protocol expectation is that the LIF bonus is sufficient incentive for open-market MEV searchers, and Morpho's own `liquidation.morpho.org` is explicitly a backup UI, not a competitive service.
- **The curator landscape was reshuffled by the Stream Finance / xUSD blowup of November 4, 2025**, when xUSD crashed 77% from $1.00 to $0.26 in 24 hours following a disclosed $93M loss from an external fund manager, generating an estimated $285M in debt exposure across Morpho, Euler, Silo, and Gearbox (per BlockEden.xyz, *Anatomy of a $285M DeFi Contagion*, Nov 8, 2025). MEV Capital's direct exposure was $25.42M and Re7 Labs acknowledged ~$14.65M in its xUSD isolated vault on Euler; Gauntlet, Steakhouse, and K3 Capital did not deploy to xUSD. Diligence each candidate curator's xUSD response before signing.
- **Vault-token-as-collateral risk is real.** Morpho's own docs say it is *"not recommended to list any ERC4626 vault as a loan asset in a Morpho market at the moment,"* and lay out an explicit loss bound when most of an ERC-4626 vault is liquid and flash-loanable. Use a V1.1 factory vault (no bad-debt realization) or a Vault V2 with hardened caps; assume the ERC-4626 collateral will be the weakest part of your risk model.
- **Merkl pricing and timing.** Merkl's 3% fee is taken from the campaign budget, not extra; allow up to one hour for campaigns to become visible after creation. Token wrappers used in custom campaigns must be whitelisted by the Merkl team before launch.
- **Open-source bot maintenance.** The official liquidation and reallocation bots are maintained by Morpho Labs and have non-trivial dependency footprints (Ponder indexer, Postgres, optional Flashbots). Operate them as production infrastructure, not as "set and forget." The V2 reallocation-bot README explicitly notes that it currently supports only the `MorphoMarketV1AdapterV2` adapter — multi-adapter support is on the roadmap.
- **Recency / source quality.** Curator TVL figures cited above (Gauntlet $2B/27.6%, Steakhouse $1.29B/17.8%, MEV Capital $915M/12.6%, K3 Capital $478M/6.6%) come from Zbandut & Goldstein's *Institutionalizing Risk Curation in Decentralized Credit* (arXiv:2512.11976v1, submitted Dec 12, 2025), with a dataset spanning October 1, 2024 to November 19, 2025. The actual ranking shifts month to month, and the curator industry's competitive frame changes rapidly with each blowup. Treat the table as directional, not as a procurement spec.