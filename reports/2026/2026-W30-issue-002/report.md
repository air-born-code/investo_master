# Investo Master — Issue 002: Weekly Overview

- Week: 2026-W30
- Report ID: 2026-W30-002
- Evidence cut-off: 2026-07-26T08:07:05.489Z
- Action posture: NO ACTION — RESEARCH CONTINUES

## Conviction board (2026-W29)

| Candidate | Stage | Score | Valuation asymmetry | Thesis confidence | Market cap |
|---|---|---|---|---|---|
| GEV — GE Vernova | watchlist | 78 | 1/10 | medium | $284.27B |
| VRT — Vertiv Holdings | watchlist | 78 | 1/10 | medium | $112.97B |
| CRDO — Credo Technology Group | researching | 73 | 1/10 | low | $38.41B |
| RKLB — Rocket Lab | researching | 72 | 1/10 | low | $42.00B |
| MP — MP Materials | researching | 72 | 4/10 | medium | $8.09B |

---

# Investo Master — Week 2026-W30

## Summary

**No new data was recorded for this week.** The research store contains no `2026-W30` rows in `weekly_metrics.csv`, `scores.csv`, `thesis_updates.csv`, or `sources.csv`. Every price, score, and thesis status below is carried forward unchanged from week `2026-W29`, as of 2026-07-18. Nothing in the store has been re-measured since.

This is therefore a maintenance issue, not an analytical one. There is no new evidence to upgrade or downgrade any thesis, and no candidate has moved stage: `assets.csv` shows GEV and VRT on `watchlist`, and CRDO, RKLB and MP on `researching`, all with `last_reviewed_date` of 2026-07-18.

The one durable observation worth restating is the shape of the scoring table. Four of the five candidates score **1 out of 10 on valuation asymmetry** (GEV, VRT, CRDO, RKLB in `scores.csv`, 2026-W29). MP is the sole exception at 4. Whatever else these businesses are, the store's own assessment is that price is currently the binding constraint on four of them — not business quality, where the same rows award 12–15 of 15 on market runway and 10–13 of 15 on moat.

## Theme notes

All six themes in `themes.csv` carry `last_updated_date` of 2026-07-18 and no revisions were logged this week.

The most recently published source in the store is the IEA's *Global Critical Minerals Outlook 2026* (published 2026-07-16, `src-2026-w29-iea-minerals`), which states that supply concentration and export controls have made diversification a strategic priority. It sits alongside the IEA rare-earths summary (`src-2026-w29-iea-rare-earths`) recording China at 91% of refining and 94% of sintered permanent-magnet production in 2024 — the quantitative backbone of the `critical-minerals-security` theme, and the reason MP's `market_runway` and `moat` scores are supported by structural rather than company-specific evidence.

For `age-of-electricity` and `ai-physical-infrastructure`, the supporting evidence remains the IEA *Electricity 2026* forecast of 3.6% annual global demand growth through 2030 with data centres driving roughly half of US demand growth (`src-2026-w29-iea-electricity`), corroborated directionally by the EIA *Annual Energy Outlook 2026* on server energy use as an important driver of US demand growth (`src-2026-w29-eia-aeo`). Both are forecasts, not measurements, and neither has been updated since access on 2026-07-18.

Macro context is unchanged and dated: the federal-funds target range at 3.50%–3.75% (FOMC statement 2026-06-17, `src-2026-w29-fed`); headline CPI 3.5% and core CPI 2.6% (2026-07-14, `src-2026-w29-cpi`); payrolls +57,000 and unemployment 4.2% (2026-07-02, `src-2026-w29-jobs`). No newer macro release is in the store, so I cannot say whether any of these have since moved.

`advanced-nuclear-enablers` remains `monitoring` with no candidate attached in `asset_themes.csv`. The only supporting row is the NRC's *Advanced Reactor Highlights 2026* (2026-04-15, `src-2026-w29-nrc`) noting a new Part 53 pathway and approved TerraPower construction activity. Regulatory progress without a researched candidate is not yet an investable position.

