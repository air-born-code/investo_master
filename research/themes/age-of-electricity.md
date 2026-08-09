# The Age of Electricity

Theme deep dive. Started 2026-08-08. Newest entries appended; earlier entries are never revised.

Related store rows: `data/themes.csv` (`age-of-electricity`), `data/asset_themes.csv`,
`data/growth_estimates.csv`, `data/sources.csv`.

---

## Entry 2026-08-08 — The bottleneck has moved from compute to electricity

### 1. What the theme actually claims

The one-line version in `themes.csv` says electricity demand is reaccelerating. That is true and
almost useless, because it does not say who gets paid. The sharper claim, and the one worth
underwriting, is this:

> After roughly two decades in which US electricity demand was flat, load is growing again. The
> new load arrives in very large, very concentrated, very impatient blocks. The industry that has
> to serve it spent twenty years optimising for a market that did not grow, and therefore cannot
> expand quickly. That mismatch — patient supply meeting impatient demand — produces scarcity,
> and scarcity is where the returns are, not in the demand growth itself.

Everything below is an attempt to establish where in the chain that scarcity is real, how long it
survives, and which of the four different economic models in this theme actually convert it into
per-share value.

### 2. The demand side, and why it is the least interesting part

The demand evidence is strong and widely agreed:

| Claim | Figure | Source |
|---|---|---|
| Global electricity demand growth, 2026–2030 | 3.6% a year, about 50% above the previous decade's average | IEA, *Electricity 2026* |
| Global data-centre consumption | 415 TWh (2024) → roughly 945 TWh (2030) | IEA |
| Data-centre demand growth, 2025 | +17%; AI-focused data centres +50% | IEA |
| US electricity demand, to 2050 | +0.9%–1.6% a year across cases, after a decade of near-zero | EIA, *AEO 2026* (2026-04-08) |
| US generating capacity, to 2050 | +50% to +90% across cases | EIA |
| Hyperscaler capex, Q1 2026 (**as reported**) | **$129.8B** across Microsoft, Amazon, Alphabet and Meta, against $71.9B in Q1 2025 — **up 80%** | the four 10-Qs, via SEC XBRL |
| Hyperscaler capex, 2026 full year | roughly $725B, up about 77% on 2025's ~$410B | press aggregation of forward guidance — **not primary** |

Two things follow, and the second matters more than the first.

**First, the direction is not in dispute.** A structural break after twenty flat years is visible
in official forecasts from two independent institutions, and in the capital plans of the four
companies causing most of it.

**Second, and this is the actual analytical point: consensus on demand is precisely why demand is
not the edge.** If the only claim is "electricity demand is growing," that is in every price in
this theme already. GE Vernova and Vertiv both scored **1 out of 10** on valuation asymmetry in
W29 (`scores.csv`, 2026-07-18). The demand thesis is correct *and* fully priced. Any return has
to come from something else: from being right about **where the constraint binds, for how long,
and who is structurally positioned to charge for it** — and from price.

Note also the tension in the numbers above. The IEA sees global demand growing 3.6% a year; the
EIA sees US demand growing 0.9%–1.6% a year. Those are not contradictory (different geographies,
different horizons) but the US figure is the relevant one for most of this theme's companies, and
it is *far more modest than the theme's narrative implies*. A 1.3% national demand growth rate
does not obviously justify a decade of exceptional returns. What justifies it, if anything, is
concentration: a modest national average made up of violent local growth in a handful of
interconnection queues.

### 3. Where the constraint actually binds

This is the part worth doing carefully, because the constraint is not "electricity." It is four
specific, separately-priced scarcities.

**3.1 Firm generation slots — the hardest constraint.**

GE Vernova's Q2 2026 disclosure is unusually precise about this (8-K, 2026-07-22):

- Gas power equipment backlog plus slot reservation agreements grew from **100 GW to 116 GW** in
  one quarter, with at least 125 GW expected by year-end 2026.
