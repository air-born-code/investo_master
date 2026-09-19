# Committee Memo — Debt and Liquidity Machine Seat
## Issue 2026-W38, reviewed 2026-09-19

## Headline finding

The Cycle Position section names the mechanism my seat exists to test, then does not apply it. The Fed funds transmission text — authored once, reproduced correctly in the regime board — states plainly: *"generation, grid and data-centre capacity is project-financed, so the policy rate is an input cost to the buildout itself, not only a valuation multiplier."* That sentence is the whole thesis of this seat. The narrative that follows it pivots straight into a Soros reflexivity discussion of belief and external funding at the model layer, and never returns to ask the question the transmission text itself raised: on what terms is the physical buildout financed, and what happens to the committed backlog if the cost of that financing rises two points?

This is not a hypothetical gap. The store already contains the evidence needed to ask it and does not draw the line. `growth_estimates.csv` records, for GEV, that 63 of its 116 GW of gas-turbine commitments are "slot reservation agreements" rather than firm backlog, and states explicitly: *"their conversion rate under a capex slowdown has never been observed."* A slot reservation is a customer's forward commitment to build a plant it has not yet fully financed. Whether that reservation survives depends on whether the customer — a hyperscaler, a merchant generator, a data-centre developer — can still fund the project at the prevailing cost of capital. The issue discusses "over-ordering" as a possibility in the Cycle Position section but frames it purely as a demand question ("the ultimate compute customer doesn't materialise"), never as a financing question (the ultimate compute customer's cost of debt rises and the project no longer clears its hurdle rate). Those are different failure modes with different observable precursors, and only the demand-side one is examined.

The same omission recurs at VRT: the FY26 guide of 30-32% organic growth is explicitly tied in `growth_estimates.csv` to hyperscaler capex growth of 77% in one year, a rate the note itself says "cannot repeat." The issue's Radar section repeats the concern about missing orders/backlog disclosure but does not ask the prior question — how much of that capex is funded from operating cash flow versus debt issuance, and what a repricing of that debt does to the order pipeline feeding Vertiv. The store has no primary evidence on hyperscaler financing structure (debt vs. equity vs. operating cash flow) for the AI buildout at all — this is itself worth naming as a gap, not filling with inference.

## Applying the seat's standing questions directly

- **Who is borrowing to fund the spending this theme depends on, and on what terms?** Not answered. The issue names external funding at the model layer (17.3¢, from the frozen iCapital benchmark) but that is spending *into* foundation models, not the financing structure of the physical buildout — turbines, transformers, data centres — which is the layer this store is most heavily positioned in (19 names in energy spending, 16 in equipment). Nobody in the store has yet asked whether GE Vernova's customers, or Vertiv's, are funding their orders with balance-sheet cash, project debt, or something more fragile.
- **Does the macro section read levels without asking where the money comes from?** Partially. The regime board's authored transmission text does ask it, correctly, in one sentence. The narrative section built on top of it does not carry the question through into anything examinable — no comparison to credit spreads, no mention of project-finance terms, no connection to the slot-reservation conversion risk already sitting in the store.
- **What happens to this chain if the cost of that credit rises two points?** Absent entirely. No scenario, no order of magnitude, not even a placeholder in the Research Queue. Given that Fed funds has been flat at 3.63% for four months and the issue itself notes the market is pricing a "higher for longer" plateau rather than cuts, this is the natural moment to ask it, and the issue does not.

## Secondary observation

The Cycle Position section treats the July→August payroll swing (−23k to +162k) as evidence that "the prior month was noise rather than a trend break." The macro series' own authored caveat for payrolls states one print is "close to meaningless" and that three-month averages carry the information. Using exactly one comparison print to draw a directional conclusion sits close to violating that caveat's spirit, even with the softening word "suggesting." Minor, not blocking, but worth tightening.

## What I would change before sending

1. In Cycle Position, follow the Fed funds transmission sentence through to its conclusion: name what is known about how the AI physical buildout is financed (or state plainly that the store has no primary evidence on it), and add a two-point-higher scenario applied to the one place the store already flags financing fragility — GE Vernova's 63 GW of slot reservations.
2. Add a Research Queue item: identify hyperscaler and merchant-generator capex financing mix (debt issuance, project finance, operating cash flow) and the interest-rate sensitivity of committed data-centre and turbine orders. This is a natural companion to the existing "reflexivity indicator" queue item and should sit beside it, not be left out.
3. Soften or support the single-print payroll interpretation with an explicit acknowledgment of the revision caveat already authored in the store.

None of this is a fabricated or contradicted figure — every number I checked (Fed funds 3.63%, CPI 3.4%/2.4%, unemployment 4.1%, payrolls +162k, GEV backlog $176B, GEV market cap $284.27B) traces correctly to the cited rows. The defect is a missing analytical step, not a wrong fact, which is why this is material rather than blocking.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "The issue names project-financing as the mechanism that matters for AI capex but never asks who is borrowing, on what terms, or what a two-point rate move does to committed backlog.",
  "findings": [
    {
      "severity": "material",
      "section": "Cycle Position",
      "finding": "The Fed funds transmission text states the AI buildout is project-financed and that the policy rate is an input cost to it, but the narrative that follows pivots to Soros-style reflexivity about model-layer funding and never examines the financing terms or interest-rate sensitivity of the physical buildout itself, despite the store already containing a specific, named conversion-risk note (GE Vernova's 63 GW of slot reservations) that is exactly this question.",
      "fix": "Add a paragraph connecting the Fed funds transmission mechanism to the GEV slot-reservation conversion risk and to Vertiv's capex-dependent growth guide, and state explicitly what is and is not known in the store about how hyperscaler and merchant-generator capex is financed.",
      "evidence": "data/growth_estimates.csv, gev row: '63 GW of slot reservation agreements... their conversion rate under a capex slowdown has never been observed'; data/macro_series.csv, FEDFUNDS equity_transmission: 'generation, grid and data-centre capacity is project-financed, so the policy rate is an input cost to the buildout itself'"
    },
    {
      "severity": "minor",
      "section": "Cycle Position",
      "finding": "The July-to-August payroll rebound (-23k to +162k) is used to conclude the prior month 'was noise rather than a trend break,' which leans on a single comparison against the series' own authored caveat that one print is close to meaningless and three-month averages carry the information.",
      "fix": "Either drop the directional conclusion or explicitly caveat it as provisional pending the three-month average, per the transmission text's own instruction.",
      "evidence": "data/macro_series.csv, PAYEMS caveat: 'Heavily revised... A single month is close to meaningless... Three-month averages carry information; one print does not.'"
    }
  ]
}
```
