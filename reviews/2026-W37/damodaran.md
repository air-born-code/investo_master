# Committee Memo — Valuation and Narrative Discipline Seat
## Issue 2026-W37-005

**The one thing that most needs to change:** the issue asserts that valuations have "expanded sharply" and are "demanding," and the Decision Dashboard twice cites "minimal margin of safety" — but no multiple, DCF, or discount-rate figure anywhere in the issue supports any of these claims. The Research Queue itself lists the reverse-DCF and base-rate work as *not yet done* (item 3). A story about valuation is being told this week with no valuation input behind it, which is precisely the defect this seat exists to catch, and it is more consequential than the two smaller arithmetic issues below because it sits in the section (Cycle Position) that frames every candidate's asymmetry.

### 1. Narrative without a number: valuation richness asserted, never shown

- **Cycle Position:** "Valuations for data-centre equipment and electrical names have expanded sharply." No multiple (P/E, EV/EBITDA, EV/Sales) is cited, before or after. The store contains no valuation ratios for GEV, VRT, CRDO, RKLB, or MP at all — only market caps and the qualitative `valuation_asymmetry` scores in `scores.csv` (1/10 for four of the five names). A score of 1/10 is itself a number without a story: nothing in the issue explains what price, what growth rate, or what discount rate produces that 1. Standing next to the correctly disciplined `growth_estimates.csv`, which forces every growth range to a stated economics_type and falsifier, the valuation side of the ledger has no equivalent discipline.
- **Decision Dashboard:** "Evidence strong, valuation leaves minimal margin of safety" (GEV) and "Valuation demanding; critical forward metrics missing" (VRT). Same defect, repeated. These read as conclusions, not as findings — exactly the distinction the seat is charged to enforce.
- This is not a request to build a model prematurely (that would trade one error for the opposite one — false precision on names whose own gates are `not_assessed`). It is a request to either attach a number or drop the adjective. "No margin of safety has been assessed" is honest; "minimal margin of safety" implies one has.

**Fix:** Either replace "expanded sharply" / "minimal margin of safety" / "demanding" with an explicit, sourced figure (even a single EV/Sales snapshot would do), or restate the sentence as an open question — consistent with how the rest of the issue handles unread filings.

### 2. A four-week stablecoin growth figure that does not match its own endpoints

Section 3b: "total stablecoin supply at $311.9bn, up about 1.4% in four weeks." The two dated snapshots in `agent_traffic.csv` for `stablecoin-supply-total` are $306,546,083,823 (W33, 2026-08-15) and $311,887,386,137 (W37, 2026-09-12). That is a change of **+1.74%**, not 1.4%. The payment-chain figure two sentences later ("fell 0.3% to $118.4bn") does tie out exactly to the row's own `change_pct` field. The inconsistency is narrow but it is the kind of small, checkable slip that undermines confidence in the parts of the section that cannot be independently checked (e.g., the batching-discovery interpretation).

**Fix:** Recompute against the two dated store values and correct to ~1.7%, or cite the intermediate week actually used if the four-week window draws on data not shown in this extract.

### 3. Two historical claims I cannot trace in what I was given

- "core CPI fell to 2.4% — the lowest since early 2022." The current 2.4% reading is confirmed (`src-2026-w37-fred-cpilfesl`), but the "lowest since early 2022" comparison requires the historical series, which sits in `macro_history.csv` — explicitly excluded from my extract.
- "the Fed has held rates at 3.63% for over a year." The 3.63% level is confirmed at several recent weekly cuts (W30 through W37), but "over a year" requires a data point from roughly September 2025, also outside what I was given.

Neither claim is necessarily wrong — I simply cannot confirm either from the store extract provided. Per the review brief, I am raising this as material rather than asserting error.

**Fix:** Verify both against `macro_history.csv` before the next send; if either does not hold, restate without the superlative.

### 4. Minor: benchmark cents restated without their hedge