- Output goes **20 GW annualised in Q3 2026 → 24 GW in 2028 → 30 GW in 2030**.
- In the quarter: signed 20 GW of new gas contracts (18 GW slot reservations, 2 GW orders),
  converted 10 GW of reservations to orders, shipped 3 GW. Backlog 44 → 53 GW; reservations
  56 → 63 GW.

Read those two facts together. There is 116 GW under some form of commitment and the factory will
make 30 GW a year — *in 2030*. Even taking the expansion at face value, industry output rises by
roughly half over four years against demand that has already committed four years of production.
Siemens Energy and Mitsubishi Power are reported to be in the same position. **A customer who
wants firm gas capacity this decade is negotiating for a queue position, not for a product.** That
is the single strongest pricing position in the theme.

**3.2 Grid equipment — a severe but self-correcting shortage.**

Large power transformer lead times are reported at three to five years, and switchgear beyond 60
weeks and effectively sold out through 2028 in many channels. This is a genuine bottleneck and it
prices: Eaton's electrical backlog is up 43% year over year against 14% organic revenue growth,
and Powell Industries — a small custom switchgear maker — booked a single data-centre order above
$400M, the largest in its history, at a 1.7x book-to-bill.

But transformers and switchgear are manufactured goods with no fundamental scarcity of input.
Capacity is being added now. **The margin here is rent collected during a shortage, not a moat.**
It should be underwritten as cyclical, and the exit is when lead times normalise — which is a
knowable, watchable event, not a surprise.

**3.3 Interconnection and regulatory permission — the constraint nobody can manufacture around.**

This is the most underrated of the four, and the one where the store now holds hard evidence.

- PJM's average wait from interconnection application to commercial operation has gone from under
  two years in 2008 to **over eight years**.
- PJM's 2027/28 base residual capacity auction cleared at **the FERC-approved cap, $333.44/MW-day**,
  and *still fell 6,623 MW short of the reliability requirement*. Data centres accounted for about
  $6.5B of $16.4B in total capacity cost.
- **FERC rejected**, 2–1, the amended interconnection agreement that would have let AWS expand
  behind-the-meter load at Talen's Susquehanna nuclear site. Talen is moving to a front-of-the-meter
  structure.

The auction result is the important one. A market that clears at its price cap *and still does not
procure enough capacity* is a market where price is no longer the clearing mechanism —
administrative allocation is. That has two consequences. It confirms scarcity is real rather than
narrative. And it guarantees political attention, because those costs land on retail bills.

The FERC ruling is the concrete form of that risk: the most economically efficient structure for
serving a data centre from an existing nuclear plant was **refused on fairness and reliability
grounds**. This is the theme's central non-obvious risk. Load growth is not the same as investable
load growth, because a regulator can decide who is allowed to serve it and on what terms.

**3.4 Skilled labour — the quietest and most durable.**

Quanta Services' actual moat is a trained union linemen workforce. You cannot buy linemen with
capital on a two-year view; the apprenticeship is the constraint. This is why the build-and-install
layer can hold margin in a boom rather than competing it away — though only for the firms large
enough to own the training pipeline. MYR Group, bidding for subcontracts, is in a materially worse
position than Quanta despite serving the same demand.

### 4. Four different businesses wearing one theme

The single most important thing this deep dive establishes is that **"Age of Electricity" contains
four incompatible economic models**, and conflating them is the main way to lose money holding the
theme.

| Model | Names | How value is created | What limits it |
|---|---|---|---|
| **Scarcity rent** | GEV, ETN, VRT, POWL, SPXC, NVT | Sold-out capacity → price and margin above trend | Capacity gets added. Rent decays. Some of it is cyclical, not structural. |
| **Regulated return** | NEE, AEP | Allowed return on a growing rate base | **No pricing power at all.** Load growth justifies more capital; it does not raise price. Ceiling is political tolerance for bills. |
| **Merchant price bet** | CEG, VST, TLN | Existing built fleet re-contracted at scarce-capacity prices | Directional both ways. The fleet is a fixed asset and power prices are the variable. |
| **Contracted commodity / optionality** | CCJ, BWXT | Long-dated fuel and component demand implied by today's contracts | Commodity pricing, mine and programme execution, timelines beyond the decade |

