# Forensic Short Seat — Review of Issue 2026-W38

## Lead finding: the backlog number the issue reports is softer than the backlog number the store has

The Age of Electricity section reports GE Vernova's "176B backlog and a growing services annuity" and treats the destination-analysis question as blocked only by missing segment data. But `data/growth_estimates.csv` already contains the fact this seat exists to surface: the 116 GW of gas turbine capacity "under contract or reservation" splits into **53 GW firm backlog and 63 GW slot reservations**, and the store's own falsifier for that row is explicit — "the reservations are the softer half and their conversion rate under a capex slowdown has never been observed." A slot reservation is not an order. Citing the consolidated $176B figure without that split lets the headline growth number stand in for a number that is, on the store's own evidence, roughly half firm. This is precisely the kind of consistent-accounting-policy question the seat is supposed to ask before it gets asked by a canceled reservation. The Rick Rule permitting discussion in the same section had the room to make this point and didn't.

## Standing question 1 — customer financing and circular revenue: unaddressed, not merely unanswered

The Cycle Position section runs a Soros-framed reflexivity paragraph on the 17.3¢/dollar of external funding entering the AI chain, and asks whether that funding keeps arriving. That is a demand-side question. It never asks the seat's actual question: does any party in this chain book revenue from a counterparty it also financed? Given zero coverage of hyperscaler-cloud and foundation-models — the two layers where that circularity would live — the honest answer this week is "we cannot test this from what we track," and that should be said explicitly rather than folded into a generic funding-tightness worry. Research Queue item 5 ("reflexivity indicator... cloud-provider AI revenue-to-capex ratio") does not operationalize a counterparty-overlap test and should.

## Standing question 2 — depreciation, useful life, capitalisation: absent from the review plan itself

Capex across the chain is visibly accelerating (Amazon's Q2 capex up 23% sequentially per the store; GEV's own output ramp). None of the growth_estimates rows, sources, or this issue's Research Queue mention depreciation schedules, equipment useful lives, or capitalisation policy at any covered name. Item 1 of the Research Queue — the instruction that will govern how the incoming 10-Q backlog actually gets read — asks reviewers to extract "revenue, orders, backlog, margins, cash flow, and forward guidance." It does not ask them to check footnotes for useful-life extensions or capitalised-cost changes. In a capex boom, that is exactly where reported margin quality quietly improves without a matching improvement in the business, and as written this queue item will not catch it even when the filings are finally opened.

## A traceability gap, not an error

Cycle Position states the fed funds rate has been "unchanged for four months." The source rows provided confirm 3.63% in June, July (twice), and August 2026 — three readings, not four. I cannot find a May 2026 reading in the extract, and `macro_history.csv` (which would settle this) was excluded from my review. I am not asserting the claim is wrong; I could not trace it in what I was given.

## What the issue got right

The VRT orders/backlog omission is flagged correctly and attributed to primary evidence (`src-2026-w32-vrt-no-orders`) rather than asserted as fraud — appropriately cautious given this seat's blind spot toward structural bearishness. The AI profit-pool benchmark is consistently labeled as a frozen, unrecomputed estimate rather than a measurement, both in the exhibit language and in how the 17.3¢ and 29.7¢ figures are used. The action posture (no action, gates 0/13 across the board) is not inflated by any of this quarter's demand narrative. No fabricated data points were found; every figure I could check traced to a store row.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "Sound on sourcing and posture, but omits the GEV reservation/backlog split the store itself flags, and the filing-review queue has no instruction to check depreciation or financing circularity.",
  "findings": [
    {
      "severity": "material",
      "section": "3. Structural Change Radar — Artificial Intelligence / Age of Electricity",
      "finding": "The issue cites GE Vernova's $176B backlog without noting that the 116 GW of contracted-or-reserved gas capacity splits into 53 GW firm backlog and 63 GW slot reservations, a split the store itself identifies as the central falsifier-relevant uncertainty.",
      "fix": "State the firm-backlog/slot-reservation split explicitly when citing GEV's order strength, and note that reservation-to-order conversion under a capex slowdown is unobserved.",
      "evidence": "data/growth_estimates.csv, gev row: '53 GW firm backlog plus 63 GW slot reservation agreements. The reservations are the softer half and their conversion rate under a capex slowdown has never been observed.'"
    },
    {
      "severity": "material",
      "section": "Research Queue",
      "finding": "Item 1 instructs filing review to extract 'revenue, orders, backlog, margins, cash flow, and forward guidance' but includes no instruction to check for depreciation useful-life extensions or capitalisation policy changes, despite capex accelerating sharply across the chain (e.g., Amazon Q2 capex +23% sequential per src-2026-w32-amzn-capex-q2).",
      "fix": "Add an explicit Research Queue line requiring reviewers to check 10-K/10-Q footnotes at GEV, VRT and any hyperscaler brought into scope for changes to depreciation schedules, equipment useful lives, or capitalised-cost policy.",
      "evidence": "Research Queue item 1; no row in growth_estimates.csv or sources.csv addresses depreciation or capitalisation policy for any covered name."
    },
    {
      "severity": "material",
      "section": "2. Cycle Position",
      "finding": "The reflexivity discussion of the 17.3¢/dollar external-funding layer asks only whether funding keeps arriving, not whether any chain participant books revenue from a party it also financed — the seat's core diagnostic — and does not state that zero coverage of hyperscaler-cloud and foundation-models makes this untestable from current holdings.",
      "fix": "Add a Research Queue item to track disclosed vendor-financing or equity relationships between AI infrastructure suppliers and major customers as those layers enter scope, rather than relying only on an aggregate funding-to-spend ratio.",
      "evidence": "data/ai_value_chain.csv, external-funding and hyperscaler-cloud rows (0 names tracked); Research Queue item 5 proposes only an aggregate ratio."
    },
    {
      "severity": "material",
      "section": "2. Cycle Position",
      "finding": "The claim that the effective federal funds rate has been 'unchanged for four months' cannot be traced against the source rows provided, which confirm only three monthly readings of 3.63% (June, July, August 2026); macro_history.csv, which would settle it, was excluded from this review.",
      "fix": "Verify the four-month claim against data/macro_history.csv before the next send.",
      "evidence": "src-2026-w30-fred-fedfunds (June), src-2026-w32/w33-fred-fedfunds (July), src-2026-w38-fred-fedfunds (August) — three confirmed readings, not four."
    }
  ]
}
```
