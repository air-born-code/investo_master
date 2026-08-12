# Investo Master

Investo Master is a long-term investment research system built to identify rare, generational opportunities. It conducts research every week while expecting investment decisions to be extremely infrequent.

The project is designed around a simple operating principle:

> Study continuously. Wait without discomfort. Act rarely. When evidence, asymmetry, and price align, act with earned conviction—then keep testing the thesis as if we might still be wrong.

## Current stage

Issue 001 established the operational baseline. Version 1 now provides:

- A transparent CSV-based research store.
- Long-form company, asset, and theme theses in Markdown.
- Append-only weekly metrics, scores, sources, and thesis changes.
- A polished weekly HTML investment overview.
- A permanent archive of historical weekly reports.
- Preview-first delivery to the owner's Gmail through Resend.
- A formula-checked Excel audit workbook generated from the canonical CSV files.

## Governing documents

- [Core research prompt](./INVESTO_MASTER_PROMPT.md)
- [Patience and conviction policy](./CONVICTION_POLICY.md)
- [Weekly research system plan](./WEEKLY_RESEARCH_SYSTEM_PLAN.md)
- [Research source master prompt](./RESEARCH_SOURCE_MASTER_PROMPT.md)

## Research philosophy

Weekly publication does not imply weekly action. The normal conclusion is **no action**. Candidates may be studied for years before reaching decision review.

The system separates:

- An interesting story from a supported thesis.
- Business quality from investment attractiveness.
- High conviction from actionable valuation.
- Research conviction from position sizing.
- Temporary volatility from permanent impairment.

Every important thesis must include primary evidence, a serious bear case, explicit falsification criteria, valuation scenarios, and a pre-mortem.

## Sections

Themes sit inside sections, defined in `data/sections.csv`. Sections are the top level of the
taxonomy and the level at which the weekly issue is organised.

| Section | Contains | Central question |
| --- | --- | --- |
| `ai` | Age of Electricity, AI physical infrastructure, high-speed connectivity, advanced nuclear | Where in the AI value chain does profit accumulate, and are we in those layers? |
| `digital-assets` | Stablecoin payment rails, agentic commerce | Does the agent economy need a new settlement layer, or does it net off-chain? |
| `industrial-frontier` | Vertically integrated space, critical minerals security | Independent structural change, or second-order AI demand? |

**Electricity is a layer of the AI section, not a peer of it.** The site nests it under AI, the
issue writes it that way, and the reason is in `research/sections/ai.md`: the returns available to
a turbine maker cannot be assessed without the chain above it, which decides how much money reaches
that layer at all.

### The AI profit pool

`data/ai_value_chain.csv` maps the chain's layers and which of our names sit in each.
`npm run ingest:ai` writes one dated row per layer per week to `data/ai_profit_pool.csv`.

The benchmark profit-per-dollar figures come from a single iCapital exhibit dated July 2026. They
are **frozen as a dated reference point and never recomputed** — the exhibit publishes no allocation
methodology, so treating it as a measurement would put a made-up precision into the store. What the
weekly run updates is our own observable position: aggregate market value per layer, its change, the
layer's median growth, and — restated every week so it cannot become invisible — the layers we hold
nothing in.

The mapping's finding, as at 2026-W33: **7.7¢ of every AI dollar lands in layers we cover directly,
13.0¢ in a layer we touch only adjacently, and 38.5¢ in layers we do not track at all**, including
the largest single slice in the chain. Nineteen of our names sit in flows the exhibit draws as
spending leaving the frame with no profit box drawn.

### Digital-asset rails

`data/crypto_rails.csv` maps the settlement stack. `npm run ingest:crypto` writes
`data/agent_traffic.csv` weekly from public stablecoin supply data.

The section tracks the float, not the narrative: supply grows only if somebody funds it, so unlike
announcements, TVL and token prices it cannot be talked up. Token prices are deliberately excluded
as a thesis input. If the API is unreachable the run exits non-zero and leaves a gap in the series
rather than writing an estimate.

The section holds **zero tracked names**, which is a finding rather than a gap to be filled quietly.
Rows whose `data_quality` begins with `UNVERIFIED` are second-hand reports of management statements
recorded as a dated baseline to check against; they may be cited as claims, attributed, and never as
evidence. `research/sections/digital-assets.md` sets out where the thread that opened the section
does not survive checking.

## The frontier tier

Active themes describe what is already investable. A separate and deliberately lower-quality tier tracks what might become a theme, on the argument that the two largest waves of the last twenty-five years — the internet and AI — were both publicly observable for years before attention arrived, and that attention itself is a lagging indicator.

It has three levels, each with a different bar for entry:

| File | Holds | Test for entry |
| --- | --- | --- |
| `data/fringe_watch.csv` | Niche ideas with a working artifact and a small technical community | Deliberately none. Bitcoin in 2009 would have failed every conventional screen, so this level applies no precondition test at all. |
| `data/candidate_themes.csv` | Possible next themes | Five preconditions, each a field: a measurable cost curve, a general-purpose substrate, a threshold that unlocks mass interaction, cheap distribution, and a physical bottleneck. Rows record where they fail, not only where they pass. |
| `data/themes.csv` | Active themes | The existing research standard. |

Supporting files:

