# Liquidator & MEV Searcher Landscape for a Brix iTRY / wiTRY Morpho Market on MegaETH

## TL;DR
- **The honest answer:** there is no off-the-shelf liquidator network you can plug into for a TRY-denominated, Turkish government MMF token on MegaETH. The official `morpho-org/morpho-blue-liquidation-bot` covers Morpho Blue on any EVM chain, but every known liquidator team is set up for stablecoin- or ETH-denominated swap paths, and MegaETH has no public MEV/searcher ecosystem yet beyond what its single sequencer captures internally.
- **Your most realistic path is a hybrid two-tier model:** (1) opt into Morpho Pre-Liquidations to give borrowers a softer landing and reduce dependence on competitive liquidators, and (2) sign 2–4 named "warm" liquidators — most credibly **Wintermute (Armitage)**, your curator (if you choose **Gauntlet** or **MEV Capital**), and 1–2 Turkish-banking-connected market makers — and pay them in iTRY/wiTRY collateral. Treat any third-party "permissionless" liquidator coverage as a bonus, not a primary line of defense.
- **The exotic-collateral problem is real:** liquidators need a deep onchain venue to dump seized iTRY back into USD-denominated assets. Until iTRY has Uniswap/Curve depth on MegaETH or a bridge to Ethereum mainnet, expect bad-debt risk during fast TRY moves. Build at least one redemption-style liquidator (someone who can take iTRY directly to Brix and redeem to TRY/USD) into your launch plan.

## Key Findings

### 1. Morpho Blue's liquidation stack is open-source, mature, and chain-portable — but liquidator identities are mostly anonymous

- **`morpho-org/morpho-blue-liquidation-bot`** (the official reference bot — 100 stars / 61 forks, last updated March 25, 2026, MIT-licensed TypeScript; v2.0.0 released June 2025) is RPC-only, supports pre-liquidations, and is explicitly designed to be deployed on "any EVM chain where Morpho is supported." It uses configurable "pricers" — DefiLlama, Morpho API, Chainlink registry, UniswapV3 — and includes a market whitelist mechanism. Maintainers visible in the commit history are **Jean-Grimal** (Morpho Labs) and **Hayden Shively** (founder of Aloe Labs, GitHub `@haydenshively`, known previously for the New-Bedford / Nantucket Compound liquidation bots).
- **`crisog/morpho-liquidator`** — a Solidity + ParaSwap implementation by GitHub user `crisog`, references Morpho's own docs as a baseline. Useful as a customizable starting point if you want to bake in 1inch/Pendle PT venues directly.
- **`morpho-org/morpho-liquidation-bot-educational`** — a Hardhat-based tutorial bot used to teach the mechanics; not production-grade.
- The legacy **`morpho-org/morpho-liquidation-flash`** bot still has Morpho Labs' own addresses hardcoded as the default allowed liquidators ("The two example addresses in the .env.example file are the ones of Morpho Labs"), which confirms Morpho Labs historically ran liquidators of last resort on the Optimizers.
- Other community implementations linked from Morpho's docs include `etherhood/Liquidator-Morpho` (Rust + Solidity) and `zach030/morpho-liquidator-bot` (Go + Solidity).
- **Mechanism economics:** Morpho Blue uses a 100% close factor with a Liquidation Incentive Factor (LIF) = min(1.15, 1/(0.3·LLTV + 0.7)). For an 86% LLTV market, that's ~5% bonus to the liquidator; for a lower LLTV (typical for an exotic asset, say 70%), the bonus would be ~8–9%. Morpho takes no protocol fee — the full LIF accrues to whoever closes the position. **Pre-liquidations** (audited by Spearbit and ABDK, and now part of Morpho's $2.5M Immunefi and $2.5M Cantina bug bounty programs — see docs.morpho.org/morpho-vaults/concepts/security/bug-bounty) let you customize the close factor and LIF and even mimic a Dutch auction.
- **Identifying actual liquidator wallets** is harder than you would expect: Morpho's Liquidation Dune dashboard (dune.com/morpho/morpho-liquidation) exposes addresses but no public mapping to identities. The Morpho docs explicitly disclaim coverage: "Some community members have contributed and provided liquidation bots... Morpho Association nor authors of these repositories can be held responsible for any losses or damages."

### 2. Named teams you can actually email or DM

