# Investo Master — Issue 002: Quiet Week

- Week: 2026-W30
- Report ID: 2026-W30-002
- Evidence cut-off: 2026-07-26T07:44:52.566Z
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

# Investo Master — Weekly Issue 2026-W30

## Summary

**No new evidence entered the research store this week.** Every row in `weekly_metrics.csv`, `scores.csv`, `thesis_updates.csv` and `sources.csv` carries `week_id = 2026-W29` and `as_of_date = 2026-07-18`. There are no W30 prices, no W30 scores, no new filings and no new thesis updates. This issue therefore records state, not change, and no candidate's position has moved.

The standing picture from the 2026-W29 baseline is unchanged and worth restating once, because it is the operative constraint:

| Asset | Stage | Total | Valuation asymmetry (of 10) | Thesis confidence | Market cap (2026-07-18) |
|---|---|---|---|---|---|
| GEV | watchlist | 78 | **1** | medium | $284.27B |
| VRT | watchlist | 78 | **1** | medium | $112.97B |
| CRDO | researching | 73 | **1** | low | $38.41B |
| RKLB | researching | 72 | **1** | low | ~$42B |
| MP | researching | 72 | 4 | medium | $8.09B |

Four of five candidates score 1 out of 10 on valuation asymmetry (`scores.csv`, 2026-07-18). That is the single most important fact in the store: business quality is being scored high while expected return is being scored near the floor. Nothing this week alters it, because nothing this week was measured.

The next scheduled evidence for all five names is Q2 2026 reporting or filing-based (`scores.csv` next_checkpoint field: GEV Q2 segment orders and backlog margin; VRT Q2 organic orders and book-to-bill; CRDO fiscal Q1 2027 customer mix; RKLB the Form S-4 and permanent financing plan; MP the 10X construction budget and Independence yields). None of it is in the store yet.

## Theme notes

The macro and structural sources in the store were all accessed 2026-07-18 and none has been refreshed:

- **Age of Electricity / AI Physical Infrastructure.** The IEA's *Electricity 2026* forecasts global electricity demand growth of 3.6% annually through 2030, with data centres driving roughly half of US demand growth (`src-2026-w29-iea-electricity`, published 2026-01-01). The EIA's *Annual Energy Outlook 2026* independently identifies data-centre server energy use as an important driver of US demand growth (`src-2026-w29-eia-aeo`, 2026-04-01). Two official forecasters agreeing on direction is the strongest part of the demand case; neither source in the store quantifies the *margin* available to equipment suppliers, which is exactly where both GEV and VRT theses are unresolved.
- **Critical Minerals Security.** The most recent primary source in the entire store is the IEA's *Global Critical Minerals Outlook 2026* (`src-2026-w29-iea-minerals`, published 2026-07-16), which states that supply concentration and export controls have made diversification a strategic priority. The concentration figures remain those of `src-2026-w29-iea-rare-earths`: China held 91% of refining and 94% of sintered permanent-magnet production in 2024. This is the theme where policy support and the investment case are hardest to separate.
- **Advanced Nuclear Enablers** remains `monitoring` in `themes.csv`. The only supporting row is the NRC's *Advanced Reactor Highlights 2026* (`src-2026-w29-nrc`, 2026-04-15), noting a new Part 53 pathway and approval of TerraPower construction activity. No asset in `asset_themes.csv` is linked to this theme, so there is nothing to underwrite here yet.
- **High-Speed Compute Connectivity** and **Vertically Integrated Space** are both `medium` confidence in `themes.csv` and each has a single linked asset. No new theme-level evidence this week.

Macro context, unchanged: the federal-funds target range was 3.50%–3.75% at the 2026-06-17 FOMC statement (`src-2026-w29-fed`); June CPI was 3.5% headline and 2.6% core (`src-2026-w29-cpi`, released 2026-07-14); June payrolls rose 57,000 with unemployment at 4.2% (`src-2026-w29-jobs`, released 2026-07-02).

## Watchlist notes

No thesis status changed. The baseline tensions, each from the 2026-W29 update rows:

**GE Vernova (watchlist).** Q1 2026 orders were $18.3B, backlog $163B, and data-centre electrification equipment orders $2.4B (`src-2026-w29-gev-q1`). Against that, the baseline update records an expected ~$400M Wind segment EBITDA loss in 2026, and the 10-Q confirms continuing Wind losses (`src-2026-w29-gev-10q`). Revenue growth of 16% is recorded in `weekly_metrics.csv`. Open question unchanged: what portion of data-centre orders is repeatable, and what margins are embedded in the backlog.

**Vertiv (watchlist).** Q1 sales rose 30% and full-year organic growth guidance was raised to 29%–31% (`src-2026-w29-vrt-q1`); operating margin of 16.6% is recorded in `weekly_metrics.csv`. The 10-Q identifies cancellation, fixed-price, capacity and customer-spending risks (`src-2026-w29-vrt-10q`). The durability of book-to-bill after customer build plans normalise remains untested.