- `data/cost_curves.csv` — the hand-authored curves. If a candidate has no nameable curve and unit, it is a story rather than an exponential. Rows with no defensible series are left unauthored rather than filled with a plausible guess.
- `data/dead_themes.csv` — the graveyard, with a post-mortem naming which precondition broke. Most candidate exponentials fail, and the failure modes rhyme; without this file every candidate gets pattern-matched to the two that worked.
- `data/signal_registry.csv` and `data/theme_signals.csv` — what is instrumented, and the append-only readings. Build with `npm run ingest:signals`.
- `data/frontier_policy.csv` — regulatory motion against candidate and fringe entries, written by `npm run ingest:policy`. This pass reads proposed and final agency rules as well as presidential documents, because a field becomes legible to a regulator in rulemaking years before it reaches a presidential document. It writes to its own file and never to `sources.csv`.

`npm run frontier:next` reviews one entry a month, oldest first, in the same rotation discipline as the asset review. Every frontier prompt carries the graveyard and a confirmed theme's signal readings alongside the entry's own, so the assessment is forced to name which dead theme the candidate resembles and to read its growth rate against a reference case rather than in isolation. Concluding that an entry should be rejected is a good outcome; a file that never removes anything is a collection rather than an instrument.

This tier is intentionally isolated from the weekly research store. It writes nothing to `sources.csv`, and every consumer — the issue prompt, the workbook, the site — reads an explicit list of filenames rather than globbing `data/`, so speculative material cannot reach the evidence base by accident.

## Coverage and rotation

An issue is not a fixed list of names. The store holds two tiers and they appear in
the issue on different terms:

- **Candidate tier** — standing coverage. Every issue carries these as one compressed
  line each: score, movement against the last issue that carried them, market cap.
- **Coverage tier** — rotates. Each issue gives a few of these a real write-up,
  drawn longest-waiting first, so every name is read on a fixed cycle and none is
  permanently in or permanently out.

`data/coverage.csv` is the ledger that makes this work. One row per asset per slot
per week, written by `npm run issue:build`:

| Column | Meaning |
| --- | --- |
| `slot` | `core` (standing), `rotation` (write-up), `entered`, `dropped` |
| `score` / `score_week` | The score as shown and the week it was struck, so staleness stays visible |
| `weeks_since_covered` | Gap since the last time the name was written about |
| `note` | One line on why it appeared |

Only `core` and `rotation` count as coverage. Entering the store is a database
event, not editorial attention — otherwise a bulk screen import would mark fifty
names as covered in one week and starve the rotation for months.

Selection lives in `scripts/lib/rotation.mjs` and is deterministic: rebuilding a
week reproduces exactly what it picked. `npm run research:next` walks the same
queue, so the midweek deep dive prepares the name the next issue will publish.

The rotation queue and the week-by-week grid are on the site's Coverage page. A row
of solid marks across every week is a name the issue cannot stop talking about.

## Email and site

The email is a digest; the site carries the depth. Gmail clips a message at roughly
102KB and Issue 003 reached 91KB, so a single document that grows every week was
already close to being truncated mid-issue.

The email carries the narrative, the standing line, the week's rotation and the
current regime readings. The ten-year charts, the transmission notes, the full
board and the evidence registry live on the site — they are reference material that
does not change week to week. `report.html` in the archive still contains everything.

Set `SITE_URL` so the email can link to the depth pages. Without it the email names
them but does not link, which is correct behaviour for a local-only build.

## Planned structure

```text
Invest_o_master/
├── data/                   # Structured CSV research memory
├── research/               # Long-form company, asset, and theme work
├── reports/
│   └── YYYY/
│       └── YYYY-Www/       # One permanent weekly edition
├── templates/              # Web and email presentation components
├── src/                    # Validation, reporting, charts, and delivery
└── tests/                  # Data and publishing quality gates
```

Each weekly report folder is expected to contain:

```text
report.json                 # Issue metadata and send approval
report.md                   # Canonical narrative
report.html                 # Full archival article
email.html                  # Gmail-safe edition
email.txt                   # Plain-text fallback
baseline-research.xlsx      # Human-friendly audit workbook
charts/                     # Static, source-labelled graphics
```

## Future website

The same repository can later publish a static website containing:

- A home page with the latest weekly overview.
- A chronological archive linking to every historical weekly article.
- Theme pages showing how structural theses evolved.
- Company and asset pages with dated thesis histories.
- A conviction board and decision journal.
- Source-linked charts and scenario histories.

The website should be generated from the same Markdown and CSV files used for email. The public presentation layer must never become a second, conflicting research database.

Before a website is deployed, access and privacy requirements must be decided. Research reports should be treated as private unless explicitly approved for publication.

## Email delivery

Initial delivery uses Resend's test sender to email the Resend account owner's Gmail address. No custom domain is required for this personal workflow.

Secrets such as `RESEND_API_KEY`, recipient addresses, and scheduler tokens must be stored in local or hosted environment variables. They must never be committed to this repository.

Issue 001 can be rebuilt and checked with:

```bash
npm run data:build:baseline
npm run report:build:baseline
npm run report:check:baseline
```

After human review, the approved issue can be sent with:

```bash
npm run report:send:baseline
```

## Scheduling

Keep the next one or two issues manual while the editorial and data workflow settles. A local Codex scheduled task requires the Mac to be powered on and the Codex desktop app running. For genuinely independent delivery with the Mac off, move the weekly job to a hosted runner such as GitHub Actions and store the Resend credentials as hosted secrets.

## Roadmap

1. Complete several reliable weekly cycles using the Issue 001 baseline.
2. Refine the valuation framework and candidate score history.
3. Add hosted scheduled delivery after the workflow is stable.
4. Build the historical report website when the content model is stable.

## Safety boundary

Investo Master performs research and decision support. It does not execute trades, promise returns, or replace personalised financial, tax, or legal advice. The human investor retains responsibility for every decision.
