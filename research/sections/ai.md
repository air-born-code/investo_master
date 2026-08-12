# Artificial Intelligence — section note

Section deep dive. Started 2026-08-10. Newest entries appended; earlier entries are never revised.

This section is the parent of the AI themes. **The Age of Electricity now sits inside it**, together
with AI physical infrastructure, high-speed connectivity and advanced nuclear. Electricity is not a
separate story from AI in this store; it is the layer of the AI value chain where our exposure
happens to be concentrated, and naming it that way is the point of the restructure.

Related store rows: `data/sections.csv` (`ai`), `data/themes.csv` (`section_id = ai`),
`data/ai_value_chain.csv`, `data/ai_profit_pool.csv`, `data/sources.csv`.

---

## Entry 2026-08-10 — Where the dollar goes, and the layers we do not own

### 1. The source, and how much weight it can carry

iCapital, *Exhibit 2: Profits accumulate differently across AI value chain* — "Estimated profit
share of $1 in AI spend across the value chain", data as of July 2026. It is a Sankey diagram
tracing one dollar of end-user AI spend through the chain and marking where profit is extracted at
each stop.

**What it is.** A sell-side/allocator estimate built from public filings, earnings releases,
management commentary, industry research and media reporting, with company disclosures named for
Amazon, Alphabet, AMD, Broadcom, Nvidia, TSMC, SK Hynix, Micron, CoreWeave, Equinix and Digital
Realty. iCapital's own footer calls it illustrative.

**What it is not.** It is not measured, not primary, and not reproducible from the exhibit — no
methodology is shown for how a dollar of, say, Microsoft revenue is split between the model layer
and the cloud layer, and those allocations are where all the interesting judgement lives. Treat
every cent figure below as **one house's estimate on one date**, recorded so that later estimates
can be compared against it. It is a *frame*, and the frame is the useful part. The numbers are the
weakest part of it.

It reached us through a promotional social-media thread (@MelvinInvests, 2026-08-10) that ends in a
subscription pitch and a ticker list. The chart is worth taking seriously. The thread's stock
conclusions are marketing and are treated here as a lead, not evidence. Several of its supporting
claims — DeepSeek trained "30 times cheaper" than o1, memory reaching 25–30% of rack cost, buyers
choosing models "95% as capable at half the price" — are unsourced in the thread and are recorded in
`sources.csv` as unverified with an explicit verification task, not as facts.

### 2. The chart in one paragraph

A user pays **$1.00** to use a foundation model. Because the labs lose money, a further **17.3¢** of
external funding enters at the model layer, so **$1.173 flows into the chain against $1.00 of real
demand.** That money passes through hyperscaler clouds and pure neoclouds, then into data-centre
chips and servers on one side and data-centre equipment and facilities on the other. Profit is
extracted at eight points; several large flows exit the frame as spending with no profit box drawn
at all.

### 3. The profit boxes, and the arithmetic nobody in the thread does

| Layer | Profit per $1 of end-user spend |
|---|---:|
| Hyperscaler cloud | 29.7¢ |
| Commercial chips | 13.0¢ |
| Memory | 5.8¢ |
| Data-centre equipment (power, cooling, networking) | 3.8¢ |
| Foundry | 2.8¢ |
| Server OEM | 2.8¢ |
| Custom chips (ASICs) | 1.1¢ |
| Neocloud | 0.2¢ |
| **Total identified profit** | **59.2¢** |

Four things fall out of the table that are not in the commentary.

**3.1 The chain is not self-funding.** 17.3¢ of every $1.173 moving through it is investor capital,
not customer revenue. Roughly **15% of the flow is subsidy.** Every downstream profit figure —
including the 29.7¢ — is therefore partly a claim on venture and corporate balance sheets rather
than on end demand. If external funding stops, the chart does not shrink by 17.3¢ evenly; it shrinks
from the bottom of the stack upward, because the funded layer is the one placing the orders.

**3.2 The model layer has no profit box.** Foundation models are the only stop in the chain that
takes in more than $1 and books no profit. That is the whole finding, and it is the opposite of the
narrative most AI investing rests on: the layer closest to the intelligence captures the least.

**3.3 Construction spending, energy spending and leased/colo spending have no profit box either.**
The chart routes them out of frame. This does *not* mean those industries earn nothing — utilities
earn regulated returns and contractors earn margins. It means iCapital declined to attribute an
AI-specific profit pool to them. That editorial choice is the single most consequential thing in the
exhibit for this store, for reasons in §4.

**3.4 Neocloud economics are already visible as broken.** 0.2¢ on the dollar, against 29.7¢ for the
hyperscalers doing a superset of the same thing. Renting GPUs without owning the customer, the
model, the chip or the balance sheet is shown here as a business that clears roughly nothing. If
one number in this chart is directionally load-bearing and cheap to verify against filings, it is
this one.

### 4. What this says about our own universe — the uncomfortable part

Mapping our 52 tracked names onto the chart's layers (`data/ai_value_chain.csv`):

