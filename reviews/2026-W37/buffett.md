# Committee Memo — Moat and Owner Earnings Seat
## Issue 2026-W37

**What most needs to change:** the issue treats orders, backlog and revenue growth as the measure of quality for GE Vernova and Vertiv — the two candidates carrying the highest scores (78/78) and the thinnest valuation cushion (1/10) in the whole dashboard — without ever asking the owner-earnings question this seat exists to ask: how much of the guided free cash flow is actually available to an owner after the capital spending required to keep the current earning power, as distinct from the capital spending required to build the *next* 30 GW of turbine capacity or the *next* rack of liquid-cooling share. That distinction is not a nuance here. GEV's own growth basis (`growth_estimates.csv`) describes a company whose output plan runs from 20 GW annualised to 30 GW by 2030 — a capacity buildout, not a mature asset compounding on existing plant. The issue reports the $11.5–12.5B FY26 free-cash-flow guide as if it settles the owner-earnings question. It does not; a business expanding its own factories is, by definition, spending some part of that cash flow on growth rather than maintenance, and the issue never separates the two or flags that it cannot yet do so from disclosed data. The same gap applies to Vertiv, whose Q2 release additionally dropped orders and backlog disclosure — correctly flagged as unresolved — but whose FCF guide is likewise never tested for maintenance-versus-growth composition.

## Standing questions, answered

**How much of this capital expenditure is maintenance and how much is growth, and does the issue distinguish them?** No. Nowhere in the issue — not in Existing Thesis Updates, not in the Research Queue — does this distinction appear for GEV or VRT, the two names for which it matters most. The store contains the raw material to attempt it (backlog build rates, capacity-ramp schedules, FCF guidance) but the issue does not use it. This belongs as a named Research Queue item, not folded silently into "read the 10-Q."

**What specifically stops a well-funded competitor from taking this position in five years?** The issue asserts moat language taken directly from the store ("scarcity-rent-plus-installed-base" for GEV, "share-plus-content-growth" for VRT) but never names who the competitor would be or why they can't act. GEV's real answer — an oligopoly of three heavy-turbine makers (GE Vernova, Siemens Energy, Mitsubishi Heavy Industries) with decades of reliability track record as the actual barrier — is a strong one, but it is not made in the issue at all. Vertiv's answer is weaker and equally unstated: Schneider Electric and Eaton compete directly in power and thermal management, and "content per megawatt is rising" is a demand observation, not a competitive-exclusion argument. `growth_estimates.csv` itself supplies the right sceptical instinct for a sibling name (SPXC: "a lead-time premium is rent collected during a shortage... and it decays as capacity is added") but that same test is never applied to GEV or VRT, where it is arguably more important because both carry the top scores and the lowest valuation asymmetry in the file.

**Is this inside the circle of competence the store has actually built, or the one it would like to have?** Worth stating plainly rather than smuggling in: heavy gas turbines, data-hall thermal engineering, rare-earth metallurgy under a government price floor, and orbital launch economics are technically dense, capital-intensive, cyclical businesses of exactly the kind this method spent decades avoiding. The issue's own MP Materials thread already does the right thing here — flagging the $42.3M price-protection income as something to net out before judging "ex-support economics," which is a genuine owner-earnings instinct correctly applied. That standard should be held consistently, and right now it isn't: it is applied to MP's subsidy income but not to GEV's or VRT's capacity capex.

## What passed

The Cycle Position section's contrast between the IEA's 3.6% global demand narrative and the EIA's 0.9–1.6% US baseline is legitimate second-level thinking and correctly sourced to both cited rows. The Vertiv orders/backlog omission is flagged and correctly labelled "unresolved" rather than papered over. The AI profit-pool benchmark is presented with the correct hedging language throughout — no measurement dressed up as one. No decision review is proposed, and all gates are correctly left `not_assessed`. This is a properly patient issue in a week with genuinely little new evidence, and it says so rather than manufacturing urgency.