**Credo (researching).** FY2026 revenue was $1.335B on 205.7% growth with $1.4B net cash (`weekly_metrics.csv`); Q4 revenue grew 157% year over year at a 68.2% GAAP gross margin (`src-2026-w29-crdo-results`). The 10-K records two customers at 49% and 32% of FY2026 revenue and share-based compensation of $182.6M (`src-2026-w29-crdo-10k`). Concentration of 81% is the reason thesis confidence is `low` despite the highest growth-economics score in the set (14/15).

**Rocket Lab (researching).** Q1 revenue was $200.3M with backlog above $2.2B (`src-2026-w29-rklb-q1`) and 63.5% growth, 38.2% gross margin and $1.333B net cash in `weekly_metrics.csv`. The 10-Q records a $45.0M Q1 net loss, $50.3M operating cash outflow and $445.6M of ATM proceeds (`src-2026-w29-rklb-10q`). The 8-K records the Iridium acquisition for cash and stock with a $3.6B bridge commitment (`src-2026-w29-rklb-iridium`), and the release records 2.55M subscribers, L-band spectrum and an existing service network (`src-2026-w29-rklb-iridium-release`). The underwriting question is per-share, not thematic, and cannot be answered before the S-4 appears.

**MP Materials (researching).** NdPr production rose 63%, sales volume 117%, and magnetics revenue reached $21.1M (`src-2026-w29-mp-q1`), with 49% revenue growth and $1.738B net cash (`weekly_metrics.csv`). The 10-Q records $42.3M of price-protection income under the $110/kg government price floor, alongside a net loss (`src-2026-w29-mp-10q`). MP holds the only valuation-asymmetry score above 1 in the set (4/10) and the smallest market cap; it is also the name where the store most clearly shows earnings that are policy-derived rather than market-derived.

## Data gaps

Listed rather than worked around:

1. **No 2026-W30 data of any kind.** No price, market-cap, score or source row has an `as_of_date` after 2026-07-18. Any statement about this week's prices, moves or news would be fabricated.
2. **Q2 2026 results are absent.** Every `next_checkpoint` in `scores.csv` points to Q2 or fiscal-Q1-2027 disclosure; none is in `sources.csv`.
3. **Incomplete fundamentals.** `weekly_metrics.csv` has no `enterprise_value` for any asset; no `revenue_ttm` for GEV, VRT, RKLB or MP; no gross margin for GEV, VRT, CRDO or MP; no operating margin for GEV, CRDO, RKLB or MP; and no free-cash-flow margin for any asset. Credo's $464M FY2026 operating cash flow appears only in a thesis-update narrative field, not as a metric row.
4. **No valuation multiples.** The `valuation_metric` field is `market_cap_usd` for all five, so no earnings, cash-flow or sales multiple exists in the store. The valuation-asymmetry scores of 1 cannot be reconstructed from the data provided — they rest on judgement recorded elsewhere.
5. **No share counts or dilution data.** RKLB's Iridium consideration mix, share count and pro-forma leverage are not in the store, so the central RKLB question is unanswerable from present data.
6. **No scenario table.** There is no five-scenario data (failure / bear / base / bull / generational) for any candidate, and no plausible downside or upside range field, despite the scoring framework requiring them.
7. **Kill criteria are recorded as `not_tested` but not defined.** `thesis_updates.csv` gives a status but the store contains no written kill-criterion text to test against.
8. **All prices and market caps are third-party, medium-reliability snapshots** (`src-2026-w29-*-market`), dated 2026-07-16 or 2026-07-17, and `data_quality` in `weekly_metrics.csv` flags the mixed provenance on every row.

## Action posture

**No action.**

No candidate is near decision review. Four of five carry a valuation-asymmetry score of 1/10, two carry `low` thesis confidence, and — decisively — no evidence at all was added this week, so no gate could have been closed. The store also lacks the scenario analysis, per-share dilution data and defined kill criteria that the minimum gate requires; those absences alone rule out decision review regardless of price.

Sub-posture by name, for clarity: GEV and VRT are **waiting for price** in substance, since thesis quality is scored 78 while asymmetry is scored 1. CRDO, RKLB and MP remain **continue research**, with the specific open questions recorded in `scores.csv`.

Research queue for next week is set by the store, not by preference: capture Q2 2026 disclosure for GEV and VRT when filed; obtain the Rocket Lab Form S-4 and permanent financing terms; populate the missing enterprise-value, TTM-revenue and margin fields; and write explicit kill criteria for all five candidates so that the `not_tested` flags become meaningful.

## Safety boundary

Research and decision support only. No trades, promised returns, or personalised financial, tax or legal advice. The human investor retains responsibility for every decision.
