# Review — Moat and Owner Earnings Seat, 2026-W40

## Headline

The issue's own argument this week is that a rate increase raises the discount rate on long-duration cash flows and the financing cost of the buildout (§2). That is exactly the moment to ask what owner earnings these backlogs actually convert to and how much of the spending behind them is discretionary — and the issue does not ask it. Every growth-estimate row for GEV and VRT in the store quotes an FCF guide (GEV $11.5–12.5B; VRT adjusted FCF $2.4–2.6B) without ever splitting maintenance from growth capex, and the gate file confirms `economics_resilience` is `not_assessed` for all five candidates. That gap is disclosed honestly in §8 ("all gates are not_assessed"), which is the right discipline — but a week spent entirely on a cost-of-capital shock is the week this seat's standing question should have been pushed into the Research Queue, and it was not. The queue (§9) asks about project-finance terms in the abstract; it never asks what happens to GEV's and VRT's *own* capex and cash conversion if the environment they guided into tightens.

## Standing questions, answered

**Maintenance vs. growth capex — does the issue distinguish them?** No, and more importantly neither does the underlying `growth_estimates.csv` for any of the five active candidates. GEV's note treats FCF guidance as settled fact without asking how much of the $45.5–46.5B revenue plan requires capacity expansion that could be deferred at a higher discount rate, versus the services annuity on the installed base, which is closer to true owner earnings. This is not invented by the drafting model this week — it is a pre-existing hole in the store — but a week built around a financing-cost shock was the correct week to surface it, and the issue did not.

**What stops a well-funded competitor from taking this position in five years?** The store's own `falsifier` language for SPXC transformers is explicit that a lead-time premium "is rent collected during a shortage, not a moat, and it decays as capacity is added." GEV's `economics_type` ("scarcity-rent-plus-installed-base") carries the identical vulnerability — the scarcity-rent half of its backlog is exposed to Siemens Energy, Mitsubishi Power, or new entrant turbine capacity — but no row in the store applies the SPXC logic to GEV, and the issue repeats "backlog is real" (§2) without naming that risk. This is a specific, correctable omission, not a matter of taste.

**Circle of competence — built or aspirational?** The section and theme files bound the mandate explicitly and disclose the gaps (e.g., "Zero in hyperscalers, memory or foundry"). That is the right discipline and not a finding against this issue.

## Other checks

I traced the numeric claims that this week's content actually turns on — stablecoin supply, USDC share, AI profit-pool market caps, GEV/Eaton order figures, hyperscaler capex run-rate — against the underlying CSVs. All of them reconcile exactly (e.g., USDC share 24.471%→23.736%, correctly reported as "24.5% → 23.7%, −0.7pp"; energy-spending aggregate market cap $996,218,465,109 reported as "$996B"). No invented or misstated figure was found in the material this seat is asked to prioritise.

One claim does not reconcile cleanly: §1 and §4 state that the Credo, Marvell, Broadcom and Ciena 10-Qs "landed this week." The cited filing dates in `sources.csv` are 2026-09-02 (CRDO), 2026-08-28 (MRVL), 2026-09-10 (AVGO) and 2026-09-03 (CIEN) — three to five weeks before the 2026-10-03 cutoff. The correct description is a backlog of unread filings, not a fresh arrival. This matters beyond style: it reframes a process failure (material evidence sitting unread for a month, including customer-concentration and capex detail directly relevant to CRDO's owner-earnings picture) as a timing coincidence, which understates the problem.

## What I would change

1. Correct the "landed this week" framing in §1 and §4 to state plainly that these filings have been queued unread for several weeks, and treat the growing backlog itself as a tracked risk rather than restating "not yet reviewed" without a date comparison.
2. Add two items to the Research Queue: (a) once the backlogged 10-Qs are read, extract and track maintenance-vs-growth capex for GEV and VRT specifically — the store has never built this split; (b) assess whether turbine and grid-equipment competitors could add capacity fast enough to compete away the scarcity rent the cycle-position section treats as durable, applying the same logic the store already uses for SPXC transformers.
3. Verify the "holding at 3.63% since mid-2026" fed-funds claim in §1/§2 against `macro_history.csv` (excluded from this extract) — the regime board's "+0.1 on the month" implies an August reading nearer 3.65%, which is not quite the same claim.

No blocking defect: no fabricated figure, no UNVERIFIED row used as evidence, no benchmark presented as measurement, no decision review proposed with an open gate, and the posture ("No action, continue research") matches the Patience and Conviction Policy.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "No invented figures or gate violations, but the issue mischaracterises weeks-old filings as having 'landed this week' and misses the obvious moat/owner-earnings queue items a rate-rise week calls for.",
  "findings": [
    {
      "severity": "material",
      "section": "1. Executive Summary / 4. Signal Scanner",
      "finding": "The issue states the Credo, Marvell, Broadcom and Ciena 10-Qs 'landed this week,' but the cited source rows show filing dates of 2026-09-02, 2026-08-28, 2026-09-10 and 2026-09-03 respectively — three to five weeks before the 2026-10-03 cutoff.",
      "fix": "Rephrase to describe a multi-week backlog of unread filings rather than fresh weekly arrivals, and flag the growing backlog itself as a process risk.",
      "evidence": "src-edgar-crdo-000162828026060111 (filed 2026-09-02), src-edgar-mrvl-000183563226000025 (filed 2026-08-28), src-edgar-avgo-000173016826000080 (filed 2026-09-10), src-edgar-cien-000162828026060361 (filed 2026-09-03)"
    },
    {
      "severity": "material",
      "section": "9. Research Queue",
      "finding": "A week built entirely around a financing-cost shock to long-duration capital spending never asks how much of GEV's and VRT's guided free cash flow is maintenance versus growth capex, and never applies the store's own SPXC lead-time/scarcity-rent falsifier logic to GEV's gas-turbine backlog.",
      "fix": "Add explicit queue items: (a) split GEV/VRT FCF guidance into maintenance and growth capex once the backlogged 10-Qs are read; (b) assess competitor capacity response (Siemens Energy, Mitsubishi Power, transformer OEMs) to GEV's scarcity rent using the same logic already applied to SPXC.",
      "evidence": "data/growth_estimates.csv rows for gev and vrt (FCF guidance with no capex split); spxc row's falsifier language ('a lead-time premium is rent collected during a shortage, not a moat, and it decays as capacity is added') not applied to gev"
    },
    {
      "severity": "minor",
      "section": "1. Executive Summary",
      "finding": "The claim that the fed funds rate 'held at 3.63% since mid-2026' before September has no cited August data point in the available extract; the regime board's +0.1 monthly change implies a prior reading closer to 3.65%.",
      "fix": "Verify the August FEDFUNDS reading against macro_history.csv before asserting the plateau, or caveat the claim as an inference from the rounded monthly change.",
      "evidence": "macro_history.csv (excluded from this extract); regime board row 'Fed funds 3.75% +0.1 on the month'"
    }
  ]
}
```