- **Wintermute — Armitage vaults (most important new entrant).** On May 19, 2026 Wintermute launched its Armitage vault product on Morpho with an explicit liquidation-in-house promise: "Wintermute can execute liquidations for every market we support. We do not rely on third-party liquidators to appear when positions need to be unwound. This lets us safely support collateral types that other curators cannot, expanding the yield opportunity set without compromising depositor protection." Two vaults at launch (Wintermute USDC Prime, Wintermute USDC Select). Contact: @wintermute_t on X; armitage.wintermute.com; CEO Evgeny Gaevoy; OTC desk trade@wintermute.com.
- **Gauntlet** is the only curator that publicly discusses being in "ongoing communication with Morpho's liquidation teams" (Gauntlet VaultBook). They designed the Apollo ACRED looping vault on Morpho ("Gauntlet sets the leverage and unwind logic so the experience is an automated credit strategy rather than manual margining") and Gauntlet's Rahul Goyal (Head of Institutional Partnerships) confirmed to Unchained that for ACRED: "crypto prime brokers and market makers… have agreed to step in and liquidate the loans as needed. He did not provide any names, but told Unchained that the company had a hit rate of 100% in these discussions." Contact: @gauntlet_xyz; forms on gauntlet.xyz; founder Tarun Chitra is publicly reachable.
- **Other Morpho curators worth approaching as "first-call" liquidators** (none publicly claim to run liquidators, but all monitor markets continuously and many have trading desks): **Steakhouse Financial**, **MEV Capital**, **Re7 Labs**, **Block Analitica**, **Apostro**, **K3 Capital**.
- **FastLane Labs** (`@FastLaneLabs`, fastlane.xyz, GitHub `FastLane-Labs/atlas`) is the closest thing to "OFA / liquidation-as-a-service" infrastructure in EVM today, and they have explicitly extended Atlas to alternative EVMs (Polygon, Monad). Their Atlas framework lets you publish an "Atlas Module" so solvers compete in a backrun auction for your liquidation order flow — useful if MegaETH adopts an Atlas-style sequencer extension.
- **Open-source bot authors / individuals**: Hayden Shively (`@hayden_shively` on Twitter, `haydenshively` on GitHub) authored two of the most-forked OSS DeFi liquidation bots ever (Nantucket, New-Bedford) and is now an active maintainer on the official Morpho bot — he is a high-value direct contact.

### 3. Generic DeFi MEV searcher / liquidation operators

The "named, publicly contactable" surface of MEV liquidators is much smaller than it looks:

- **Flashbots** (flashbots.net, Discord channels `#🐣 newcomers`, `#🤖 searchers`, and the Searcher Self-Support Forum) is the front door — every searcher running on Ethereum mainnet is reachable through there. Flashbots has openly identified "arbitrage and liquidation bots" as the canonical searcher type. For Ethereum/Base liquidations you can post your market via the Flashbots forum and Discord and use MEV-Share to opportunistically refund some MEV back to your market.
- **FastLane Labs** (Polygon PFL, Atlas, Monad MEV Research Group) is the analogous front door for alt-EVMs; their Atlas auction framework is the only generalized "build your own OFA" stack live today.
- **Market makers with active DeFi liquidation desks** (most of them keep this private, but they all run liquidator inventory):
  - **Wintermute** (@wintermute_t, trade@wintermute.com) — confirmed Morpho liquidator via Armitage; also LP/backer of MegaMafia.
  - **GSR**, **Keyrock**, **Flowdesk**, **Amber Group**, **B2C2**, **Cumberland (DRW)**, **Jump Trading** — universally known to run DeFi liquidation strategies but none have publicly committed to a Morpho liquidator role I could verify. For a TRY-denominated MMF the right way in is through their OTC/DeFi BD teams.
- **The "ACRED model" precedent.** Apollo's ACRED on Morpho is the closest analogue to what you're attempting (a regulated, whitelisted, non-trivially-redeemable RWA collateral with a Morpho looping vault). Gauntlet stated they had pre-arranged "crypto prime brokers and market makers" to step in if liquidations are needed, with a 100% hit rate in pre-launch conversations. The unnamed counterparties almost certainly include the same set above (Wintermute / GSR / Keyrock / Jump tier). The lesson: for RWAs, liquidator relationships are negotiated bilaterally before launch, not discovered after.

### 4. The MegaETH MEV environment is essentially captive and centralized

MegaETH's architecture has direct implications for your liquidator strategy:

- **A single sequencer, no public mempool.** MegaETH employs "one very powerful sequencer" with "sub-10ms latency, 100k TPS." There is no public mempool that Ethereum-style backrun searchers can monitor, and there is currently no MEV-Boost / PBS equivalent on the chain. This eliminates classical Flashbots-style searcher competition for your liquidation order flow.
- **MEV revenue is internalized by the protocol.** MegaETH has signaled that "the project also plans to internalize MEV revenue through sorter permissions and rack hosting services" and is building "Proximity Seat: Reserved server slots near the sequencer, tiered by latency. Top-tier seats are auctioned; mid-tier combines auction + MEGA locking; entry-level requires locking only." Translation: liquidators who want guaranteed inclusion will need to lock MEGA and buy a proximity seat, or be served through whoever wins those seats.
- **Aave V3 launched on MegaETH on Feb 9, 2026, with day-one Chainlink data feeds.** Per The Defiant (Feb 13, 2026): "Aave's deposits on MegaETH crossed $575 million on Friday as capital continued flowing into the Ethereum Layer 2 network a day after its long-awaited MEGA token launch. The figure represents a sharp jump from the roughly $355 million in total DeFi deposits MegaETH hosted at the time of the TGE on Thursday." Aave's official account (@aave) confirmed on May 7, 2026: "Aave crossed $1 billion deposits on @megaeth." That means **a working liquidator population already exists on MegaETH for Aave** — though no named teams have publicly claimed the role. Whoever those are is your most likely candidate set for Morpho liquidators too, because the bot stack is nearly identical.
- **Backers of the chain who run bots in-house**: Wintermute, GSR, and Kraken Ventures are publicly listed among MegaMafia / MegaETH supporters. These are the highest-prior teams to have liquidator-capable infrastructure already deployed on the chain.
- **MegaBot (`@Mega_BotETH`)** is an ecosystem trading/sniping bot with marketing copy referencing "MEV defense" — it is a consumer trading bot, not a searcher infra provider, but it indicates the chain has surfaced some bot operators publicly.
- **Teko Finance** (`@tekofinance`) and **Avon** are lending/credit primitives on MegaETH that face the same liquidator-sourcing problem; talking to them about who liquidates their positions today is a cheap way to learn the MegaETH liquidator landscape.

### 5. Exotic/FX/RWA collateral: a separate, harder problem

A TRY-denominated tokenized MMF has several properties that break standard liquidator playbooks:

- **No deep onchain TRY/USD venue.** A liquidator who seizes iTRY collateral needs an immediate exit. The seizable bonus (5–10%) only works if onchain slippage to swap iTRY → USDM/USDC is materially less than the bonus. Until iTRY has Uniswap v3/v4 or Curve liquidity in the millions, this is the binding constraint, not bot availability. **RedStone is the oracle solving the FX-hours-vs-24/7 mismatch** for iTRY ("a hybrid, adaptive feed designed specifically for the temporal eccentricities of emerging-market assets"), but oracles don't create swap liquidity.
- **FX volatility risk is bidirectional and unhedged for the liquidator.** A liquidator who holds iTRY for even minutes during a TRY tail event is taking on uncovered FX risk that none of their existing risk systems are calibrated for. Expect them to demand higher LIFs (8–10%, not 5%) and tighter LLTVs.
- **Pre-existing comparables and what they teach you:**
  - **Apollo ACRED on Morpho** — handled by an unnamed group of "crypto prime brokers and market makers" pre-committed by Gauntlet, plus a programmatic Gauntlet-controlled unwind ("automated credit strategy rather than manual margining"). Bilateral, not permissionless.
  - **Backed Finance bIB01** — gated/whitelisted. The wbIB01 wrapper "requires a whitelisting process. Thus to be able to use such market, one's wallet needs to be whitelisted" — meaning the liquidator must also be KYC'd. Morpho's docs specifically call this out.
  - **Ondo USDY, Spiko EUTBL, BlackRock BUIDL** — IOSCO concluded the sector "has yet to deliver the promised secondary-market liquidity benefits"; BUIDL has only ~85 holders and ~104 monthly transfers as of mid-2025. None has a documented, named third-party liquidator on Morpho. RWA liquidations today are still manual workouts.
- **Implication:** your collateral effectively requires you to underwrite the liquidator relationship the same way Apollo/Gauntlet did for ACRED — by pre-selecting and signing them.

### 6. How to actually reach searchers