## Watchlist notes

| Asset | Stage | Price (2026-07-18) | Market cap | Total score | Valuation asymmetry | Thesis confidence |
|---|---|---|---|---|---|---|
| GEV | watchlist | $1,057.84 | $284.27B | 78 | 1 / 10 | medium |
| VRT | watchlist | $289.56 | $112.97B | 78 | 1 / 10 | medium |
| CRDO | researching | $206.00 | $38.41B | 73 | 1 / 10 | low |
| RKLB | researching | $67.62 | $42.0B | 72 | 1 / 10 | low |
| MP | researching | $57.55 | $8.09B | 72 | 4 / 10 | medium |

All rows from `weekly_metrics.csv` and `scores.csv`, week 2026-W29. `data_quality` on every metrics row flags prices and market caps as third-party snapshots (reliability `medium` in `sources.csv`) with operating data issuer-reported or SEC-filed.

**GE Vernova.** Baseline thesis (`tu-2026-w29-gev-baseline`): demand confirmed, valuation leaves little room for ordinary execution. Supporting evidence is Q1 orders of $18.3B, backlog of $163B and data-centre electrification equipment orders of $2.4B (`src-2026-w29-gev-q1`, 2026-04-22), with the 10-Q confirming segment performance and continuing Wind losses (`src-2026-w29-gev-10q`). Recorded evidence against: Wind expected to lose about $400M of segment EBITDA in 2026 against a roughly $284B market cap. The open question — what portion of data-centre orders is repeatable and what margins are embedded in backlog — is unresolved, and its stated checkpoint (Q2 2026 segment orders, backlog margin, data-centre order composition) has not been recorded in the store.

**Vertiv.** Baseline thesis (`tu-2026-w29-vrt-baseline`): direct AI infrastructure beneficiary, demanding price. Q1 sales rose 30% and full-year organic growth guidance was raised to 29%–31% (`src-2026-w29-vrt-q1`, 2026-04-22). The 10-Q explicitly identifies cancellation, fixed-price, capacity and customer-spending risks (`src-2026-w29-vrt-10q`, stance `challenges`). Operating margin is the only margin figure the store holds for VRT: 0.166. Durability of book-to-bill after customer build plans normalise remains the open question; the Q2 2026 orders and cancellation commentary checkpoint is not yet in the store.

**Credo.** Highest growth, lowest confidence pairing in the table (`thesis_confidence: low`). FY2026 revenue of $1.335B, growth of 205.7%, operating cash flow of $464M, and $1.4B net cash (`weekly_metrics.csv`; `tu-2026-w29-crdo-baseline`); Q4 revenue grew 157% year over year at a 68.2% GAAP gross margin (`src-2026-w29-crdo-results`, 2026-06-01). Against that, the 10-K records two customers at 49% and 32% of FY2026 revenue — 81% combined — and $182.6M of share-based compensation (`src-2026-w29-crdo-10k`, 2026-06-16). The concentration question is the thesis. No fiscal Q1 2027 data is in the store.

**Rocket Lab.** The Iridium agreement changed the underwriting problem and has not been resolved since. Q1 revenue was $200.3M with backlog above $2.2B and 63.5% growth (`src-2026-w29-rklb-q1`; `weekly_metrics.csv`); Iridium adds 2.55M subscribers, L-band spectrum and an existing service network (`src-2026-w29-rklb-iridium-release`, 2026-06-29). Against: Q1 net loss $45.0M, operating cash outflow $50.3M, ATM proceeds $445.6M (`src-2026-w29-rklb-10q`), and a $3.6B bridge commitment for a cash-and-stock acquisition (`src-2026-w29-rklb-iridium`). The stated checkpoint — Form S-4, permanent financing plan, Neutron milestones, transaction approvals — has produced nothing recorded in the store. Until the S-4 exists, the per-share return distribution is not underwritable, and `financial_strength` at 7/10 with `moat` at 10/15 does not compensate.

