# Forensic Short — Review of 2026-W40 Issue

## Lead finding: a specific, checkable number is wrong

Section 3b states USDC share is "down from 24.5% in W33 (−0.7pp)" and total stablecoin supply is "+1.4% from W33." Neither comparison matches the W33 row in `agent_traffic.csv`. The stored W33 reading for `stablecoin-usdc-share` is **23.399%**, not 24.5% — a discrepancy of more than a full point, in the wrong direction for the trend being described (the actual W33→W40 move is 23.399%→23.736%, i.e. *up*, not down). The stored W33 total-supply figure is $307.8B, not the $308.4B implicitly used to produce "+1.4%"; the arithmetic against the real W33 figure gives +1.6%. Both errors trace to the same root cause: each week's row carries a `value_prior_week` field that does not equal the prior week's own recorded `value` — almost certainly because DefiLlama restates historical balances between fetches, or because intervening weekly snapshots are missing from the file and the comparison silently floats to whatever was last fetched. Either explanation is fine to publish; citing it as "W33" when the W33 row says something else is not. This is a small section by weight, but it is exactly the kind of number a reader will check, and it will not reconcile.

**Fix:** either pull the comparison from the actual `week_id = 2026-W33` rows and correct the two figures and the trend direction, or drop the week label and write "prior reading" with a note that the aggregator revises history.

## Method-specific gaps

**Double-ordering risk is in the store and absent from the narrative.** Section 2 treats "the equipment backlog (GE Vernova $176B, Eaton's orders +41%)" as unambiguously real evidence of demand. `growth_estimates.csv` already carries the disconfirming question for both names: GEV's falsifier is "slot reservations cancelling or expiring rather than converting to orders," and Eaton's key uncertainty is explicitly "how much of a 41% order rate is genuine new load versus customers ordering early to hold a delivery slot. Double-ordering is invisible until it unwinds." This is the seat's second standing question in substance — a growth figure that would shrink under a less generous reading of what an "order" represents — and the store has already done the work of stating it. The issue's own macro argument (rates rising, discount rates up) is the natural trigger for exactly this unwind, and the section doesn't connect the two. This should have been raised, not merely left in a CSV cell.

**Circular financing in the AI chain is named but not interrogated.** The store's own `external-funding` layer note calls the model layer's −17.3¢ "subsidy entering the chain" and flags that a contraction there "propagates downward through reduced orders." That is the setup for the seat's first standing question — does anyone downstream book revenue from a party it (or its ecosystem) also funds — and the issue restates the 29.7¢/3.8¢ concentration point for a second week without ever asking it. Given that commercial-chips and custom-ASIC vendors increasingly take equity or prepayment stakes in the compute buyers ordering from them, this is the single most relevant unanswered question for a seat reading this chain, and it isn't in the Research Queue either.

**Depreciation is never raised.** Despite two sections (§2, §3a) built around the capex acceleration and its interaction with a rising discount rate, nothing in the issue or the visible store asks whether useful-life assumptions on servers or data-centre equipment have moved while spending did — the standard lever for flattering reported margins during a capex supercycle. This may simply be unresearched rather than wrong, but a week that leans this heavily on "the buildout is real, the question is financing cost" should name the accounting question alongside the financing one.

## What the issue did well

The restraint is real and should be recorded as such: every unreviewed 10-Q is labelled "contents not yet reviewed" rather than inferred from headlines; the iCapital benchmark is repeatedly called a frozen, unaudited estimate rather than a measurement; no decision-review gate is claimed complete; MP's dashboard reason explicitly names "price-floor reliance" as the dependency it is. Nothing in the issue invents a figure or launders an UNVERIFIED row as evidence. This is the correct posture for a week with no new primary evidence, and the forensic-short seat has no complaint about the absence of signal — only about the two places where existing store evidence relevant to this method sat unused.

```json
{
  "verdict": "hold",
  "summary": "Stablecoin W33 comparisons contradict the stored W33 row; store's own double-ordering and circular-financing flags for GEV/Eaton/AI chain went unused.",
  "findings": [
    {
      "severity": "blocking",
      "section": "3b. Digital-asset rails",
      "finding": "The sentence 'USDC share: 23.7%, down from 24.5% in W33 (−0.7pp)' and 'Total USD-pegged supply: $312.8B, +1.4% from W33' are both contradicted by the actual 2026-W33 rows in agent_traffic.csv, which record USDC share at 23.399% (not 24.5%, and the real move is upward not downward) and total supply at $307.8B (giving +1.6%, not +1.4%).",
      "fix": "Recompute both figures against the week_id=2026-W33 rows in agent_traffic.csv, or relabel the comparison as 'prior reading' rather than naming W33, and note that the aggregator restates history between fetches.",
      "evidence": "data/agent_traffic.csv: week_id=2026-W33 rows for stablecoin-usdc-share (value=23.399) and stablecoin-supply-total (value=307805242018), versus the value_prior_week fields in the 2026-W40 rows (24.471 and 308401015238) used to produce the issue's comparisons."
    },
    {
      "severity": "material",
      "section": "2. Cycle Position",
      "finding": "GE Vernova's $176B backlog and Eaton's +41% orders are presented as straightforwardly real demand evidence. The store's own growth_estimates.csv records the disconfirming case for both — GEV's falsifier names slot-reservation cancellation risk, and Eaton's key uncertainty names order front-running ('double-ordering is invisible until it unwinds') — and neither is mentioned even though the section's own thesis (rising discount rates, tightening financing) is the natural trigger for exactly that unwind.",
      "fix": "Connect the rate-rise argument in §2 to the store's documented backlog-quality risk for GEV and Eaton rather than treating backlog growth as settled evidence.",
      "evidence": "data/growth_estimates.csv rows for gev (falsifier: 'Slot reservations cancelling or expiring rather than converting to orders') and etn (key_uncertainty: 'Double-ordering is invisible until it unwinds')."
    },
    {
      "severity": "material",
      "section": "3a. Artificial Intelligence",
      "finding": "The AI profit-pool discussion restates layer concentration for a second week but never asks whether revenue at the layers we do track is financed circularly — i.e. whether a vendor's customer demand is itself funded by that vendor or its ecosystem — despite the store's own external-funding layer note flagging that -17.3c of 'subsidy enters the chain' and that a contraction there 'propagates downward through reduced orders.'",
      "fix": "Add an explicit question to the Research Queue: for the commercial-chips and custom-ASIC names tracked, does any disclosed customer concentration overlap with a disclosed investment, prepayment or financing relationship from the same vendor.",
      "evidence": "data/ai_value_chain.csv, external-funding row: 'Not investable. Tracked because it is the chain's least durable input... If funding tightens the chain contracts from the order-placing layer downward, not evenly.'"
    },
    {
      "severity": "minor",
      "section": "9. Research Queue",
      "finding": "No item asks whether depreciation schedules, useful lives or capitalisation policies have shifted at any tracked compute/equipment name during the capex acceleration — a standing question for this seat with direct relevance to a week built around capex and discount-rate commentary.",
      "fix": "Add a queue item to check useful-life and capitalisation disclosures once the unreviewed 10-Qs (SMCI 10-K, CRDO/MRVL/AVGO/CIEN 10-Qs) are read.",
      "evidence": "No row in the provided store addresses depreciation or useful-life policy for any tracked name; absence confirmed against the full data extract supplied."
    }
  ]
}
```