Section 3a: "The central finding endures: 29.7 cents of every AI dollar flows to the hyperscaler layer we do not track." This is the iCapital exhibit's estimate, correctly labelled "our benchmark" one sentence earlier, but the restatement itself drops the hedge ("flows to," not "is estimated to flow to") and duplicates a figure the rendered value-chain board already carries with its full caveat. Not a measurement-dressed-as-fact violation on its own merits given the preceding sentence, but worth tightening.

**Fix:** Carry the hedge into the sentence that states the number, and treat the figure as read from the board rather than restated in full.

### What passed

The **Existing Thesis Updates** section is well disciplined for this seat: every name is marked "No update" with a named reason (unread filing) rather than a manufactured view, and no valuation conclusion is drawn where none has been earned. **New Candidates** and **Scenario Analysis** were correctly omitted rather than filled with placeholder numbers. The gates table, scores table, and Decision Dashboard stages are internally consistent with each other and with the Patience and Conviction Policy — no candidate is pushed toward Decision Review with an outstanding gate.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "Valuation is called 'expanded' and 'demanding' with no multiple or model behind it; a stablecoin growth figure and two historical claims also don't check out against the store.",
  "findings": [
    {
      "severity": "material",
      "section": "Cycle Position",
      "finding": "Claims that watchlist valuations have 'expanded sharply' with no multiple, DCF, or price figure cited anywhere in the issue, while the Research Queue itself confirms no reverse-DCF or base-rate work has been done.",
      "fix": "Attach a sourced figure (e.g. an EV/Sales or EV/EBITDA snapshot) or restate as an open question rather than a conclusion.",
      "evidence": "Cycle Position paragraph beginning 'Second-level thinking (Howard Marks)'; Research Queue item 3 ('perform a reverse DCF on GEV and VRT')."
    },
    {
      "severity": "material",
      "section": "Decision Dashboard",
      "finding": "'Minimal margin of safety' (GEV) and 'Valuation demanding' (VRT) are stated as findings with no valuation input in the store to support them.",
      "fix": "Replace with 'valuation not yet assessed' or cite the specific figure driving the judgement.",
      "evidence": "Decision Dashboard rows for GEV and VRT; scores.csv shows valuation_asymmetry=1 with no supporting multiple or model anywhere in the store."
    },
    {
      "severity": "material",
      "section": "3b. Digital Assets",
      "finding": "'up about 1.4% in four weeks' does not match the two dated total-stablecoin-supply values in the store, which imply +1.74%.",
      "fix": "Recompute from the W33 ($306,546,083,823) and W37 ($311,887,386,137) values, or cite the actual four-week window if intermediate data was used.",
      "evidence": "data/agent_traffic.csv, series stablecoin-supply-total, rows for 2026-W33 and 2026-W37."
    },
    {
      "severity": "material",
      "section": "Executive Summary / Cycle Position",
      "finding": "'lowest since early 2022' (core CPI) and 'held rates... for over a year' (fed funds) both require historical series data not present in the extract provided for review.",
      "fix": "Verify both claims against macro_history.csv before sending; restate without the superlative if either does not hold.",
      "evidence": "macro_history.csv is excluded from the review extract per instructions; only current-month FRED snapshots (src-2026-w37-fred-cpilfesl, src-2026-w37-fred-fedfunds) are available."
    },
    {
      "severity": "minor",
      "section": "3a. Artificial Intelligence",
      "finding": "The 29.7-cent hyperscaler figure is restated as a bare fact ('flows to') rather than carrying the benchmark hedge, and duplicates a figure the rendered value-chain board already shows.",
      "fix": "Keep the hedge ('is estimated to') when restating, or drop the restatement and reference the board directly.",
      "evidence": "Section 3a: 'The central finding endures: 29.7 cents of every AI dollar flows to the hyperscaler layer we do not track.'"
    }
  ]
}
```
