# Investo Master — Weekly Research System Plan

**Status:** Architecture decision, version 1  
**Date:** 2026-07-18  
**Purpose:** Define how weekly investment research will be stored, presented, archived, and delivered by email.

## 1. Product decision

Investo Master will have three connected layers:

1. **Research memory:** a transparent, version-controlled collection of related CSV files plus long-form Markdown theses.
2. **Publishing engine:** one validated data model that produces a rich archival report and a concise email edition.
3. **Delivery system:** a preview-and-approve workflow that sends the weekly edition to Gmail through Resend and records delivery status.

The weekly report is a new dated view of the research database, not a disposable document. Every claim, score, stage change, and thesis revision should be traceable through time.

## 2. CSV decision

### Recommendation

Use CSV for version 1, but **do not use one giant CSV file**. Use a small collection of related CSV files joined by stable IDs.

This gives us:

- Files that are human-readable and easy to inspect.
- Simple backups and clean Git history.
- Compatibility with Excel, Google Sheets, Python, and JavaScript.
- Append-only historical records rather than overwritten opinions.
- A straightforward future migration to SQLite or PostgreSQL.

A single CSV would mix assets, weekly measurements, sources, themes, and thesis changes. Those have one-to-many relationships and would create duplication, broken formulas, and difficult history tracking.

### When to migrate from CSV

Move the canonical store to SQLite when any two of these become true:

- More than roughly 500 actively monitored assets.
- Multiple people or processes write data concurrently.
- Joins and report generation become noticeably slow or fragile.
- We need transactions, user accounts, or a hosted dashboard.
- Schema changes become frequent.

CSV exports should remain available even after migration.

## 3. Proposed project structure

```text
Invest_o_master/
├── INVESTO_MASTER_PROMPT.md
├── WEEKLY_RESEARCH_SYSTEM_PLAN.md
├── README.md
├── config/
│   └── settings.example.json
├── data/
│   ├── assets.csv
│   ├── themes.csv
│   ├── asset_themes.csv
│   ├── weekly_metrics.csv
│   ├── scores.csv
│   ├── thesis_updates.csv
│   ├── sources.csv
│   ├── reports.csv
│   └── delivery_log.csv
├── research/
│   ├── companies/
│   ├── digital_assets/
│   └── themes/
├── reports/
│   └── YYYY/
│       └── YYYY-Www/
│           ├── report.md
│           ├── report.html
│           ├── email.html
│           ├── email.txt
│           └── charts/
├── templates/
│   ├── weekly-report/
│   └── weekly-email/
├── src/
│   ├── validate/
│   ├── report/
│   ├── charts/
│   └── email/
└── tests/
```

Long-form reasoning belongs in Markdown files. Repeated, sortable, comparable facts belong in CSV. Generated HTML should never be treated as the canonical research record.

## 4. CSV data model

All IDs are permanent lowercase slugs. Dates use ISO 8601. Numbers contain no currency symbols, percentage signs, or thousands separators. Each monetary value has an explicit currency or unit. Empty means unknown; zero means measured zero.

### `assets.csv`

One current identity record per asset.

```text
asset_id,symbol,name,asset_type,exchange,country,sector,industry,currency,website,stage,added_date,last_reviewed_date
```

Examples of `asset_type`: `equity`, `digital_asset`, `fund`, `commodity`.  
Examples of `stage`: `discovered`, `watchlist`, `researching`, `high_conviction`, `waiting_for_price`, `owned`, `rejected`, `thesis_broken`.

### `themes.csv`

One current record per structural theme.

```text
theme_id,name,summary,status,time_horizon,confidence,created_date,last_updated_date
```

### `asset_themes.csv`

Many-to-many link between assets and themes.

```text
asset_id,theme_id,role,relevance,notes,last_updated_date
```

`role` may be `platform`, `enabler`, `supplier`, `beneficiary`, `challenger`, or `at_risk`.

### `weekly_metrics.csv`