**MP Materials.** The only candidate scoring above 1 on valuation asymmetry, and the only one where the recorded bear point is about the *quality* of earnings rather than the price. NdPr production rose 63%, sales volume 117%, and magnetics revenue reached $21.1M (`src-2026-w29-mp-q1`, 2026-05-07). But Q1 included $42.3M of price-protection income under the $110/kg government price floor (`src-2026-w29-mp-10q`), and the company still reported a net loss (`tu-2026-w29-mp-baseline`). Magnetics revenue of $21.1M against $42.3M of price-protection income is the whole question in two numbers. The checkpoint — 10X construction budget, Independence yields, customer qualification and ex-support economics — is outstanding.

No kill criterion was triggered: all five `thesis_updates.csv` rows show `kill_criterion_status: not_tested`.

## Data gaps

- **No 2026-W30 data of any kind.** No metrics, scores, thesis updates or sources were recorded for this week. I cannot say whether prices, orders, or theses moved between 2026-07-18 and the W30 date.
- **Q2 2026 results are the stated next checkpoint for GEV and VRT and are absent.** Both `next_checkpoint` fields reference Q2 2026 disclosures; no such filing or release appears in `sources.csv`. The most recent GEV and VRT primary sources are dated 2026-04-22.
- **No Form S-4 or permanent financing plan for the Iridium transaction.** `tu-2026-w29-rklb-baseline` names the fully financed per-share return distribution as the open question, and the store holds no document capable of answering it.
- **Enterprise value is blank for all five assets**, so no EV-based valuation work is possible from this store.
- **Revenue TTM is present only for CRDO** ($1,335,116,000). GEV, VRT, RKLB and MP have growth rates but no revenue level.
- **Margin data is near-absent.** Gross margin exists only for RKLB (0.382); operating margin only for VRT (0.166); free-cash-flow margin is blank for all five. Statements about margin trajectory therefore cannot be sourced.
- **No kill criteria are written down.** `kill_criterion_status` reads `not_tested` for all five, but the store contains no field recording what the observable falsifying facts actually are. This is a gate-13 deficiency under the Patience and Conviction Policy and should be closed before any candidate approaches decision review.
- **Prices and market caps are `medium`-reliability third-party snapshots** dated 2026-07-16 and 2026-07-17, not exchange data.
- **No scuttlebutt, customer, competitor or employee evidence** appears anywhere in `sources.csv`. Every `product_evidence` score (8–9 of 10) rests on issuer disclosure alone.

## Action posture

**No action.**

Nothing was measured this week, so nothing can have changed. Four of five candidates carry a valuation-asymmetry score of 1 out of 10, which is the store's own record that price does not currently permit an adequate expected return regardless of business quality. The fifth, MP, scores 4 — better, but its Q1 result included $42.3M of price-protection income against $21.1M of magnetics revenue (`src-2026-w29-mp-10q`, `src-2026-w29-mp-q1`), and the ex-support economics that would justify the position are explicitly listed as unresolved.

No candidate satisfies the minimum gate for decision review. Specifically: no kill criteria are recorded for any of the five; no disconfirming primary research beyond issuer risk-factor disclosure exists; and RKLB lacks the financing document required for any valuation asymmetry analysis at all.

The highest-value work for next week is mechanical rather than exploratory: record W30 metrics, retrieve Q2 2026 disclosures for GEV and VRT if published, check EDGAR for the Rocket Lab S-4, and write down explicit kill criteria for all five candidates so that future weeks can test something.

*Research and decision support only. Not personalised financial advice. No trades are executed.*

## Safety boundary

Research and decision support only. No trades, promised returns, or personalised financial, tax or legal advice. The human investor retains responsibility for every decision.
