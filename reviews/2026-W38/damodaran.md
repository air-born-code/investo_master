# Valuation and Narrative Discipline — Review of 2026-W38

## The one thing to fix

Section 2 states: *"the valuation at $264 B already credits a long runway"* for GE Vernova. This figure does not appear anywhere in the store. The Standing Coverage table at the top of the same issue gives GEV's market cap as **$284.27B**, sourced to `src-2026-w29-gev-market` ("$284.3B", 2026-07-17). No row anywhere — not in `sources.csv`, not in `scores.csv`, not in `growth_estimates.csv` — supports $264B. The issue therefore contains two different valuations for the same company, in the same document, with the higher (and correct, sourced) figure appearing above and the lower (unsourced) figure used to argue that the market "already credits a long runway."

This is precisely the failure mode this seat exists to catch: a narrative point built on a number that traces to nothing, and which happens to contradict a number the document itself cites elsewhere. It also matters for the argument being made — Nick Sleep's destination question ("what does GEV look like at maturity") is being tested against the wrong base, understating the multiple the market is actually paying by roughly 7%. Fix: use $284.27B (or re-derive from the current 10-Q/market data and cite it), and reconcile the two figures before this goes out.

## What the discount-rate story is missing a number for

Section 2's closing line on rates — *"the market appears to be projecting a 'higher for longer' plateau"* — is the load-bearing claim for the whole paragraph's argument that AI-buildout valuations are "sensitive to the discount rate even before any earnings change." No forward-rate curve, futures-implied cut count, or term-premium figure is cited to support "higher for longer" as a market view rather than as the author's read. The regime board gives the current level (3.63%, unchanged four months); it does not give the market's expectation of the path, which is the actual input the argument needs. Given that every candidate in Standing Coverage already carries a 1/10 valuation-asymmetry score, the more useful sentence would say directly whether this week's macro data moves that already-poor asymmetry in either direction, or leaves it exactly where it was. As written, the rate narrative and the 1/10 scores sit in the same issue without ever touching.

This is not a request for a discount-rate model on five companies that received no new evidence this week — that would be false precision of exactly the kind this seat is warned against manufacturing. It is a request that a sentence making a claim about market rate expectations either cite what the market is pricing, or be framed explicitly as the author's inference rather than an observed fact.

## What the seat found sound

- The iCapital 3.8¢/13.0¢/etc. figures are consistently handled as a dated benchmark, not a measurement, both in Section 3a and in the profit-pool discussion — the qualifying language ("our only dated reference point," "the profit allocation is unchanged" following directly from that framing) is doing its job.
- Sections 5–7 (New Candidates, Existing Thesis Updates, Scenario Analysis) are correctly omitted rather than padded. Nothing in `growth_estimates.csv`, `scores.csv` or `gates.csv` has moved since W29/W32, so there is genuinely no valuation input to re-underwrite this week. Forcing a scenario table with no new inputs would have been the more common and more damaging error; the draft avoided it.
- No UNVERIFIED row (the Melvin thread, the ARKL thread) is cited as evidence anywhere in the body text — both are correctly absent, having been used only in prior weeks' sourcing work.
- The Decision Dashboard correctly shows 0/13 gates for every candidate and proposes no decision review. Nothing here overreaches the patience policy.

## One smaller item

The GEV permitting discussion ("the speed-limiting factor is factory floor-space and the ability to hire and train the skilled workforce") is asserted as fact but is not attributed to any filing in the store — `growth_estimates.csv`'s gev row discusses GW-output pacing but not the specific bottleneck named here. This should be labelled as an Investo Master inference rather than presented as if it came from GE Vernova's own disclosure.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "GEV valuation figure ($264B) is unsupported and contradicts the $284.27B market cap cited elsewhere in the same issue; the rate 'higher for longer' claim has no attached number.",
  "findings": [
    {
      "severity": "blocking",
      "section": "2. Cycle Position",
      "finding": "The sentence 'the valuation at $264 B already credits a long runway' cites a GE Vernova valuation that appears nowhere in the store and contradicts the $284.27B market cap given in the Standing Coverage table earlier in the same issue, sourced to src-2026-w29-gev-market.",
      "fix": "Replace $264B with the sourced $284.27B (or a freshly derived and cited figure) and reconcile the two numbers so the document states one valuation for GEV.",
      "evidence": "Standing Coverage table (GEV market cap $284.27B) vs. Section 2 text ('$264 B'); src-2026-w29-gev-market states 'Market capitalisation was approximately $284.3B.'"
    },
    {
      "severity": "material",
      "section": "2. Cycle Position",
      "finding": "The claim that 'the market appears to be projecting a higher for longer plateau' is used to argue that long-duration AI-buildout valuations are rate-sensitive, but no forward-curve, futures-implied, or term-premium figure is cited to support that this is the market's view rather than the author's inference.",
      "fix": "Either cite a forward-rate or futures-implied-cuts figure supporting the 'higher for longer' characterisation, or label the sentence explicitly as an Investo Master inference and state what it would change about the existing 1/10 valuation-asymmetry scores.",
      "evidence": "Regime board gives only the current FEDFUNDS level (3.63%, unchanged); macro_series.csv's authored transmission text for FEDFUNDS discusses the mechanism but the issue asserts a market expectation with no supporting series."
    },
    {
      "severity": "minor",
      "section": "3. Structural Change Radar — Age of Electricity",
      "finding": "The specific claim that GE Vernova's capacity bottleneck is 'factory floor-space and the ability to hire and train the skilled workforce' is stated as fact but is not attributed to any filing; growth_estimates.csv's gev row discusses GW-output pacing without naming this specific constraint.",
      "fix": "Label the sentence as an Investo Master inference rather than an unattributed factual claim, or cite the specific disclosure it comes from.",
      "evidence": "data/growth_estimates.csv, gev row (growth_basis text names unit pacing, not floor-space or workforce training, as the constraint)."
    }
  ]
}
```