Append-only quantitative snapshot. One row per asset and report week.

```text
week_id,as_of_date,asset_id,price,currency,market_cap,enterprise_value,revenue_ttm,revenue_growth_yoy,gross_margin,operating_margin,free_cash_flow_margin,net_cash,valuation_metric,valuation_value,data_quality
```

Sector-specific metrics will be added deliberately rather than forcing every asset into the same financial template.

### `scores.csv`

Append-only Investo Master score history.

```text
week_id,as_of_date,asset_id,market_runway,moat,product_evidence,management,growth_economics,financial_strength,optionality,valuation_asymmetry,risk_falsifiability,total_score,evidence_quality,thesis_confidence,most_important_uncertainty,next_checkpoint
```

The system calculates `total_score`; it is never typed manually. A schema validator will enforce allowed ranges and verify that the weighted total is correct.

### `thesis_updates.csv`

Append-only decision journal.

```text
update_id,as_of_date,week_id,asset_id,change_type,thesis_status,summary,evidence_for,evidence_against,kill_criterion_status,next_question,author
```

Multiline CSV cells are technically valid but awkward to review. Entries should remain concise and link to a dated Markdown note when deeper reasoning is required.

### `sources.csv`

Claim-level evidence registry.

```text
source_id,as_of_date,asset_id,theme_id,source_type,title,publisher,published_at,accessed_at,url,is_primary,stance,claim,reliability
```

`stance` is `supports`, `challenges`, or `context`. No significant report claim should appear without a matching source record.

### `reports.csv`

One row per weekly edition.

```text
report_id,week_id,period_start,period_end,data_cutoff,status,generated_at,approved_at,approved_by,subject,archive_path
```

### `delivery_log.csv`

Append-only operational log.

```text
delivery_id,report_id,provider,recipient,attempted_at,status,provider_message_id,idempotency_key,delivered_at,error
```

Secrets, API keys, and private credentials must never be stored in CSV or committed to Git.

## 5. Presentation research findings

The best investment reports consistently use four ideas: **hierarchy, comparison, evidence, and change**.

The CFA Institute's Equity Research Report Essentials says an effective report should contain basic security information, a concise investment summary, an explanation of what is mispriced, valuation using more than one method, financial analysis, and explicit investment risks. It also warns against careless extrapolation and stresses reading financial-statement footnotes. We will adopt that analytical spine without forcing every weekly update into a conventional buy/sell report.

The SEC's Plain English guidance supports clear, concise, understandable communication. We will use short sentences, descriptive headings, active voice, concrete language, and definitions beside unfamiliar metrics.

The Financial Times Visual Vocabulary begins with the analytical relationship—change over time, deviation, ranking, distribution, correlation, magnitude, flow, or spatial pattern—and only then selects the chart. Investo Master will follow the same question-first method.

### Three reading depths

Each weekly edition must work at three speeds:

1. **30 seconds:** subject line, preheader, five key changes, and the conviction board.
2. **5 minutes:** theme radar, thesis upgrades/downgrades, new candidate, and risk dashboard.
3. **30+ minutes:** full cases, valuation scenarios, evidence, counterarguments, and source appendix.

The reader should never need to read the entire report to discover what matters.

## 6. Weekly report information architecture

### A. Cover and executive signal

- Week and data cut-off timestamp.
- One-sentence regime or structural-change summary.
- Five genuinely material changes.
- “What changed our mind” callout.
- Strongest opportunity, largest risk, and highest-value next question.

### B. Conviction board

A compact ranked table containing:

- Asset and theme.
- Pipeline stage.
- Total score and weekly change.
- Thesis direction: stronger, unchanged, weaker, or broken.
- Evidence quality.
- Valuation state.
- Next checkpoint.

### C. Structural change radar

Show themes rather than a generic market recap. Each theme receives:

- What changed this week.
- Why it matters over 5–10 years.
- First-, second-, and third-order beneficiaries.
- Evidence strength and disconfirming signal.