Three consequences worth stating plainly:

**Regulated utilities are not a leveraged play on load growth.** They earn a permitted return on
capital. When NextEra's Dominion merger filing includes **$2.25B of customer bill credits**, that
is the political constraint being priced in cash. Load growth is good for a utility only insofar as
regulators let it grow rate base — and the more visible the bills, the tighter that gets.

**For merchant generators, revenue growth is the wrong metric.** Constellation's plants already
exist. Signing 920 MW of PPAs at an 18.5-year average duration does not grow revenue 30%; it
converts an existing asset into a longer, more certain cash flow at a better price. Judge those
names on realised price, contracted share and cash flow per share — not on the top line. The
growth estimates table reflects this deliberately: CEG at 4–8% revenue looks *worse* than the
equipment names and is not obviously a worse business.

**Not every company with the exposure has the exposure.** Cummins genuinely sells standby
generation into data centres, and it is a truck engine company. The consolidated growth rate is
dominated by the part that is not growing. Same question, unanswered, for Trane and Hubbell.

### 5. The bear case, taken seriously

**5.1 The demand forecast is an extrapolation of one extraordinary year — and the widely-cited
figure is a promise, not a rate.** This is worth stating precisely, because the primary numbers say
something the press aggregate does not.

Actual reported Q1 2026 capital expenditure across the four was **$129.8B, up 80%** year over year
(Microsoft $30.88B, Amazon $44.20B, Alphabet $35.67B, Meta $19.00B — all from 10-Qs). That
annualises to **$519B**. The ~$725B figure quoted everywhere is *forward guidance*, and reaching it
requires the remaining three quarters to run roughly 50% above the Q1 rate.

So the order books in this theme are underwritten against a number that has not yet been spent. The
only Q2 figure filed so far — Amazon at $54.21B, up 23% sequentially — is directionally consistent
with the step-up, so this is not evidence the guidance is wrong. It is a statement about what is and
is not yet established, and it identifies the cheapest high-value thing to watch: **the gap between
the run-rate and the guidance closes, or it does not.** An 80% growth rate cannot persist
arithmetically in any case; the question is not whether AI demand is real but whether the second
derivative turning is enough to break order books priced for continuation.

**5.2 The order books are softer than the headline.** GE Vernova discloses 116 GW as 53 GW of firm
backlog and 63 GW of slot reservation agreements. **The majority is reservations, not orders**, and
their conversion rate under a capex slowdown has never been observed — the boom is the only regime
this instrument has existed in. Similarly, Eaton's 41% order growth cannot be distinguished from
customers ordering early to hold delivery slots. Double-ordering is invisible until it unwinds.

**5.3 Vertiv stopped disclosing the number that mattered.** The Q2 2026 release contains no orders,
no backlog and no book-to-bill — the exact metric W29 named as the open question for the name. Sales,
margin, EPS and guidance are all there. Whatever the reason, the forward indicator went missing at
the point in the cycle when it is most informative.

**5.4 The regulatory channel can transfer the value away.** FERC's Susquehanna decision, PJM
clearing at the cap while short of requirement, and $2.25B of pre-emptive bill credits are three
instances of the same force. If serving data-centre load becomes politically expensive, the
remedies available — large-load tariffs, co-location restrictions, cost allocation — move economics
from investors to ratepayers. Nothing about AI demand prevents this.

**5.5 The historical analogue is not encouraging for the equipment layer.** The 1999–2001 fibre
buildout got the demand direction right — internet traffic did grow as forecast — and still
destroyed the suppliers, because demand growth was *slower than the capacity built for it* and
because the pricing power was temporary. The failure mode was not a wrong thesis. It was correct
thesis, wrong timing, wrong entry price.

