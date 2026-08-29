# Committee Memo — Moat and Owner Earnings Seat
## Issue 2026-W35-005

## The one thing to fix

Both surviving theses that moved this week — GEV and VRT — are written up using orders, backlog, revenue and *adjusted* margin. Neither Existing Thesis Update mentions the owner-earnings number that the store already has on file. GE Vernova's own Q2 release (src-2026-w32-gev-q2, captured verbatim in `growth_estimates.csv`) guides to **FY26 free cash flow of $11.5–12.5B**; Vertiv's guides to **adjusted FCF of $2.4–2.6B**. The issue's GEV update reads "$24.2B orders... 116 GW backlog... describe an industrial business sold out through the end of the decade" and calls this a material strengthening of the thesis without once asking what that backlog costs to fulfil or what it converts to in cash after the capital the fulfilment requires. The VRT update does the same with "410bp margin expansion" — an *adjusted* operating margin, which is a reported-earnings concept, not an owner-earnings one. Orders and backlog measure demand; they do not measure what the business will earn for its owner after the spending required to build the capacity that demand calls for. The store holds the figure that would answer that question and the drafted issue did not use it. Fix: add the FCF/free-cash-flow guide to both Existing Thesis Update entries and state explicitly what share of the reported growth this owner-earnings figure confirms or fails to confirm.

## Standing questions, answered

**Maintenance vs. growth capex — not distinguished, anywhere it matters.** Across all sixteen `equipment-profit` names and the three `merchant-generation` names carrying capex-heavy theses, `growth_estimates.csv` never separates sustaining spend from expansion spend. The one row in the whole store that does this cleanly (USAR/Round Top: "$1,300M startup capex... annual sustaining capex of $30M") is for a pre-revenue mining project, not for GEV, VRT, ETN, or CEG's "$3.9B of capital spending planned" for nuclear uprates — the last of which is described as growth capex without saying so. A thesis built on "the backlog compounds with every GW installed" needs to know how much of the GW-installation cost is optional expansion the company chooses to make versus the capex floor required just to hold current output. The issue does not ask this question of any candidate this week, and it should have, since GEV is the week's most-strengthened thesis.

**What stops a well-funded competitor in five years — asked of one name, not applied consistently.** The store itself supplies the sceptical version of this question for SPXC: "a lead-time premium is rent collected during a shortage, not a moat, and it decays as capacity is added." GEV and VRT are tagged with functionally identical economics types — `scarcity-rent-plus-installed-base` and `share-plus-content-growth` — yet neither the Structural Change Radar nor the Existing Thesis Updates apply that same test to them. Siemens Energy and Mitsubishi Power are the obvious gas-turbine capacity competitors and are not named anywhere in this issue; Schneider Electric and ABB are the obvious data-centre power/thermal competitors to Vertiv and are likewise absent. This may simply be a gap in what the store has evidenced rather than a wrong conclusion, so it is not blocking — but an issue that calls GEV's Q2 evidence "overwhelming" without asking who else is adding gas-turbine slots has not tested the moat, only the demand.

**Circle of competence — built, not aspirational, for the equipment layer; still aspirational for the ASIC/interconnect layer.** GEV, VRT, ETN and the merchant-generation names sit inside a genuinely built competence: industrial equipment with disclosed backlogs, book-to-bill, and margin trends that the store reads primary filings for and cross-checks (the Vertiv orders omission being exhibit A of that discipline working correctly). CRDO sits further out — `thesis_confidence: low`, two-customer concentration unresolved for two consecutive issues, and the store is honest about this. That labelling is correct and I have no finding against it; flagging it here only to confirm the self-assessment held up under this seat's test.

## What this issue got right

The Vertiv finding is exactly what this seat should want to see: a company posting strong reported numbers while quietly discontinuing the one disclosure (orders/backlog) that let a reader tell recurring demand from a delivery-schedule flush, and the issue caught it, named it as a negative signal, and downgraded monitoring confidence rather than the thesis itself. That is the correct distinction and it is drawn correctly. The Decision Dashboard is also clean — all five candidates correctly sit on `not_assessed` gates with no forced move, consistent with the Patience Policy, and the issue does not manufacture a decision review to justify the week's effort.

## Assessment

No fabricated figures, no UNVERIFIED rows used as evidence, no benchmark presented as measurement, no decision review proposed with an open gate. The defect is a pattern of omission — the analysis stops at demand and reported-margin evidence when the store already holds the owner-earnings figures one layer down, and applies a scepticism test to one small name that it withholds from the two large names most in need of it. Publishable with fixes to the two Existing Thesis Update paragraphs named above.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "GEV and VRT thesis updates lean on orders/backlog/adjusted-margin and omit the FCF guides already in the store; capex maintenance-vs-growth and competitor capacity are untested.",
  "findings": [
    {
      "severity": "material",
      "section": "Existing Thesis Updates",
      "finding": "The GEV update ('Orders of $24.2B... describe an industrial business sold out through the end of the decade... materially strengthens the thesis') and the VRT update ('excellent operating results... 410bp margin expansion') both argue thesis strength from demand and reported/adjusted-margin metrics without citing either company's own FCF guidance, which is owner earnings, not reported earnings, and is already in the store.",
      "fix": "Add GEV's guided FY26 FCF of $11.5-12.5B and VRT's guided adjusted FCF of $2.4-2.6B to their respective thesis-update paragraphs, and state whether the owner-earnings trajectory confirms or lags the demand story.",
      "evidence": "data/growth_estimates.csv rows for gev and vrt, sourced to src-2026-w32-gev-q2 and (implicitly) src-2026-w32-vrt-q2, both citing FY26 free-cash-flow/adjusted-FCF guidance not repeated in the report's section 4 text."
    },
    {
      "severity": "material",
      "section": "Structural Change Radar / Age of Electricity",
      "finding": "No tracked equipment or generation name in the store separates maintenance capex from growth capex, despite every thesis in this section resting on capacity expansion (GEV's gas-turbine build-out, CEG's $3.9B uprate spend, ETN's backlog-funded capacity additions). The one clean example of the split (USAR/Round Top sustaining capex) is for an unrelated pre-revenue project.",
      "fix": "Add a capex-composition line (sustaining vs. expansion) to growth_estimates.csv for GEV, VRT, ETN and CEG as primary filings disclose it, and note the gap explicitly in the Research Queue until it is filled.",
      "evidence": "data/growth_estimates.csv — no maintenance/growth capex split present for gev, vrt, etn, ceg, vst, tln rows; the only sustaining-capex figure in the file is for usar."
    },
    {
      "severity": "material",
      "section": "Structural Change Radar / Age of Electricity",
      "finding": "The store's own growth_estimates.csv applies a scarcity-is-not-a-moat scepticism to SPXC ('a lead-time premium is rent collected during a shortage, not a moat, and it decays as capacity is added') but the report does not apply the equivalent test to GEV or VRT, whose economics are tagged with materially similar language ('scarcity-rent-plus-installed-base', 'share-plus-content-growth'), and names no competitor (Siemens Energy, Mitsubishi Power, Schneider Electric, ABB) anywhere in the issue.",
      "fix": "Either name why GEV/VRT's position is more durable than SPXC's lead-time premium, with evidence, or apply the same falsifier language to them and add competitor capacity plans to the Research Queue.",
      "evidence": "data/growth_estimates.csv spxc row ('cyclical-scarcity-rent... decays as capacity is added') versus gev and vrt rows, and the absence of Siemens Energy/Mitsubishi Power/Schneider Electric/ABB from the report text."
    }
  ]
}
```