### D. New candidate or deep dive

Use a consistent investment memo:

1. Thesis in one sentence.
2. Why now.
3. Market and power-law potential.
4. Product/customer evidence.
5. Moat and management.
6. Economics and balance sheet.
7. What the price implies.
8. Failure modes.
9. Scenario range.
10. Falsification tests and monitoring plan.

### E. Thesis change log

Display upgrades, downgrades, stage changes, triggered kill criteria, and unanswered questions. Show the previous view beside the current view when possible.

### F. Valuation and scenarios

Present Failure, Bear, Base, Bull, and Generational cases with assumptions, probability ranges, and implied outcomes. Emphasise the variables that drive the result; do not decorate a fragile model with precision.

### G. Source appendix

Every chart and material claim receives a visible source and date. Separate primary evidence from commentary and Investo Master inference.

## 7. Visual language

### Design character

The visual style should feel like a high-quality investor letter crossed with an excellent financial newspaper: calm, authoritative, spacious, and information-dense without feeling crowded.

- Warm off-white background rather than pure white where supported.
- Deep navy or charcoal text.
- One restrained blue accent.
- Green, amber, and red only for semantics, always accompanied by text or an icon.
- Serif display face for editorial headings where safe; highly readable system sans-serif for body copy and tables.
- Monospaced numerals for aligned financial data when supported.
- Generous spacing and thin rules instead of heavy boxes.
- No gradients, 3D charts, gauges, decorative stock photos, or unexplained icons.

### Chart grammar

- **Change through time:** indexed line chart, small multiples, or sparkline.
- **Rank and magnitude:** sorted horizontal bar or dot plot.
- **Change between two dates:** slope chart.
- **Actual versus expectation:** variance bar or bullet-style comparison.
- **Valuation scenarios:** range bars with clearly labelled assumptions.
- **Contribution to a total:** waterfall when the components genuinely reconcile.
- **Relationship:** scatterplot with a warning that correlation is not causation.
- **Scores:** aligned horizontal bars; avoid radar charts.

Every chart must have a takeaway title, direct labels, units, period, source, and an annotation for the important event. Use the fewest series needed to answer the question.

### Email constraints

The email edition is not a miniature website. It should be a single-column, approximately 600–640px layout that remains understandable when images are blocked. Charts should be static PNGs with useful alternative text; important figures must also appear in text or tables. A plain-text edition will be generated alongside HTML.

## 8. Publishing outputs

One validated weekly report model will generate:

1. `report.md` — durable, diffable canonical narrative.
2. `report.html` — full, responsive archival reading experience.
3. `email.html` — Gmail-safe executive edition.
4. `email.txt` — accessible plain-text fallback.
5. `charts/*.png` — static, source-labelled report graphics.

The email should summarise and link to the full archive once an archive is hosted. Until then, it can contain the complete report or attach a PDF as an optional secondary format. HTML remains the primary reading format because it works better on mobile and permits accessible links.

## 9. Recommended technical stack

Version 1 should use TypeScript and Node.js:

- CSV parsing and writing with strict schemas.
- Zod-style validation before any report is generated.
- React Email for reusable, tested email components.
- Resend's Node SDK for delivery.
- Static chart generation to PNG for email compatibility.
- Unit tests for scores, joins, required sources, dates, and report completeness.

React Email supports rendering the same component to HTML and plain text. It also provides email-client-tested components, while warning that many CSS styles are not portable across email clients. This supports a restrained design system instead of fragile web-style layouts.

## 10. Resend delivery design

### Setup

1. Create a Resend account.
2. For testing, send only to the account owner's email using Resend's test sender.
3. For production, verify a domain or dedicated subdomain such as `research.example.com`.
4. Configure SPF and DKIM; add DMARC for additional trust.
5. Store `RESEND_API_KEY`, recipient, sender, and schedule as environment secrets—not in source files.

Resend recommends using a subdomain to isolate sending reputation. The recipient can be Gmail, but the sender should be a verified domain controlled by the project owner.