| Channel | What it's good for | Direct link / handle |
|---|---|---|
| Morpho Discord (`#liquidations` channel) and Morpho forum (forum.morpho.org) | Posting a new-market announcement that the public liquidator population reads | discord.gg/morpho; forum.morpho.org |
| Flashbots Discord (`#🤖 searchers`) + Flashbots Forum | Reaching Ethereum-mainnet liquidators directly | docs.flashbots.net (linked from flashbots.net) |
| FastLane Discord and Atlas docs | Reaching searchers familiar with alt-EVM auction stacks; closest match for a MegaETH-style chain | fastlane.xyz; @FastLaneLabs |
| Gauntlet, Steakhouse, MEV Capital, Re7 BD inboxes | Talking to vault curators who already monitor liquidator quality and can intro you | gauntlet.xyz; steakhouse.financial; mevcapital.com; re7capital.com |
| Wintermute OTC | Onboarding a single, accountable, in-house liquidator | trade@wintermute.com; @wintermute_t |
| Morpho Labs BD (Tom Reppelin `@TomReppelin`, Paul Frambot) | Co-marketing the new market to liquidators who follow Morpho's announcements | @TomReppelin; @PaulFrambot |
| MegaETH ecosystem channels (Discord, MegaMafia program leads) | Identifying who already runs liquidations on Aave-MegaETH | megaeth.com; @MegaETH_labs |
| Direct DM to Hayden Shively (`@hayden_shively`) and `@haydenshively` GitHub | Talking to the actual author of the bot you're going to deploy | github.com/haydenshively |
| Brix's own investors (Circle Ventures, ConsenSys, FRWRD/Yapi Kredi, Is Asset Management, Paribu, Borderless) | Warm introductions to Turkish market makers who could redemption-liquidate iTRY | Brix corporate channels |
| Turkish trading desks (Paribu, BtcTurk) | Onshore liquidator who can actually redeem iTRY → TRY in TradFi | Paribu (already an investor) |

## Details

### How a working liquidator stack for your market should look

1. **Deploy the official Morpho Blue liquidation bot on MegaETH** — fork `morpho-org/morpho-blue-liquidation-bot`, add a MegaETH chain config (wNative, Morpho deployment block, market whitelist), and add an iTRY/wiTRY pricer that combines RedStone's iTRY feed with on-chain Uniswap v3/v4 depth checks. This becomes your "free option" public liquidator anyone can run. Encourage it.
2. **Use Pre-Liquidations to soften the cliff.** Configure a pre-LLTV ~3–5% below LLTV, with a low preLCF1 (10% close factor at first), preLCF2 → 100% near LLTV, and preLIF starting at ~2% rising to the standard LIF. This buys liquidators a smaller, easier-to-execute opportunity earlier and reduces the risk of a single large liquidation when TRY moves fast.
3. **Sign 3–5 "warm" liquidators** with bilateral coverage agreements. Priority order:
   - **Wintermute** (Armitage already runs Morpho liquidations in-house; backer of MegaETH; OTC TRY market). Highest fit.
   - **Your chosen curator's preferred liquidator network.** If you pick **Gauntlet**, ask Rahul Goyal directly for the same "prime brokers and market makers" he used for ACRED. If you pick **Steakhouse** or **MEV Capital**, ask them to name their preferred warm bots.
   - **A Turkish-banking-connected counterparty** with the ability to redeem iTRY directly with Brix and exit through Yapi Kredi / Is Bank / Paribu rails. This is the "redemption liquidator" of last resort — they don't care about onchain TRY depth because they're going to redeem. This is what makes the structure safe.
   - **One generic MEV team** (GSR or Keyrock are the most receptive to bilateral deals on exotic collateral; FalconX has the institutional KYC pipes).
4. **Onboard whoever already runs Aave-V3-on-MegaETH liquidators** — they are already integrated with the sequencer and the MegaETH oracle stack. The Aave V3 deployment ARFC on the Aave governance forum is the public artifact you can use to find them.
5. **Pay for inclusion explicitly.** MegaETH has signaled that Proximity Seats will be auctioned and MEGA-locked. Either run a proximity-seat liquidator yourself or include a top-tier liquidator who already has one. Without this, all liquidator competition collapses to whoever already pays for proximity.

### What can go wrong, and what the precedents say

- **The Aave / rsETH precedent.** Aave required a governance-driven oracle manipulation to wind down the Kelp DAO attacker's rsETH position — proof that exotic collateral can require manual workouts even on a top lending protocol with mature liquidators. Plan for a governance/break-glass procedure for your market.
- **The Stream Finance precedent on Morpho.** Chorus One's 2025 DeFi Curators report documents that "only one of roughly 320 MetaMorpho vaults (MEV Capital's) had direct exposure to xUSD, resulting in about $700,000 in bad debt. However, the shock raised ecosystem-wide risk aversion, with many lenders wanting to withdraw at once." Even "safe" USDC vaults curated by Steakhouse and Gauntlet briefly became illiquid "out of caution rather than losses." Isolation contained the damage to one vault. Your market should be a single isolated Blue market with conservative caps for the same reason.
- **The Apollo ACRED model is the template.** A regulated RWA on Morpho with pre-arranged, non-public liquidators and a curator-orchestrated unwind. Stand it up the same way.