## One traceability gap

"Core CPI continues its gradual descent... the lowest since early 2022" (Cycle Position) cannot be checked against anything supplied to this review — the decade range in the regime board gives a 2020 low and a 2022 high but no monthly series, and `macro_history.csv` was excluded from this extract. It may well be correct; it simply isn't verifiable from what I have, and a claim resting on a series I can't see should either cite the specific comparison point or drop the superlative.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "Publishable, but owner-earnings and named-competitor analysis is missing for exactly the two candidates (GEV, VRT) where it matters most.",
  "findings": [
    {
      "severity": "material",
      "section": "Existing Thesis Updates",
      "finding": "GEV's and VRT's FCF guidance is reported as the measure of cash quality without separating maintenance capex from the growth capex required to build GEV's 20→30 GW turbine capacity plan or VRT's liquid-cooling content expansion, despite the store containing the capacity-ramp data needed to attempt the distinction.",
      "fix": "Add an explicit Research Queue item to decompose GEV and VRT guided FCF into maintenance versus growth capital spending using disclosed capacity-ramp and backlog-conversion data, and flag the current FCF figures as unadjusted until that work is done.",
      "evidence": "data/growth_estimates.csv gev row (20 GW→24 GW→30 GW output plan against $11.5-12.5B FY26 FCF guide) and vrt row (FY26 organic guide 30-32% against $2.4-2.6B FCF guide, both cited in the issue without maintenance/growth capex split)."
    },
    {
      "severity": "material",
      "section": "Standing coverage / Existing Thesis Updates",
      "finding": "The moat claims for GEV (\"scarcity-rent-plus-installed-base\") and VRT (\"share-plus-content-growth\") are asserted but no named competitor or competitive-exclusion mechanism is given, despite this being the single largest determinant of whether current backlog pricing is durable rent or a temporary shortage premium that the store itself argues (for SPXC) will decay as capacity is added.",
      "fix": "Name the specific competitors (Siemens Energy, Mitsubishi Heavy Industries for GEV; Schneider Electric, Eaton for VRT) and state explicitly why their capacity additions would or would not erode the current pricing, using the same reasoning the store already applies to SPXC's transformer margin.",
      "evidence": "data/growth_estimates.csv spxc row (\"a lead-time premium is rent collected during a shortage, not a moat, and it decays as capacity is added\") — the identical test is never applied to gev or vrt rows in the same file, nor in the issue."
    },
    {
      "severity": "material",
      "section": "2. Cycle Position",
      "finding": "The claim that core CPI at 2.4% is \"the lowest since early 2022\" cannot be traced in the supplied extract; macro_history.csv (the monthly series) was excluded from this review and the regime board only gives decade high/low, not a month-by-month comparison.",
      "fix": "Verify the superlative against data/macro_history.csv before next publication, or replace it with a comparison the regime board actually supports (e.g., change since a named prior print).",
      "evidence": "Regime board shows Core CPI decade range only (low 1.2% May 2020, high 6.6% Sept 2022); no intervening monthly figures were supplied to check the 'since early 2022' claim."
    },
    {
      "severity": "minor",
      "section": "General / Committee review",
      "finding": "The candidate set (heavy turbines, data-hall thermal engineering, subsidised rare-earth metallurgy, orbital launch) sits well outside a classically-drawn circle of competence, and the issue never states this limitation even though it applies the right instinct inconsistently (netting MP's price-protection income but not GEV/VRT's growth capex).",
      "fix": "Add a standing caveat noting that owner-earnings scrutiny is being applied unevenly across the coverage and should be applied with the same rigor to GEV and VRT as it already is to MP.",
      "evidence": "Existing Thesis Updates, MP paragraph (\"NdPr costs after price protection\" flagged) versus GEV/VRT paragraphs (no equivalent net-of-growth-capex framing)."
    }
  ]
}
```
