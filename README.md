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