### Weekly workflow

```text
Update CSV + research notes
        ↓
Validate schema, sources, scores, and dates
        ↓
Build Markdown, HTML, text, and PNG charts
        ↓
Run content and visual quality checks
        ↓
Send preview to Gmail
        ↓
Human approval
        ↓
Send/schedule final email with an idempotency key
        ↓
Record Resend message ID and delivery result
```

An idempotency key based on the report ID prevents accidental duplicate sends. Resend supports HTML, text, React, attachments, scheduling, and idempotency keys. Webhooks can later record delivered, bounced, delayed, failed, opened, and clicked events. Delivery and bounce state matter; open tracking is less reliable and should not be treated as investment-product success.

### Automation choice

Begin with a human-approved command-line send. After four reliable weekly cycles, add a scheduled runner such as GitHub Actions or a hosted cron job. The automation should build a draft early, require approval, and send only a frozen report version.

Resend scheduling is useful for an individual edition; a recurring weekly pipeline still needs an external scheduled trigger.

## 11. Quality gates before sending

A report cannot be sent if any required check fails:

- Data cut-off date is missing.
- A material claim lacks a source.
- A score is outside its permitted range or total is incorrect.
- An asset or theme ID is missing from its parent table.
- A valuation chart lacks assumptions or units.
- Bull and bear cases are absent for a featured candidate.
- HTML or plain-text output is empty.
- The recipient, sender, or report ID is missing.
- The report ID already has a successful send recorded.
- Links fail validation.

Visual QA should include Gmail desktop, Gmail mobile-width preview, images-disabled mode, dark-mode approximation, and plain text.

## 12. Implementation phases

### Phase 1 — Research memory

- Create directories and CSV schemas.
- Add example rows and validation rules.
- Create a command that validates the complete dataset.
- Establish the dated report archive.

### Phase 2 — Beautiful report prototype

- Build one realistic sample weekly report.
- Test the three reading depths.
- Define typography, colour, tables, callouts, and core charts.
- Render and visually inspect the HTML and email outputs.

### Phase 3 — Resend integration

- Add environment configuration.
- Build preview and production send commands.
- Add idempotency and delivery logging.
- Verify a production sending domain.

### Phase 4 — Weekly automation

- Add a scheduled draft build.
- Add approval and frozen-version checks.
- Capture delivery webhooks.
- Review the process after four editions.

### Phase 5 — Scale when earned

- Add automatic market and filing ingestion.
- Add richer source monitoring and alerts.
- Migrate canonical data to SQLite if the defined triggers are reached.
- Add a hosted searchable report archive.

## 13. Immediate next build

The next implementation step should complete Phase 1 and create a small demonstration dataset. It should not yet send email. The first milestone is:

> A validated CSV research store that can generate a complete sample weekly report from reproducible inputs.

## Sources consulted

- [CFA Institute — Equity Research Report Essentials](https://www.cfainstitute.org/sites/default/files/-/media/documents/support/research-challenge/challenge/rc-equity-research-report-essentials.pdf)
- [U.S. SEC — A Plain English Handbook](https://www.sec.gov/files/handbook.htm)
- [Financial Times — Visual Vocabulary](https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/README.md)
- [React Email — Render HTML and plain text](https://react.email/docs/utilities/render)
- [React Email — Tailwind and email-client limitations](https://react.email/docs/components/tailwind)
- [Mailchimp — Email design reference](https://templates.mailchimp.com/design/)
- [Mailchimp — Mobile email behaviour](https://mailchimp.com/help/campaign-behavior-on-mobile/)
- [Resend — Send Email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend — Managing sending domains](https://resend.com/docs/dashboard/domains/introduction)
- [Resend — Gmail deliverability guidance](https://resend.com/docs/knowledge-base/how-do-i-avoid-gmails-spam-folder)
- [Resend — Webhook event types](https://resend.com/docs/webhooks/event-types)
