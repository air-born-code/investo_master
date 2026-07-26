# Investo Master — Issue 002: Quiet Week

- Week: 2026-W30
- Report ID: 2026-W30-002
- Evidence cut-off: 2026-07-26T15:18:52.163Z
- Action posture: NO ACTION — RESEARCH CONTINUES

## Regime board (2026-W30)

| Series | Value | Observation |
|---|---|---|
| Effective federal funds rate | 3.63% | 2026-06-01 |
| US headline CPI | 3.5% | 2026-06-01 |
| US core CPI | 2.6% | 2026-06-01 |
| US unemployment rate | 4.2% | 2026-06-01 |
| US nonfarm payrolls, monthly change | +57k | 2026-06-01 |

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

**As of:** 2026-07-26 · **Data cut-off:** macro series observed 2026-06-01, retrieved 2026-07-26 (`src-2026-w30-fred-*`); all asset-level data unchanged since 2026-07-18 (week 2026-W29)

## Summary

Nothing material changed at the company level this week. The research store contains no 2026-W30 price, metric, score, or thesis-update rows for any of the five tracked assets. The only new data is a set of five FRED macro series, and each of them reports the same June 2026 observations already captured last week from the primary agency releases:

| Series | Value | Observation | Source row |
|---|---|---|---|
| Effective federal funds rate | 3.63% | 2026-06-01 | `src-2026-w30-fred-fedfunds` |
| Headline CPI | 3.5% y/y | 2026-06-01 | `src-2026-w30-fred-cpiaucsl` |
| Core CPI | 2.6% y/y | 2026-06-01 | `src-2026-w30-fred-cpilfesl` |
| Unemployment | 4.2% | 2026-06-01 | `src-2026-w30-fred-unrate` |
| Nonfarm payrolls, monthly change | +57,000 | 2026-06-01 | `src-2026-w30-fred-payems` |

The CPI figures match the BLS release cited last week (`src-2026-w29-cpi`), and the payroll and unemployment figures match `src-2026-w29-jobs`. The effective funds rate of 3.63% is consistent with the 3.50%–3.75% target range in the June FOMC statement (`src-2026-w29-fed`). This is a re-pull through a second channel, not new information. Confirmation of a previously recorded fact does not change a thesis.

No kill criterion was tested this week. All five `thesis_updates.csv` rows remain at `kill_criterion_status = not_tested` with `as_of_date = 2026-07-18`.

## Theme notes

No theme row was updated this week: every entry in `themes.csv` carries `last_updated_date = 2026-07-18`. The macro data adds no evidence for or against any of the six themes — note that the five W30 FRED source rows have an empty `theme_id`, so they are not attributed to a theme in the store.

The two high-confidence demand themes, `age-of-electricity` and `ai-physical-infrastructure`, still rest on the same evidence base as last week: the IEA's forecast of 3.6% annual global electricity demand growth through 2030 with data centres driving roughly half of US demand growth (`src-2026-w29-iea-electricity`), and the EIA's identification of data-centre server energy use as an important driver of US demand growth (`src-2026-w29-eia-aeo`). Neither was refreshed.

`critical-minerals-security` likewise rests on the IEA's 2024 concentration figures — 91% of refining and 94% of sintered permanent-magnet production in China (`src-2026-w29-iea-rare-earths`) — and the July 2026 outlook on export controls and diversification (`src-2026-w29-iea-minerals`). `advanced-nuclear-enablers` remains in `monitoring` status with no tracked asset attached in `asset_themes.csv`; the most recent evidence is still the NRC's Part 53 pathway and TerraPower construction approval (`src-2026-w29-nrc`).

## Watchlist notes

Scores, stages, and prices below are all as of 2026-07-18 and are carried forward unchanged. The prices are now eight days stale relative to this issue's date.