| Layer | Chart's profit | Names we track |
|---|---:|---:|
| Hyperscaler cloud | 29.7¢ | **0** |
| Commercial chips | 13.0¢ | 0 in GPUs; 8 in optical/interconnect adjacency |
| Memory | 5.8¢ | **0** |
| Foundry | 2.8¢ | **0** |
| Server OEM | 2.8¢ | 1 (SMCI) |
| Custom ASICs | 1.1¢ | 2 (AVGO, MRVL) |
| Equipment — power, cooling, networking | 3.8¢ | 12 |
| Construction / energy / colo spending | *no profit box* | 22 |
| Foundation models | *loss-making* | 0 |

**Twenty-two of fifty-two names sit in the boxes the chart draws as spending leaving the frame, and
zero sit in the box holding half the identified profit.** Our largest theme by membership, the Age
of Electricity with 24 asset links, maps almost entirely onto flows this exhibit does not credit
with AI profit at all.

There are two readings and intellectual honesty requires holding both:

**Reading A — the exhibit is incomplete and we are early.** It measures *AI-attributable* profit and
routes durable regulated and contractor earnings out of frame because they are not AI-specific. GE
Vernova's sold-out turbine slots and PJM clearing at its price cap are real scarcity rents that this
chart has no box for. On this reading our positioning is not wrong, it is simply invisible to a
value-chain lens, and the Age of Electricity note already argues the case for why permission and
slot scarcity, not demand, are where those returns come from.

**Reading B — we have systematically selected the thin layers.** The chart's implicit thesis is that
profit concentrates where the customer relationship, the balance sheet and the silicon converge, and
disperses toward the physical periphery. We hold the periphery. It is the part that is easiest to
identify, most crowded with obvious narratives, and — per the fibre analogue in the electricity note
— historically the part that gets the demand call right and loses money anyway.

**Neither reading is settled by this exhibit, and the store should stop being organised as though
Reading A is obviously true.** That is why AI becomes the parent section and electricity a layer
inside it: the layer's returns cannot be assessed without the chain above it.

### 5. Learnings carried forward

1. **Profit share and revenue share are different questions, and we have only been asking the
   second.** Every growth hypothesis in `growth_estimates.csv` is a revenue CAGR. None of them
   states what share of the AI profit pool the layer can hold. A layer can grow revenue 12% a year
   and still be a 0.2¢ business.
2. **Follow the subsidy.** 17.3¢ of external funding is the chain's least durable input. The single
   most valuable thing to track weekly is not demand — it is whether the loss-making layer keeps
   being funded.
3. **The falling-token-price argument cuts both ways and the thread only gives one side.** Cheaper
   tokens compress the model layer and expand the application layer; whether total spend rises
   depends on elasticity, which nobody in the thread establishes. Open-weight competition and
   enterprise price pushback are real forces, but "95% as capable at half the price" is an assertion
   we have not verified.
4. **The application layer is missing from the chart entirely.** The user paying $1.00 *is* the
   application. If cheaper intelligence is an input-cost decline, the beneficiary is the layer above
   the frame — and we track none of it.
5. **Concentration risk is now measurable.** With the mapping in `ai_value_chain.csv`, "we are
   diversified across 52 names" and "we are concentrated in two profit boxes worth 3.8¢ and nothing"
   can both be true, and the second is the one that matters.

### 6. What we now track weekly

`scripts/ingest-ai-chain.mjs` writes one dated row per layer per week to `data/ai_profit_pool.csv`.
It does **not** re-estimate the cents — those are frozen as a dated benchmark. It records the
observable proxies that would show the pool moving:

- aggregate market capitalisation of our tracked names in each layer, and its change on the week;
- median revenue growth and gross margin for the layer, where `weekly_metrics.csv` has them;
- the count of names carrying primary-filing evidence versus screen inference;
- the layers where we hold nothing, restated every week so the gap does not become invisible.

The test the series is built to run: **does profit move down the stack toward the physical layers as
the buildout matures, or does it stay concentrated at the top?** The exhibit is one observation of
that series. A single point is not a trend, which is exactly why it is being stored rather than
quoted.

### 7. Verification queue

1. Reproduce the 0.2¢ neocloud figure from CoreWeave's filed statements. Cheapest high-value check
   in the exhibit, and if it fails the whole allocation method is suspect.
2. Source the memory 25–30%-of-rack-cost claim to a primary disclosure — Micron or SK Hynix
   commentary, or a server BOM teardown. Currently an unattributed thread claim.
3. Source the DeepSeek "30× cheaper training" claim. The frequently-quoted comparison mixes a
   marginal training run against a total programme cost, and the two are not comparable.
4. Establish whether iCapital publishes the appendix its footer references, which would make the
   allocation method checkable rather than assertable.
5. Decide, explicitly and in writing, whether the absence of hyperscaler, memory and foundry
   coverage is a deliberate mandate choice or an unexamined drift. Then record the decision.

### 8. Position of this entry

**No action, one structural change.** No candidate is promoted, demoted or scored here. The change
is organisational: AI becomes the parent section, electricity becomes a layer within it, and the
profit-pool series starts this week so that in three months there is something to read.

The one observation to carry forward if only one: **we have built deep coverage of the layers this
chart says earn the least, and no coverage of the layer it says earns half of everything. That may
be right, but it has never been decided on purpose.**
