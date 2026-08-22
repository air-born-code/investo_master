# Valuation and Narrative Discipline — Review of Issue 2026-W34

## Lead finding

Section 2 ("Cycle Position") cites "the enormous announced capex plans ($725B aggregate from hyperscalers in 2026, partially evidenced in Q1 filings)" to support the claim that "current funding costs are not yet discouraging investment." The store's own primary evidence directly undercuts this. `src-2026-w32-hyperscaler-runrate` (stance: `contradicts`) shows Q1 2026 combined capex annualises to $519B, "materially below the roughly $725B full-year aggregate reported in the press," and concludes the $725B figure "is a forward commitment rather than an established rate." The issue's hedge — "partially evidenced" — is weaker than what the store itself already says. This is exactly the failure mode this seat exists to catch: a number is carried forward (the $725B) without the story the store attaches to it (that the number is disputed by the filings used to support it). The fix is a one-sentence addition, not a rewrite, but it changes what the paragraph is entitled to conclude about funding discipline.

## Standing questions, answered

**Which valuation input does each part of the story change, and by how much?** Mostly none, this week — and that is correctly reflected: valuation-asymmetry scores (GEV 1/10, VRT 1/10, CRDO 1/10, RKLB 1/10, MP 4/10) are carried unchanged from `data/scores.csv` (2026-W29), and the Existing Thesis Updates section rightly declines to move them absent new evidence. The one place a number is used to carry a story without the story being fully honoured is the capex figure above.

**Is the same addressable market being counted once or separately?** Checked the layer/asset mapping in `ai_value_chain.csv`: `construction-spending` (pwr, eme, myrg) and `energy-spending` (gev, ceg, vst, tln, nee, duk, so, aep, exc, d, leu, ccj, uec, dnn, nxe, uuuu, oklo, smr, bwxt) do not overlap, nor does either overlap `equipment-profit`'s sixteen names. No double-counting found.

**Where is the discount rate, and does it reflect the risk actually being described?** Section 2 correctly separates the discount-rate channel (currently "neutral," fed funds unchanged) from the capital-cycle/funding-durability risk the Soros framing raises. That separation is sound method: a reflexivity concern about external funding is not a discount-rate story, and the issue does not conflate the two.

## Other findings

The Cycle Position claim that "core CPI is now 0.40 percentage points below its year-ago level and has declined in three of the last four months" cannot be checked against what I was given — `macro_history.csv` is excluded from this extract, and the `sources.csv` rows visible to me show only two core-CPI readings across weeks 29–34 (2.6% in June, 2.5% in July), which is not enough by itself to establish a three-of-four-month trend. I am not asserting the claim is wrong; I could not trace it in the supplied store, and it is exactly the kind of quantitative anchor a cycle-interpretation paragraph should not carry unverified.

Section 3a restates the iCapital layer cents in prose ("hyperscaler cloud captures 29.7 cents... commercial chips 13.0 cents...") despite the explicit authoring instruction that the pipeline already renders this board and that reproducing the figures "duplicates them in the same document." The hedge preceding it ("remains stored as a single dated benchmark... The picture remains") is adequate to avoid presenting the benchmark as a measurement, so I am not raising this as a mis-citation — but it is a direct instance of the redundancy the workflow instructions ask the drafter to avoid, and worth a clean-up pass.

Section 3a also omits the specific concentration arithmetic the drafting brief calls for — stating what share of the AI dollar the store covers directly, adjacently, and not at all. The section gives name counts per layer (16, 19, 3) but never rolls them into the aggregate-cents statement the brief anticipates, which is the number that would actually let a reader judge whether "concentrated in equipment and energy" is a mandate choice or drift.

## What was sound

Existing Thesis Updates (GEV, VRT, CRDO, RKLB, MP) are well-disciplined: each figure traces to a dated, named source (GEV's order and backlog figures to `src-2026-w32-gev-q2`/`gev-gas-capacity`/`gev-dc-orders`; VRT's disclosure gap to `src-2026-w32-vrt-no-orders`; CRDO's 81% concentration correctly sums 49%+32% from `src-2026-w29-crdo-10k`; RKLB's and MP's open filings are named as unreviewed rather than guessed at). No valuation was updated where no new evidence justified it — the correct behaviour under the patience policy, and the dashboard and gates ledger are reported accurately against `gates.csv` (all thirteen gates `not_assessed` for all five names). Scenario Analysis and New Candidates were properly omitted with a stated reason rather than padded.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "Capex figure is presented without the store's own contradicting evidence; a CPI trend claim cannot be traced in the supplied extract.",
  "findings": [
    {
      "severity": "material",
      "section": "2. Cycle Position",
      "finding": "The $725B hyperscaler capex aggregate is cited supportively ('partially evidenced in Q1 filings') without noting that the store's own primary source explicitly contradicts it, calling the figure 'a forward commitment rather than an established rate' against a Q1 run-rate of $519B.",
      "fix": "Add a clause noting the run-rate contradiction so the paragraph's conclusion about funding discipline reflects the strongest evidence in the store, not just the headline figure.",
      "evidence": "src-2026-w32-hyperscaler-runrate (stance: contradicts) vs src-2026-w32-hyperscaler-capex"
    },
    {
      "severity": "material",
      "section": "2. Cycle Position",
      "finding": "The claim that core CPI 'has declined in three of the last four months' and is '0.40 percentage points below its year-ago level' cannot be traced in the supplied store extract, which shows only two core-CPI readings (2.6% June, 2.5% July) across the cited source rows; macro_history.csv, which might support it, was excluded from this review.",
      "fix": "Verify the three-of-four-month trend and the year-over-year comparison against data/macro_history.csv before next publication; cite the specific months if confirmed.",
      "evidence": "src-2026-w30-fred-cpilfesl, src-2026-w32-fred-cpilfesl, src-2026-w33-fred-cpilfesl, src-2026-w34-fred-cpilfesl — only two distinct values visible (2.6%, 2.5%)"
    },
    {
      "severity": "minor",
      "section": "3a. The AI profit pool",
      "finding": "The section restates the iCapital layer cents in prose (29.7c, 13.0c, 5.8c, 3.8c) despite the authoring instruction that the rendered board already carries these figures and that reproducing them duplicates the document.",
      "fix": "Replace the restated cents with the interpretive claim only (e.g., 'the exhibit's four largest boxes remain outside our coverage'), referring readers to the board for the figures.",
      "evidence": "ai_value_chain.csv / ai_profit_pool.csv rendered board vs. the prose restatement in the issue"
    },
    {
      "severity": "minor",
      "section": "3a. The AI profit pool",
      "finding": "The section reports layer name-counts (16 in equipment-profit, 19 in energy-spending) but does not compute the aggregate share of the AI dollar covered directly, adjacently, and not at all, which is the specific interpretive step the drafting brief calls for.",
      "fix": "Add the roll-up (directly/adjacently/uncovered cents) so the concentration finding is stated as a number, not just a name count.",
      "evidence": "ai_value_chain.csv exposure_class field across all layers"
    }
  ]
}
```