| Asset | Stage | Last price (2026-07-18) | Market cap | Total score | Valuation asymmetry (of 10) | Confidence |
|---|---|---|---|---|---|---|
| GEV | watchlist | $1,057.84 | $284.27B | 78 | 1 | medium |
| VRT | watchlist | $289.56 | $112.97B | 78 | 1 | medium |
| CRDO | researching | $206.00 | $38.41B | 73 | 1 | low |
| RKLB | researching | $67.62 | $42.00B | 72 | 1 | low |
| MP | researching | $57.55 | $8.09B | 72 | 4 | medium |

The shape of the problem is unchanged and worth restating once, because it is the reason this week produces no action: four of the five candidates score 1 out of 10 on valuation asymmetry despite total scores of 72–78. High business quality is documented; adequate expected return at the last observed price is not. MP is the only candidate scoring above 1 on asymmetry, and its own baseline update flags that Q1 included $42.3M of price-protection income under a $110/kg government price floor while the company still reported a net loss (`src-2026-w29-mp-10q`, `tu-2026-w29-mp-baseline`).

Every candidate's `next_checkpoint` in `scores.csv` points to Q2 2026 or fiscal Q1 2027 disclosure — GEV segment orders and backlog margin, VRT organic orders and cancellation commentary, CRDO customer mix and share-based compensation, RKLB's Form S-4 and permanent financing plan, MP's 10X construction budget and ex-support economics. The store contains no rows for any of these. That is the binding constraint on progress, and it is a calendar constraint, not an analytical one.

RKLB is the one candidate where the underwriting question changed recently enough to warrant repeating: the Iridium merger agreement, cash-and-stock consideration and $3.6B bridge commitment (`src-2026-w29-rklb-iridium`) against Q1 net loss of $45.0M, operating cash outflow of $50.3M and $445.6M of ATM proceeds (`src-2026-w29-rklb-10q`). No S-4 row exists in the store yet, so the per-share return distribution remains unanswerable.

## Data gaps

- **No 2026-W30 asset-level data.** `weekly_metrics.csv`, `scores.csv`, and `thesis_updates.csv` contain no rows for week 2026-W30. Prices, market caps, and all scores in this issue are 2026-W29 values.
- **Prices are eight days stale** and were third-party snapshots when recorded (`data_quality` field on every W29 metric row; snapshot dates 2026-07-16 and 2026-07-17). No source row supports any price as of 2026-07-26.
- **Macro data is nearly two months old.** All five W30 series observe 2026-06-01. No July observations are available.
- **No Q2 2026 results for any candidate.** Every `next_checkpoint` remains open; no source row post-dates 2026-07-16 except the FRED re-pulls.
- **Incomplete financial fields.** `enterprise_value` is empty for all five assets. Gross margin is present only for RKLB (0.382); operating margin only for VRT (0.166); free-cash-flow margin for none. Revenue TTM is present only for CRDO ($1,335,116,000). No valuation multiple is recorded for any asset — `valuation_metric` is `market_cap_usd` in every row, which is a size measure, not a valuation measure. The asymmetry scores therefore rest on judgement documented in the thesis updates rather than on a computed multiple in the store.
- **W30 macro sources are unmapped**, with empty `asset_id` and `theme_id`, so they cannot be attributed to a theme.
- **No source row for MP's revenue growth** figure of 0.49 in `weekly_metrics.csv`; `src-2026-w29-mp-q1` supports NdPr production +63%, sales volume +117%, and magnetics revenue of $21.1M, which are different measures.

## Action posture

**No action.**

No candidate advanced, no candidate weakened, and no kill criterion was tested. Nothing in the 2026-W30 data set bears on any thesis. Four of five candidates score 1 out of 10 on valuation asymmetry at the last observed prices, which means GEV and VRT in particular are best described as high-quality businesses awaiting a price rather than opportunities awaiting a decision. No row in the store shows evidence, asymmetry, and price aligning, so no decision review is proposed.

The next genuine information arrives with Q2 2026 disclosure. Until then the correct posture is to hold the queue as written in `scores.csv` and refresh prices so the store stops carrying stale snapshots forward.

## Safety boundary

Research and decision support only. No trades, promised returns, or personalised financial, tax or legal advice. The human investor retains responsibility for every decision.
