# Forensic Short Review — Issue 2026-W34

## What most needs to change

The issue's most AI-capex-relevant discussion — the 17.3¢ external-funding layer and the $725B hyperscaler capex aggregate — stops one step short of the seat's actual questions. It names the funding as "belief" (Soros framing) and correctly flags that reflexive capital is the chain's weakest input, but it never asks the two questions that would test whether the belief is circular: **who is financing the customer, and does anyone downstream book revenue from a party it (or its investor) also funds?** Given that hyperscaler-cloud and foundation-models sit at zero coverage in this store, the honest answer this week is "cannot be assessed from what we hold" — but the issue should say that explicitly rather than let the Soros framing stand in for it. This is squarely the seat's mandate and the gap should be named, not filled with narrative.

## Standing questions, answered against the store

**Who is financing the customer, and does anyone book revenue from a party it also funds?** Not assessable. The store carries no vendor-financing or investee-revenue disclosure for any of the five active candidates, and the two layers where this circularity is most live in the real AI market (hyperscaler-cloud, foundation-models) are tracked at zero names (`ai_value_chain.csv`). The issue's Soros paragraph gestures at the risk but doesn't state the limitation this plainly. **Fix: state the "cannot be assessed" answer directly and add "trace any vendor-financing or reciprocal-investment arrangement between a tracked equipment/energy name and its hyperscaler customers" to the Research Queue.**

**Have depreciation schedules, useful lives, or capitalisation policies changed while spending accelerated?** Not addressed anywhere in the issue, and not present as a tracked question in `growth_estimates.csv` or the Research Queue for any name. This is the seat's other core specialty, and the current setup — a capex boom (§2, §3a) sitting on top of unreviewed 10-Qs for Eaton, Vertiv, GE Vernova and eleven other names (§4, "Signal Scanner") — is exactly the situation where a useful-life extension would first surface and first matter, and nobody has looked yet. **Fix: add explicit depreciation/useful-life/capitalisation-policy review to the Research Queue for the equipment-profit layer (VRT, ETN, GEV) once the queued 10-Qs are read.**

**Which growth figures would disappear under a consistent accounting policy?** Mostly clean. GEV's +88% orders and ETN's +43% backlog are unit/contract figures, not accounting constructs, and the store itself already carries the right falsifier for ETN — "Order growth turning negative while backlog stays flat — the signature of cancelled duplicate orders" (`growth_estimates.csv`, etn row) — which the issue's Chancellor paragraph (§3a) discusses in general capacity terms without naming this specific double-ordering test. One softer spot: VRT's "adjusted operating margin 22.6%" (§6) is cited without a GAAP reconciliation, and the underlying release is on record (`src-2026-w32-vrt-q2`) as omitting orders and backlog. An adjusted-margin figure standing next to a disclosure that got thinner in the same quarter is worth a line noting the GAAP gap is unknown, not just the orders gap.

## Secondary observations

- Citation shorthand in Existing Thesis Updates (`src-edgar-vrt-10q`, `src-edgar-rklb-s4`, `src-edgar-mp-10q-2026-08-07`) doesn't match the actual `source_id` values in `sources.csv` (e.g., `src-edgar-000162828026050609`, `src-edgar-rklb-000175392626001452`, `src-edgar-000180136826000048`). Not a factual error — the underlying filings exist and are correctly described — but it weakens traceability for a reader trying to verify against the store.
- The iCapital benchmark cents are handled correctly throughout: attributed, dated, never presented as measured. No blocking issue there.
- The $725B hyperscaler capex line in §2 ("partially evidenced in Q1 filings") is hedged enough not to misstate the figure, but the store holds a sharper, dated tension the issue doesn't surface: Q1 capex annualises to ~$519B against the ~$725B guide, a gap the source itself calls "load-bearing for the bear case" (`src-2026-w32-hyperscaler-runrate`). Worth one sentence rather than the current soft phrasing, given how central this figure is to the cycle-position argument.

## What passed

The scarcity-rent framing for GEV/ETN/transformer names is handled with real discipline — explicitly labelled "cyclical scarcity rent... not a moat" (§3a), with a stated kill criterion (lead times normalising while backlog falls). That is the correct level of scepticism applied to a capex boom and needed no correction.

```json
{
  "verdict": "publish-with-fixes",
  "summary": "Solid issue, but misses the two forensic questions its own data invites: circular AI financing and unexamined depreciation/useful-life policy amid the capex boom.",
  "findings": [
    {
      "severity": "material",
      "section": "Structural Change Radar (3a. The AI profit pool)",
      "finding": "The Soros framing of the 17.3¢ external-funding layer names reflexivity as a risk but never poses the seat's specific question — whether any tracked name, or its financiers, is booking revenue from a party it also funds. Given zero coverage at hyperscaler-cloud and foundation-models, the honest answer is 'cannot be assessed,' which the issue should state rather than imply is covered by the Soros lens.",
      "fix": "Add a sentence stating the circularity question is currently unanswerable from the store's coverage, and add 'trace any vendor-financing or reciprocal-investment structure between tracked equipment/energy names and their hyperscaler customers' to the Research Queue.",
      "evidence": "data/ai_value_chain.csv rows external-funding, hyperscaler-cloud, foundation-models (all our_name_count=0); issue text 'Soros asks: which part of this theme's fundamentals is being created by belief?'"
    },
    {
      "severity": "material",
      "section": "Signal Scanner / Research Queue",
      "finding": "No mention anywhere in the issue of depreciation schedules, useful-life assumptions or capitalisation policy, despite the issue itself flagging that the relevant 10-Qs (Eaton, Vertiv, GE Vernova, and others) sit unreviewed while capex and backlog are accelerating — precisely the condition under which a useful-life extension would first appear and first matter.",
      "fix": "Add explicit depreciation/useful-life/capitalisation-policy review to the Research Queue for VRT, ETN and GEV once their queued 10-Qs are read.",
      "evidence": "Signal Scanner: 'the store has not yet processed most of them; they remain categorized as contents not yet reviewed'; no depreciation-related item appears in Research Queue items 1-6."
    },
    {
      "severity": "minor",
      "section": "Existing Thesis Updates",
      "finding": "Source references (src-edgar-vrt-10q, src-edgar-rklb-s4, src-edgar-mp-10q-2026-08-07) don't match the actual source_id values in sources.csv, weakening traceability even though the underlying filings and facts are correctly described.",
      "fix": "Align in-text source citations to the actual source_id strings (e.g. src-edgar-000162828026050609 for the VRT 10-Q).",
      "evidence": "sources.csv rows src-edgar-000162828026050609, src-edgar-rklb-000175392626001452, src-edgar-000180136826000048."
    },
    {
      "severity": "minor",
      "section": "Cycle Position",
      "finding": "The $725B hyperscaler capex aggregate is cited with a soft hedge ('partially evidenced in Q1 filings') that doesn't convey the store's own documented tension: Q1 capex annualises to ~$519B, a gap the source itself flags as load-bearing for the bear case.",
      "fix": "Cite the run-rate gap explicitly (~$519B annualised vs ~$725B guided) rather than the vaguer 'partially evidenced' phrasing.",
      "evidence": "src-2026-w32-hyperscaler-runrate: 'annualises to $519B, materially below the roughly $725B full-year aggregate... a forward commitment rather than an established rate.'"
    }
  ]
}
```