### 6. What would falsify this theme

Stated so it can be checked, not admired:

1. **Slot reservations expiring rather than converting.** GE Vernova's gas backlog falling in a
   quarter without matching orders. This is the earliest hard signal available.
2. **Order growth going negative while backlog stays flat** at Eaton or Vertiv — the signature of
   duplicate orders unwinding.
3. **Lead times normalising** on transformers and switchgear while the margins of SPXC, HUBB and
   POWL stay elevated — which would prove the margin was never scarcity-derived — or, more likely,
   falling with them.
4. **Adverse regulatory precedent extending**: further FERC rulings against co-location, or
   large-load tariffs that shift interconnection cost onto data centres and out of rate base.
5. **Hyperscaler capex guidance being cut**, not merely growing more slowly. The order books are
   built on the level, so a cut is the event that tests them.
6. **The US demand figure staying near the EIA's 0.9%–1.6%** while the theme's companies are priced
   for far more. This is the quiet falsifier: the theme can be true, modest, and still a bad
   investment.

### 7. What the store cannot answer

- **Eighteen of the twenty names in `growth_estimates.csv` carry `screen_inference` or
  `issuer_release` as their evidence basis.** Only GE Vernova and Vertiv rest on a primary filing
  read for this entry. The growth ranges are reasoned judgements with stated bases, **not measured
  figures**, and should be read as hypotheses for the rotation review to test.
- **No current prices or market caps.** `weekly_metrics.csv` ends at 2026-07-18. Every valuation
  reference here is three weeks stale, and no growth rate is a return without a price.
- **No scenario rows for any asset.** There is no bear/base/bull structure recorded for any of the
  twenty.
- **All 13 decision gates read `not_assessed`** for all five existing candidates. Nothing in this
  theme is eligible for decision review regardless of what the analysis above concludes.
- **Q2 2026 capex is filed for Amazon only** among the four. Microsoft's April–June quarter falls in
  its 10-K rather than a 10-Q, and Alphabet's and Meta's Q2 figures were not yet tagged in XBRL when
  this was written. The full-year guidance therefore cannot yet be tested against a half-year rate.
- **The ~$725B full-year aggregate remains press-sourced.** Q1 actuals are now primary, but the
  forward figure is not, and no issuer statement of it has been read.
- **Transformer and switchgear lead times are trade-press sourced.** Directionally consistent
  across several outlets, but not primary.

### 8. Research queue for this theme

1. **Collect Q2 2026 capex for Microsoft, Alphabet and Meta** as each becomes available, and test
   the half-year rate against the ~$725B full-year aggregate. Q1 actuals are recorded; the run-rate
   gap identified in §5.1 is now the cheapest high-value thing to watch in the whole theme.
2. Establish GE Vernova's historical slot-reservation conversion rate, if disclosed anywhere.
3. Find whether Vertiv's 10-Q or slide deck restores orders and backlog disclosure.
4. Read the NextEra S-4 for the Dominion merger terms and the regulatory conditions sought.
5. Quantify the data-centre revenue share at TT, HUBB and CMI. Three of the twenty are held on an
   assumption that has not been sized.
6. Get primary lead-time evidence for transformers — an issuer statement or a regulator filing,
   not trade press.
7. Begin gate 1 and 2 documentation for GEV, the name where primary evidence is deepest.

### 9. Position of this entry

**No action.** This entry establishes structure and a tracking list; it does not promote anything.
Nothing here changes a thesis status, and no candidate becomes eligible for decision review. The
correct next step is verification of eighteen unverified growth hypotheses, not conviction.

The theme's strongest single observation, if only one is carried forward: **a capacity auction that
clears at its price cap and still comes up short is not a market with a demand problem — it is a
market with a permission problem.** Whoever holds the permission, holds the economics.
