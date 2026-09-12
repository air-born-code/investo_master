# Forensic Short Review — Issue 2026-W37

## Lead finding

The single thing most worth fixing: **the issue narrates a rapid AI-capex order boom (GE Vernova +88% organic orders, Eaton +41% rolling orders, backlog growing 2–3× revenue) without ever asking whether that order flow is cash-paying demand or reservation/financing echo.** The store already contains the evidence needed to ask the question — it just isn't asked in the issue text.

`data/ai_value_chain.csv` names "External funding" as a distinct layer: *"17.3 cents of investor capital entering alongside every $1.00 of customer spend, because the model layer loses money… roughly 15% of all flow is funding rather than revenue… If funding tightens the chain contracts from the order-placing layer downward, not evenly."* That is close to a textbook statement of this seat's first standing question — who is financing the customer, and is revenue being booked from a party the chain also funds. The issue's §3a treatment of this layer is purely descriptive ("No new data on AI funding rounds… the Q1 run-rate annualised at $519bn versus the $725bn full-year target implies a significant ramp in H2, which we will watch") and never connects it to the order books it reports elsewhere in the same issue.

That connection matters because the store's own `growth_estimates.csv` has already flagged the mechanism at the single-name level and the issue drops it on the floor:
- GEV: *"The reservations are the softer half and their conversion rate under a capex slowdown has never been observed."* Falsifier: *"Slot reservations cancelling or expiring rather than converting to orders."*
- ETN: *"How much of a 41% order rate is genuine new load versus customers ordering early to hold a delivery slot. Double-ordering is invisible until it unwinds."*

§6 (Existing Thesis Updates) restates only the bullish half of the GEV entry ("orders and backlog figures remain extremely strong") and drops the falsifier language verbatim available in the store. This is precisely the seat's blind spot cutting the other way — not manufactured bearishness, but a real, store-documented order/revenue divergence (order growth running at multiples of organic revenue growth across the equipment layer) that the method exists to surface, and the issue doesn't carry it forward even though the evidence is sitting one file away. This should be a standing question attached to every AI-physical-infrastructure candidate, not just a line inside one theme note.

I did not find evidence in the store of circular revenue between a named supplier and its own investee (e.g., a chipmaker-funded customer booking revenue back to the chipmaker) — none of the tracked names' sourced filings describe such an arrangement, so I am not raising that as a finding here. The gap is the absence of the question, not a discovered instance of the pattern.

## Other findings

**Depreciation / useful-life / capitalisation policy changes.** None of the read filings in this issue disclose a change, and the issue is honest that it hasn't read the filings that would show one ("Signal Scanner… effectively inactive until these reports are read"). That is the correct answer under the patience policy — no fabricated conclusion — so I have nothing to raise against it. It should stay the top Research Queue item, and it is.

**Growth figures that would disappear under a consistent policy.** GEV and VRT both disclose headline vs. organic growth (GEV 22%/12%, VRT 24%/18%), which is the right basis for comparison and is used correctly in `growth_estimates.csv`. I checked this specifically because it's the seat's third standing question and found no inconsistency worth flagging — the store is already doing the work here, even if the issue text doesn't surface it.

**Section 3a restates rather than interprets.** The brief for §3a explicitly asks whether profit is moving down the stack toward physical layers, and says a single observation is not a trend. The issue's §3a paragraph reproduces the static count ("52 names… 29.7 cents…") already rendered by the pipeline board and never attempts the trend question at all, this week or against any prior week. That's not this seat's core competency, but it is a completeness gap worth naming.

**Minor: stablecoin comparison window.** The issue states total stablecoin supply "up about 1.4% in four weeks" (comparing W37 to W33, roughly correct at ~1.3%) immediately followed by "payment-oriented chains… fell 0.3%," which is actually the one-week change (W37 vs. its unlabelled prior week), not the four-week change. Different windows are being compared in adjacent clauses without saying so.

## What I checked and found sound

Every macro figure quoted (payrolls +162k, core CPI 2.4%, unemployment 4.1%) traces cleanly to the W37 FRED source rows. The five scored candidates' market caps, scores, and valuation-asymmetry figures match `scores.csv` and the dated W29 market-data sources exactly, and are correctly labelled as a W29 snapshot rather than presented as current. No gate table shows a Decision Review candidate; all thirteen gates for all five names are `not_assessed`, consistent with the Dashboard. No UNVERIFIED row from `agent_traffic.csv` is used as evidence rather than as an attributed claim.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "No contradicted figures or gate violations, but the issue drops store-documented order/revenue divergence and funding-layer risk it should carry into GEV/ETN theses.",
  "findings": [
    {
      "severity": "material",
      "section": "Existing Thesis Updates",
      "finding": "GEV's update restates only that 'orders and backlog figures remain extremely strong' and omits the store's own falsifier language on slot-reservation conversion risk and order/revenue divergence (orders +88% organic vs. revenue +12% organic), which is exactly the financing-of-demand question this seat exists to raise and is already written in growth_estimates.csv.",
      "fix": "Carry forward the falsifier text from data/growth_estimates.csv (slot-reservation conversion, double-ordering risk) into the GEV and ETN-type thesis updates whenever orders growth materially outpaces organic revenue growth, and connect it explicitly to the External Funding layer note in ai_value_chain.csv.",
      "evidence": "data/growth_estimates.csv rows gev and etn (falsifier and key_uncertainty columns); ai_value_chain.csv external-funding row"
    },
    {
      "severity": "minor",
      "section": "Structural Change Radar",
      "finding": "Section 3a restates the static layer counts already rendered by the pipeline board (52 names, 29.7 cents) instead of addressing the section's stated purpose — whether profit is migrating down the stack — leaving that question untouched for a second consecutive issue.",
      "fix": "Either state explicitly that there is no new evidence on stack migration this week, or drop the restated figures and replace with an interpretive sentence per the section brief.",
      "evidence": "data/ai_profit_pool.csv W33 vs W37 rows are identical, so no movement exists to report; the issue text nonetheless restates the layer table rather than saying so."
    },
    {
      "severity": "minor",
      "section": "Structural Change Radar",
      "finding": "The digital-assets paragraph gives a four-week change for total stablecoin supply and a one-week change for payment-chain supply in adjacent sentences without labelling the different windows.",
      "fix": "State the comparison window explicitly for each figure.",
      "evidence": "data/agent_traffic.csv stablecoin-supply-total (W33 307,805,242,018 vs W37 311,887,386,137 ≈ +1.3% over four weeks) and stablecoin-supply-payment-chains (W37 118,408,175,080 vs prior-week 118,764,501,138 ≈ -0.3% over one week)"
    }
  ]
}
```
