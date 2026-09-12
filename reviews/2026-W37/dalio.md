# Committee Memo — Debt and Liquidity Machine Seat
## Issue 2026-W37

## Headline finding

The issue never asks who is borrowing to fund the buildout it spends five sections describing, even though the regime board it was handed already names the channel. The Fed funds transmission text — printed once, not authored by this issue but available to it — states plainly: *"generation, grid and data-centre capacity is project-financed, so the policy rate is an input cost to the buildout itself, not only a valuation multiplier."* Cycle Position reads that same board and produces a demand-side argument (IEA global 3.6% vs. EIA US 0.9–1.6%) without once picking up the financing-cost thread the board itself supplied. A year of unchanged fed funds at 3.63% is treated as background, not as a variable that determines whether GE Vernova's 63 GW of slot reservations convert, whether Vertiv's withheld backlog would still clear at a higher discount rate, or whether a utility's rate-base capital plan survives a repricing of its debt. That is exactly the failure mode this seat exists to catch: a demand forecast with no funding source named.

## Answering the standing questions

**Who is borrowing to fund the spending this theme depends on, and on what terms?** The issue does not say, for any name. The one case where the store hands this to the writer on a plate — Rocket Lab's Iridium acquisition, financed by a disclosed $3.6bn *364-day* senior secured bridge loan (src-edgar-000175392626001085) against a company running a $50.3M quarterly operating cash outflow (src-2026-w29-rklb-10q) — is reduced in §6 to "the transaction's permanent financing... need[s] fresh underwriting," with no mention that the existing facility is short-dated and its refinancing rate is precisely a fed-funds-sensitivity question. This is the sharpest miss in the issue: the evidence for a credit-cost finding is sitting in the store, already cited elsewhere in the same document, and the seat's question was not asked of it.

**Does the macro section read levels without asking where the money comes from?** Yes. Cycle Position discusses whether AI capex growth ($519bn Q1 run-rate vs. $725bn full-year target) is durable, but treats the ramp as a demand-realisation question only. It does not ask whether hyperscaler free cash flow covers the acceleration or whether the gap is bond-funded, nor does it ask the equivalent question for utility rate-base growth (NEE, AEP), where the growth_estimates.csv rows explicitly identify "regulated-return-on-rate-base" as the economic model — a model that only works if capital can be raised on acceptable terms.

**What happens to this chain if the cost of that credit rises two points?** Not addressed anywhere in the issue, including in the one place it structurally belongs — the Cycle Position interpretation of the fed-funds line. This should be a standing Research Queue item, not an absence.

## What the issue gets right, for calibration

Section 3a's treatment of "external funding" (the 17.3¢ of investor capital propping up the model layer) is a genuinely mechanistic read: it is named as "the chain's least durable input" and tracked as a subsidy rather than revenue. That is the right instinct applied to one layer. It has simply not been extended to the layers this store actually covers — the project-financed physical buildout — where the same instinct would have produced more.

## Secondary finding

The claim that August core CPI at 2.4% is "the lowest since early 2022" cannot be checked against anything supplied in this review (macro_history.csv is excluded from the extract by design). The decade range in the regime board only gives the 2016–2026 high/low, not a monthly path, so the specific comparison point is unverifiable from what I have. This is a fixable sourcing gap, not necessarily an error.

## Recommendation

Publishable, but Cycle Position should be amended before or alongside send to add the financing-cost paragraph the regime board's own transmission text calls for, and §6's RKLB update should name the bridge loan's term structure explicitly. Neither requires new research — both are visible in sources already cited in this issue.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "Cycle Position never applies the fed-funds project-financing channel the regime board itself names, and misses RKLB's disclosed short-dated bridge loan as the clearest funding-cost exposure in coverage.",
  "findings": [
    {
      "severity": "material",
      "section": "Cycle Position",
      "finding": "The section argues demand (IEA vs EIA) but never asks how the physical buildout it covers is funded or what a rise in credit cost does to it, despite the Fed funds transmission text on the same page stating that generation, grid and data-centre capacity is project-financed and that the policy rate is an input cost to the buildout itself.",
      "fix": "Add interpretation of the year-long unchanged fed-funds level through the financing-cost channel: what a further move does to GEV's slot-reservation conversion economics, VRT's growth guide, and utility rate-base capital plans (NEE, AEP) that depend on raising capital on acceptable terms.",
      "evidence": "macro_series.csv FEDFUNDS equity_transmission field; growth_estimates.csv gev/vrt/nee rows citing scarcity-rent and regulated-return-on-rate-base economics with no financing-cost sensitivity stated."
    },
    {
      "severity": "material",
      "section": "6. Existing Thesis Updates — Rocket Lab (RKLB)",
      "finding": "The update flags 'permanent financing' of the Iridium deal as an open question but does not name the disclosed terms of the existing $3.6bn facility — a 364-day senior secured bridge loan — against a company with negative operating cash flow, which is the single largest near-term credit-rollover exposure in the entire coverage set.",
      "fix": "State explicitly that the bridge is short-dated and floating-rate-exposed, and add refinancing terms and rate as a named monitoring item alongside Neutron milestones.",
      "evidence": "src-edgar-000175392626001087 (RKLB 425, $3.6bn 364-day senior secured bridge term loan); src-2026-w29-rklb-10q (Q1 operating cash outflow $50.3M)."
    },
    {
      "severity": "minor",
      "section": "Cycle Position",
      "finding": "The claim that August core CPI (2.4%) is 'the lowest since early 2022' cannot be traced in the material supplied — the regime board gives only the decade high/low, not a monthly path.",
      "fix": "Verify against macro_history.csv before repeating the comparison, or cite the specific month being compared against.",
      "evidence": "Regime board decade range for Core CPI shows only 2016-2026 high (6.6%, Sept 2022) and low (1.2%, May 2020); macro_history.csv is excluded from this review."
    }
  ]
}
```