## Recommendations

**Do these in the next two weeks (pre-launch):**

1. **Email Wintermute OTC (trade@wintermute.com) and DM @wintermute_t** with a one-pager: market parameters, LIF, oracle (RedStone), expected iTRY DEX depth, and your willingness to pay a higher LIF for a coverage commitment. Wintermute is the single highest-value contact in this stack.
2. **Sign Gauntlet or Steakhouse as curator** and require, as part of the curator agreement, an introduction to their existing Morpho liquidator network. Gauntlet's framework explicitly states they "actively monitor this ecosystem through ongoing communication with Morpho's liquidation teams" — make them surface those teams to you.
3. **Fork and configure `morpho-org/morpho-blue-liquidation-bot`** for MegaETH, write the iTRY pricer (RedStone + on-chain DEX), and publish the fork. Post it on the Morpho forum and Flashbots Discord `#🤖 searchers` channel with explicit LIF math and example PnL.
4. **Use Pre-Liquidations** with a Dutch-auction-style dynamic LIF (preLIF1 = 1.02, preLIF2 = standard LIF) so that liquidations happen earlier and cheaper for borrowers and competition is more granular.
5. **Lock a Turkish redemption liquidator** — Paribu is already a Brix investor and the most natural fit. Their job is to absorb seized iTRY at NAV minus a defined haircut, regardless of onchain liquidity. This is your true backstop.
6. **Run an internal liquidator** in the first 60 days. Hold a 6–12% iTRY/USDM inventory and run the bot from your own treasury. This guarantees coverage and gives you data to recruit external liquidators later.

**Benchmarks that should change your plan:**

- If you fail to sign at least **one named non-Wintermute liquidator** by launch, **lower LLTV by 5–10 percentage points** and **lower supply cap by 50%** until you do.
- If onchain iTRY DEX depth (sum of top 3 pools, ±2% range) is **below 5× the largest borrow size**, do not allow that borrow to open — enforce via supply cap, not LLTV.
- If MegaETH publishes a proximity-seat auction price above what your top liquidator is willing to pay, **buy the seat yourself** and run the bot.
- If you observe **>30 minutes of underwater position with no liquidator action** in any backtest or paper-trade, treat your liquidator network as failed and add another counterparty before scaling caps.

**Staged rollout:**

- **Weeks 0–4 (caps ≤ $5M):** internal liquidator + Wintermute. Single market, low LLTV (≤ 70%), pre-liquidations on.
- **Weeks 4–12 (caps ≤ $25M):** add 1–2 curator-introduced liquidators; publish the public bot fork; offer a bounty (in MORPHO or your token) for the first three independent liquidators who close a position.
- **Months 3–6 (caps > $25M):** open the market to permissionless liquidators only after at least three distinct, identified addresses have profitably closed positions on your market.

## Caveats

- **Wintermute's Armitage product launched on May 19, 2026** — its live track record as a Morpho liquidator at the time of writing is essentially zero. Its claim to "execute liquidations for every market we support" is a stated commitment in a forum proposal, not a measured outcome. Treat it as their published policy, not as historical proof.
- **The Apollo ACRED liquidator list is unverified.** Gauntlet's Rahul Goyal explicitly "did not provide any names" for the pre-committed liquidators; he claimed a "100% hit rate in these discussions" — that is a sales claim and is not independently auditable.
- **MegaETH's MEV supply chain is still being built.** Public statements describe future Proximity Seats, MEGA-locked auctions, and KPI-tranche unlocks (with "Oracle-based KPI verification" only planned as a "Phase 3 (future)" step). Anything assuming a Flashbots-style permissionless searcher market on MegaETH is speculation.
- **No verified, named third-party liquidators exist for Backed bIB01, Centrifuge JTRSY, Ondo USDY, or Spiko EUTBL on Morpho** as of the search date. The RWA-collateral liquidator market is genuinely thin, and your market would be one of the earliest examples — plan accordingly.
- **Liquidator Dune dashboards (e.g., dune.com/morpho/morpho-liquidation) show wallet addresses, not identities.** Mapping the most active Morpho liquidator wallets to teams would require either an on-chain attribution exercise or direct outreach via Morpho Labs — both worth doing before launch, but neither was completable in this research.
- **Regulatory risk on iTRY/wiTRY is open-ended.** Turkey's CMB framework for tokenized MMFs is still being written; if Brix's classification changes mid-stream, your liquidators may face KYC/whitelisting constraints that don't exist today and break permissionless liquidation entirely.