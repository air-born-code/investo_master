# Moat and Owner Earnings — Review of Issue 2026-W38

## The one thing that most needs to change

Nothing here is wrong enough to hold. The issue is honest about what it doesn't know, correctly omits sections 5–7 rather than manufacture content, and the Decision Dashboard accurately shows 0/13 gates assessed for every candidate — no premature decision review, no forced conclusion. That discipline is exactly what the Patience Policy asks for and I have no blocking finding.

But the issue's own Radar section opens two owner-earnings questions this seat cares about (Rick Rule's permitting/capacity point, Nick Sleep's destination question for GE Vernova) and then closes each one by routing it to the Research Queue in generic form. Neither routing is specific enough to actually get answered next time. That is the fixable gap.

## Standing questions, answered

**How much of this capital expenditure is maintenance and how much is growth, and does the issue distinguish them?**
No. GEV's FY26 free-cash-flow guide ($11.5–12.5B) and VRT's adjusted FCF guide ($2.4–2.6B) are both cited at face value, but both companies are mid-expansion — GEV is lifting gas-turbine output from 20 GW annualised to 30 GW by 2030 (`growth_estimates.csv`, gev row), and VRT is guiding 30–32% organic growth for FY26. Capex during a capacity build is not the same claim on future owner earnings as capex to hold share once the build is done, and the store nowhere separates the two for either name. The issue's Research Queue item 1 asks generically to "extract... cash flow" from the backlog of unread 10-Qs; it does not ask for the maintenance/growth split specifically, so there is a real risk this gets extracted as a single FCF number again next quarter and the question quietly drops.

**What specifically stops a well-funded competitor from taking this position in five years?**
Partially addressed, and by the store rather than by this issue. `growth_estimates.csv` already flags the honest answer for GEV: the current pricing power is "scarcity-rent-plus-installed-base," and the note explicitly warns the long-run rate must fall below the current 22% "because units cannot grow faster than the factories" — i.e., the scarcity is a capacity bottleneck, not a durable moat, and the installed-base service annuity is the only piece that survives once the bottleneck clears. The issue's own radar text restates the factory-floor-space constraint but never asks the obverse question: are Siemens Energy, Mitsubishi Power, or Schneider Electric/Eaton also racing to add capacity behind the same shortage? That is the question that decides whether this is rent or moat, and it is currently missing from the Research Queue entirely.

**Is this inside the circle of competence the store has actually built, or the one it would like to have?**
The store is candid about the limits of its own competence here — `growth_estimates.csv` repeatedly marks rows "Not yet verified from a primary filing in this store" with "low" confidence (NVT, SPXC, BWXT, TT, MOD, EME, MYRG), and the issue does not lean on any of those rows to support a conclusion this week. That is the correct posture. The five scored candidates (GEV, VRT, CRDO, RKLB, MP) all rest on primary or issuer-sourced evidence per `scores.csv`'s evidence_quality field. No overreach found.

## What this seat found, in the two sections it was asked to weight

**Existing Thesis Updates / New Candidates / Decision Dashboard:** all three are either correctly empty or correctly inert this week. The Decision Dashboard's "0/13, None" for every row is the right way to represent a week with no new evidence — it does not dress up inaction as progress, and it does not let the five names drift stage without a dated reason, consistent with the ladder in the Patience Policy.

## Other note

Section 0 is omitted with the stated reason "there were no open reader comments." `data/issue_comments.csv` was not included in the extract provided to this review, so that claim could not be traced against the source it depends on.

## Verdict rationale

No figure here is unsupported, no UNVERIFIED row is used as evidence, no benchmark is presented as a measurement, and no decision review is proposed with an outstanding gate. The findings below are about specificity of the Research Queue, not about anything false in the issue as written.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "No blocking defects; Research Queue should name maintenance-vs-growth capex and rival-capacity questions explicitly rather than leaving them implicit in the radar prose.",
  "findings": [
    {
      "severity": "material",
      "section": "Structural Change Radar / Research Queue",
      "finding": "GEV and VRT free-cash-flow guidance is cited at face value while both companies are mid-expansion; the store never separates maintenance from growth capex, and the Research Queue's generic 'extract... cash flow' item is not specific enough to force that split to be extracted from the pending 10-Qs.",
      "fix": "Add a Research Queue item naming the maintenance/growth capex split explicitly for GEV and VRT, sourced from segment capex disclosure once the 10-Qs are read.",
      "evidence": "growth_estimates.csv gev row (FY26 guide revenue $45.5-46.5B, FCF $11.5-12.5B, 20 GW\u219230GW capacity plan) and vrt row (FY26 guide organic growth 30-32%, adjusted FCF $2.4-2.6B); Research Queue item 1 in report.md."
    },
    {
      "severity": "material",
      "section": "Structural Change Radar (Age of Electricity)",
      "finding": "The issue frames GE Vernova's current pricing power as a physical-capacity bottleneck (factory floor-space, workforce) but never asks whether rival turbine or equipment makers are expanding capacity behind the same shortage \u2014 the question that decides whether the store's own 'scarcity-rent-plus-installed-base' framing survives or reverts once the bottleneck clears.",
      "fix": "Add a Research Queue item to identify competitor (Siemens Energy, Mitsubishi Power for GEV; comparable rivals for VRT) capacity-expansion plans and lead times against GE Vernova's own 20GW\u219230GW schedule.",
      "evidence": "growth_estimates.csv gev row: economics_type 'scarcity-rent-plus-installed-base', growth_basis notes 'Long run sits below the current 22% because units cannot grow faster than the factories.'"
    },
    {
      "severity": "material",
      "section": "Executive Summary / Section 0",
      "finding": "The claim that Section 0 is omitted because there were no open reader comments cannot be checked against the extract provided for this review.",
      "fix": "Verify against data/issue_comments.csv that no row has status 'open' as of the evidence cut-off.",
      "evidence": "data/issue_comments.csv was not included in the store extract supplied to this review."
    }
  ]
}
```
