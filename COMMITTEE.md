# Investo Master — Review Committee

**Adopted:** 2026-08-16
**Status:** Governing editorial control
**Applies from:** issues dated 2026-W33 onward

## Why the committee exists

The weekly issue is drafted by a model reading the research store. Every check on it
until now was applied by the same model that wrote it: the evidence rules, the
anti-bias rules and the conviction gates all live in the prompt the drafter reads.
That catches carelessness. It does not catch a draft that reasons its way somewhere
wrong, because the reasoning and the check share every assumption.

The committee is a second reading by seats that do not share those assumptions. It
runs **before an issue is sent**, and it can stop delivery.

It is not a quality-assurance pass on prose. It exists to find the argument the issue
did not know it was making.

## What a seat is

`data/committee.csv` holds nineteen seats. Each is a **documented investment method**
— the capital cycle, expectations arithmetic, forensic accounting, owner earnings —
attached to the practitioner whose published work defines it, with:

| Field | Holds |
| --- | --- |
| `method` | The method in one sentence |
| `review_questions` | The standing questions that seat asks of any issue |
| `catches` | The failure this seat is best placed to find |
| `does_not_transfer` | Mechanics that depend on being a different kind of investor |
| `blind_spot` | Where this seat is systematically wrong, stated so it can be discounted |
| `discipline` | `macro`, `valuation`, `quality`, `forensic`, `frontier` |

### The impersonation boundary

**A seat is a method, not a person speaking.** A memo is the output of applying a
documented method to this week's issue. It is never a claim about what a named
investor thinks, holds, or would say about a security.

Concretely, and enforced in the review prompt:

- Memos are written as the seat, not in the first person as the practitioner.
- No invented quotations, ever.
- No memo text is quoted into a sent issue as endorsement, and the roster is not a
  list of advisers to this newsletter. Nobody on it knows it exists.
- Two seats are historical (Fisher died in 2004, Munger in 2023). They are schools of
  method and are marked `historical` in the roster.

This follows the rule already governing `strategies/`: borrow the reasoning, never the
positions, and state what does not transfer.

### What the roster is not

It is not a ranking, and it is not complete. It skews Anglo-American, and toward
practitioners who published their method rather than practitioners who had one — which
is a selection on disclosure, not on skill. Nineteen seats is a starting point; the
absence is recorded here rather than left to be discovered.

## How a review panel is chosen

`npm run review:panel` shows the week's panel, the seats skipped for having sat on the
draft, and the queue behind it.

Three or four seats review each issue. Selection is deterministic and
longest-waiting-first, the same discipline as the asset and evidence rotations: a seat
cannot be quietly dropped because its questions are inconvenient, and rerunning a week
picks the same panel.

The panel is **composed**, not sampled:

1. One `macro` seat.
2. One `valuation` seat.
3. One `quality` seat.
4. The longest-waiting remaining seat — **except** when the issue proposes a decision
   review, where the fourth chair goes to a `forensic` seat. That is the week the file
   is closest to spending money, and the week an unexamined assumption is most
   expensive.

At four seats a week, nineteen seats cycle in five issues.

## Severity, and what each one does

| Severity | Means | Effect |
| --- | --- | --- |
| `blocking` | Must not be sent as written | **Stops delivery** until a human resolves it |
| `material` | Publishable, but the argument is wrong or unexamined | Recorded; the chair decides |
| `minor` | Clarity, structure, a missing attribution that changes nothing | Recorded |

`blocking` is deliberately narrow. It is reserved for: a figure that does not appear in
the store; a claim contradicted by the row cited for it; an `UNVERIFIED` row used as
evidence rather than named as a claim; a decision review proposed with an outstanding
gate; language that reads as personalised advice or as a guarantee; a benchmark
estimate presented as a measurement.

A panel that never returns an empty findings list is a panel nobody can trust. "This
section is sound, and here is the test it passed" is a useful memo.

## The chair

The chair is the human reader. Only the chair closes a finding, for the same reason
only a human closes a reader comment: a model may not decide that its own objection has
been met, and neither may the model that answered it.

```bash
npm run review:resolve -- fnd-2026-W33-chanos-01 --status fixed --note "what changed"
```

- `fixed` — the issue was changed.
- `accepted` — the point stands and it publishes anyway, with the reason recorded.
- `rejected` — the finding is wrong, and why.

`--note` is required. A finding closed without a reason leaves no record of the
judgement, which is the only thing the ledger exists to preserve. Findings are never
deleted. A re-review supersedes an open finding rather than removing it.

## Where it sits in the week

The committee sits twice, at the two points where a seat can change something.

```text
ingest → COMMITTEE (drafting panel) → draft → build issue
                                                   │
                       ┌── fixes ──────────────────┤
                       │                           ↓
                       └──────────  COMMITTEE (review panel) → human approval → send
```

**Drafting panel.** Seats are rendered into the drafting prompt, so the draft is
written against their questions instead of being marked against them afterwards.
Selection is stateless — `scripts/lib/committee.mjs`, ordered by `member_id` and
walked by absolute week number — because `draft-issue.mjs` writes no CSV and so has no
ledger to rotate against. The draft records what each seat changed in its Committee
review section. Flags: `--committee <ids>`, `--committee-size <n>`, `--no-committee`.

**Review panel.** Seats read the built `report.md`, because that is what actually goes
out, and their findings are recorded and gate the send. `--draft` points the panel at
`drafts/<week>.md` instead, which is the right target when the narrative is still being
fixed. Selection is ledger-driven and longest-waiting-first, in `review-issue.mjs`.

**A seat never does both jobs in one week.** The review panel reproduces that week's
drafting panel and skips those seats: a seat that shaped the draft reviewing it is the
same method marking its own work, which is the failure the committee exists to prevent.
The skip yields only if it would leave a discipline bucket empty — an unbalanced panel
is the worse outcome.

> **Operator footgun.** The exclusion is computed, not recorded, so
> `--committee-size` on the draft and `--draft-seats` on the review must agree. If you
> draft with a non-default panel size, pass the same number to `review:issue`, or the
> wrong seats are skipped. A draft run with pinned seats (`--committee`) cannot be
> detected from the review side at all; skip the overlap by hand with `--member`.

Two independent gates stand between a blocking finding and a reader:
`scripts/check-report.mjs` fails validation, and `scripts/send-report.mjs` re-reads the
ledger itself rather than trusting that validation ran.

The durable record is `data/committee_findings.csv`, not `report.json`. `build-issue.mjs`
regenerates `report.json` on every rebuild — and a rebuilt issue should be re-reviewed
anyway.

## Commands

| Command | Does |
| --- | --- |
| `npm run review:panel` | Show this week's review panel, the seats skipped as drafters, and the queue |
| `npm run review:issue` | Run the panel over the current issue via the API |
| `npm run review:issue:dry` | Prompt sizes and panel, no API call |
| `npm run review:issue:prompt` | Write the prompts to `reviews/<week>/` to run by hand for free |
| `npm run review:record -- <member_id>` | Record a hand-run memo into the ledger |
| `npm run review:list` | Open findings, worst first |
| `npm run review:resolve -- <id> --status fixed --note "..."` | Close one |

`REVIEW_MODEL` selects the model, separately from `OPENROUTER_MODEL` and
`EVIDENCE_MODEL`. Reviewing is the hardest thing this repository asks of a model and
the one place a cheap one fails invisibly, by returning a plausible memo with nothing
in it. A single shared variable would mean economising anywhere economises here.

## Safety boundary

The committee is an internal editorial control. It does not make investment decisions,
it does not approve issues — approval remains a human step — and no seat's memo is
advice from the person whose method it applies.
