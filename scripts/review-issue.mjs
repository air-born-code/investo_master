#!/usr/bin/env node
// Review committee: puts three or four seats over an issue before it is sent.
//
// The drafter and the reviewer are the same model reading the same store, so a
// draft that talks itself into something has nothing standing between it and the
// reader. This script is that something. Each seat is a documented investment
// method — data/committee.csv — applied as a question set, not as an impersonation:
// a memo is the output of a SEAT, never a claim about what a named person thinks,
// and no memo text is ever quoted into the issue as endorsement. COMMITTEE.md is
// the charter.
//
// Selection is deterministic and longest-waiting-first, the same discipline as the
// asset and evidence rotations: a seat cannot be quietly dropped because its
// questions are inconvenient, and rerunning a week picks the same panel. The panel
// is composed rather than sampled — one macro seat, one valuation seat, one quality
// seat — because a panel drawn purely by age can arrive as three macro thinkers in
// a week that introduces a new company.
//
// Findings land in data/committee_findings.csv and are keyed to the issue. A
// `blocking` finding stops the send until a human resolves it: check-report.mjs
// fails the send gate and send-report.mjs independently refuses. Nothing here can
// close its own finding — that is a human step, for the same reason a reader
// comment stays open until a human closes it.
//
// The CSV is the durable record, not report.json: build-issue.mjs regenerates
// report.json on every rebuild, and a rebuilt issue should need re-reviewing
// anyway.
//
// Usage:
//   npm run review:panel                     show this week's panel and stop
//   npm run review:issue                     run the panel via the API
//   npm run review:issue -- --emit-prompt    write the prompts, run them by hand for free
//   npm run review:issue -- --dry-run        show sizes and cost surface, call nothing
//   npm run review:list                      open findings, worst first
//   npm run review:resolve -- <finding_id> --status fixed --note "..."
//
// Options:
//   --seats <n>        panel size (default 4)
//   --member <id>      force one seat onto the panel
//   --week <id>        review a specific week (default: newest issue, else this week)
//   --draft            review drafts/<week>.md even when a built issue exists
//   --force            re-review a seat that already reviewed this week
//   --root <path>      project root (default: cwd)

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_PANEL_SIZE, selectPanel } from './lib/committee.mjs';
import { formatUsd, recordCost } from './lib/cost.mjs';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  const v = argv[i + 1];
  return i === -1 || v === undefined || v.startsWith('--') ? undefined : v;
};

const root = path.resolve(flag('root') ?? process.cwd());
const dryRun = has('dry-run');
const force = has('force');
// Reviewing is adversarial synthesis over a whole issue — the hardest thing this
// repository asks a model to do, and the one place a cheap model fails invisibly by
// producing a plausible memo with no finding in it.
//
// So this seat is the deliberate exception to the 2026-08-16 move to a cheap model.
// Everything else in the pipeline drafts and reads on deepseek-v4-pro; the panel
// stays on a strong one. The reason is asymmetry, not quality in the abstract: a
// weak DRAFT is visible to a human reader before it is sent, while a weak REVIEW
// looks exactly like a clean issue. Only one of those two failures announces itself,
// and the committee exists to catch what the draft could not see about itself.
//
// At four seats it costs roughly $0.38 an edition more than the cheap model. That is
// the whole price of the check.
//
// Note what dominates that number. Each seat's prompt is ~61k tokens and only ~6k of
// it is the issue under review; the rest — master prompt, conviction policy, roster,
// store context — is identical across all four seats and is paid for four times.
// Prompt caching on a shared prefix would cut more from this stage than any further
// model downgrade, and without giving up the reader.
//
// The residual risk is still not zero, and it is not detectable in one issue: an
// empty findings list is a legitimate result. Watch the RATE across issues. A panel
// that stops finding anything has either fixed the file or stopped reading, and only
// the trend says which — `npm run review:list` and the findings ledger are where
// that shows up.
const model = process.env.REVIEW_MODEL || 'anthropic/claude-sonnet-5';
const now = new Date().toISOString();

const read = (...p) => readFile(path.join(root, ...p), 'utf8');

// --- csv ----------------------------------------------------------------------
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
};

const toObjects = (rows) => {
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((k, i) => [k, cells[i] ?? ''])));
};

const csvCell = (v) => (/[",\n\r]/.test(String(v ?? '')) ? `"${String(v).replaceAll('"', '""')}"` : String(v ?? ''));
const toCsv = (header, rows) =>
  `${[header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\n')}\n`;

const REVIEW_HEADER = [
  'review_id', 'week_id', 'report_id', 'member_id', 'seat', 'artifact',
  'model', 'verdict', 'findings_total', 'findings_blocking', 'summary', 'reviewed_at',
];
const FINDING_HEADER = [
  'finding_id', 'week_id', 'report_id', 'member_id', 'severity', 'section',
  'finding', 'fix', 'evidence', 'status', 'resolution_note', 'resolved_by',
  'resolved_at', 'recorded_at',
];

const reviewsPath = path.join(root, 'data', 'committee_reviews.csv');
const findingsPath = path.join(root, 'data', 'committee_findings.csv');

const [roster, reviews, findings] = await Promise.all([
  read('data', 'committee.csv').then(parseCsv).then(toObjects),
  readFile(reviewsPath, 'utf8').then(parseCsv).then(toObjects).catch(() => []),
  readFile(findingsPath, 'utf8').then(parseCsv).then(toObjects).catch(() => []),
]);

const SEVERITY_ORDER = ['blocking', 'material', 'minor'];

// --- listing ------------------------------------------------------------------
if (has('list')) {
  const open = findings.filter((f) => f.status === 'open');
  if (!open.length) {
    console.log('No open committee findings.');
    process.exit(0);
  }
  open.sort((a, b) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    || a.finding_id.localeCompare(b.finding_id));
  console.log(`${open.length} open finding(s):\n`);
  for (const f of open) {
    console.log(`  ${f.finding_id}  [${f.severity.toUpperCase()} · ${f.member_id} · ${f.section || 'general'}]`);
    console.log(`    ${f.finding}`);
    if (f.fix) console.log(`    fix: ${f.fix}`);
    console.log('');
  }
  const blocking = open.filter((f) => f.severity === 'blocking').length;
  console.log(blocking
    ? `${blocking} blocking finding(s) — the send gate will refuse until these are resolved.`
    : 'No blocking findings. The send gate is clear on the committee check.');
  process.exit(0);
}

// --- resolving ----------------------------------------------------------------
// Only a human closes a finding. The model that raised it cannot decide that its
// own objection has been met, and neither can the model that answered it.
const resolveId = flag('resolve');
if (resolveId) {
  const target = findings.find((f) => f.finding_id === resolveId);
  if (!target) {
    console.error(`No finding with id ${resolveId}.`);
    process.exit(1);
  }
  const status = flag('status') ?? 'fixed';
  const allowed = ['fixed', 'accepted', 'rejected'];
  if (!allowed.includes(status)) {
    console.error(`--status must be one of: ${allowed.join(', ')}`);
    console.error('  fixed    — the issue was changed');
    console.error('  accepted — the point stands, and it publishes anyway with the reason recorded');
    console.error('  rejected — the finding is wrong, and why');
    process.exit(1);
  }
  const note = flag('note');
  if (!note) {
    console.error('--note is required. A finding closed without a reason leaves no record of the judgement.');
    process.exit(1);
  }
  target.status = status;
  target.resolution_note = note;
  target.resolved_by = flag('by') ?? process.env.USER ?? 'chair';
  target.resolved_at = now;
  if (dryRun) {
    console.log(`--dry-run: would mark ${resolveId} ${status}`);
  } else {
    await writeFile(findingsPath, toCsv(FINDING_HEADER, findings), 'utf8');
    console.log(`${resolveId} → ${status} (${target.resolved_by})`);
  }
  process.exit(0);
}

// --- what is being reviewed ----------------------------------------------------
const isoWeekId = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const issueDirs = async () => {
  const out = [];
  const years = await readdir(path.join(root, 'reports'), { withFileTypes: true }).catch(() => []);
  for (const y of years) {
    if (!y.isDirectory()) continue;
    const dirs = await readdir(path.join(root, 'reports', y.name), { withFileTypes: true }).catch(() => []);
    for (const d of dirs) {
      const m = d.isDirectory() && d.name.match(/^(\d{4}-W\d{2})-issue-(\d+)$/);
      if (m) out.push({ dir: path.join(root, 'reports', y.name, d.name), week_id: m[1], issue: m[2] });
    }
  }
  return out.sort((a, b) => a.week_id.localeCompare(b.week_id));
};

const issues = await issueDirs();
const wantWeek = flag('week');
const issue = wantWeek ? issues.find((i) => i.week_id === wantWeek) : issues.at(-1);
const weekId = wantWeek ?? issue?.week_id ?? isoWeekId(new Date());

// The built issue is what actually goes out, so it is the default subject. The
// draft is the right subject when there is no build yet, or when the point is to
// fix the narrative before it is built.
let artifact;
let artifactLabel;
let reportId = '';
if (!has('draft') && issue) {
  artifact = await readFile(path.join(issue.dir, 'report.md'), 'utf8').catch(() => undefined);
  if (artifact) {
    artifactLabel = path.relative(root, path.join(issue.dir, 'report.md'));
    reportId = await readFile(path.join(issue.dir, 'report.json'), 'utf8')
      .then((t) => JSON.parse(t).report_id ?? '')
      .catch(() => '');
  }
}
if (!artifact) {
  artifact = await read('drafts', `${weekId}.md`).catch(() => undefined);
  artifactLabel = `drafts/${weekId}.md`;
}
if (!artifact) {
  console.error(`Nothing to review for ${weekId}.`);
  console.error(`  Looked for a built issue in reports/ and for drafts/${weekId}.md.`);
  console.error('  Run "npm run draft:issue" or "npm run issue:build" first.');
  process.exit(1);
}

// --- panel ---------------------------------------------------------------------
// Composition, not sampling. One macro seat, one valuation seat, one quality seat,
// then the longest-waiting remaining seat — except when the issue proposes a
// decision review, where the fourth chair goes to the forensic bucket. That is the
// week the file is closest to spending money and the week an unchallenged
// assumption is most expensive.
const active = roster.filter((m) => (m.status || 'active') === 'active');
if (!active.length) {
  console.error('data/committee.csv has no active members.');
  process.exit(1);
}

const lastServed = new Map();
for (const r of reviews) {
  const held = lastServed.get(r.member_id);
  if (!held || r.week_id > held) lastServed.set(r.member_id, r.week_id);
}

// Never-served sorts first: '' precedes any week id. member_id breaks exact ties so
// two runs of the same week choose the same panel.
const byWaiting = (a, b) =>
  (lastServed.get(a.member_id) ?? '').localeCompare(lastServed.get(b.member_id) ?? '')
  || a.member_id.localeCompare(b.member_id);

const seats = Number(flag('seats') ?? 4);
const proposesDecision = /decision review required/i.test(artifact);

// Seats that sat on the DRAFT of this week already shaped what the issue says.
// Letting one of them review it is the same method marking its own work, which is
// the exact failure the committee exists to prevent — so they are skipped here when
// the bucket has anyone else to offer.
//
// This reproduces the drafting rotation rather than reading a ledger, because
// draft-issue.mjs writes no CSV by design. Two consequences, both acceptable: a
// draft run with pinned seats (--committee) cannot be detected from here, and a
// changed --committee-size shifts the set. Pass --draft-seats to match a non-default
// drafting panel size.
const drafted = new Set(selectPanel({
  members: roster,
  weekId,
  size: Number(flag('draft-seats') ?? DEFAULT_PANEL_SIZE),
}).seats.map((m) => m.member_id));

const panel = [];
const takeFrom = (predicate) => {
  const eligible = active.filter((m) => !panel.includes(m)).filter(predicate);
  // Prefer a seat that did not sit on the draft; fall back only if that empties the
  // bucket, because an unbalanced panel is a worse outcome than a seat reading its
  // own questions back.
  const fresh = eligible.filter((m) => !drafted.has(m.member_id));
  const pick = (fresh.length ? fresh : eligible).sort(byWaiting)[0];
  if (pick) panel.push(pick);
};

const forced = flag('member');
if (forced) {
  const m = active.find((x) => x.member_id === forced);
  if (!m) {
    console.error(`No active committee member with id "${forced}".`);
    console.error(`  Active: ${active.map((x) => x.member_id).join(', ')}`);
    process.exit(1);
  }
  panel.push(m);
}

for (const discipline of ['macro', 'valuation', 'quality']) {
  if (panel.length >= seats) break;
  if (panel.some((m) => m.discipline === discipline)) continue;
  takeFrom((m) => m.discipline === discipline);
}
if (panel.length < seats && proposesDecision) takeFrom((m) => m.discipline === 'forensic');
while (panel.length < seats && panel.length < active.length) takeFrom(() => true);

const describeSeat = (m) => {
  const served = lastServed.get(m.member_id);
  return `${m.member_id.padEnd(14)} ${m.seat.padEnd(42)} ${m.discipline.padEnd(10)} ${served ? `last served ${served}` : 'never served'}`;
};

if (has('panel')) {
  console.log(`Panel for ${weekId} — reviewing ${artifactLabel}`);
  if (drafted.size) console.log(`  Sat on the draft, so not reviewing: ${[...drafted].join(', ')}`);
  if (proposesDecision) console.log('  Issue proposes a decision review: the fourth chair goes to the forensic seat.\n');
  else console.log('');
  for (const m of panel) console.log(`  ${describeSeat(m)}`);
  const rest = active.filter((m) => !panel.includes(m)).sort(byWaiting);
  console.log(`\nUp next: ${rest.slice(0, 5).map((m) => m.member_id).join(', ')}`);
  console.log(`Full cycle at ${seats} seats a week: ${Math.ceil(active.length / seats)} issues for ${active.length} seats.`);
  process.exit(0);
}

// --- the evidence pack ----------------------------------------------------------
// A reviewer who cannot check a figure can only object to the prose. These are the
// files a figure in the issue should trace back to. macro_history.csv is excluded
// deliberately — 56KB of monthly observations, times four seats — and the prompt
// says so, so an unverifiable macro level is raised as a check rather than asserted
// to be wrong.
const PACK = [
  'sections.csv', 'themes.csv', 'assets.csv', 'asset_themes.csv',
  'scores.csv', 'gates.csv', 'growth_estimates.csv',
  'ai_value_chain.csv', 'ai_profit_pool.csv', 'crypto_rails.csv', 'agent_traffic.csv',
  'macro_series.csv', 'cost_curves.csv', 'sources.csv',
];

const SOURCE_WINDOW_DAYS = 45;
const trimSources = async (text) => {
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  const assetCol = header.indexOf('asset_id');
  const dateCol = header.indexOf('published_at');
  const assets = toObjects(parseCsv(await read('data', 'assets.csv')));
  const candidates = new Set(assets.filter((a) => (a.tier || 'candidate') !== 'universe').map((a) => a.asset_id));
  const cutoff = new Date(Date.now() - SOURCE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const kept = body.filter((r) => candidates.has(r[assetCol]) || !r[assetCol] || r[dateCol] >= cutoff);
  const withheld = body.length - kept.length;
  const serialise = (rs) => rs.map((r) => r.map(csvCell).join(',')).join('\n');
  return `${serialise([header, ...kept])}\n\`\`\`${withheld
    ? `\n\n${withheld} older source rows for universe-tier assets are withheld from this prompt. They are in the store.`
    : ''}`;
};

const pack = (await Promise.all(PACK.map(async (name) => {
  try {
    const text = (await read('data', name)).trim();
    if (name === 'sources.csv') return `### data/${name}\n\n\`\`\`csv\n${await trimSources(text)}`;
    return `### data/${name}\n\n\`\`\`csv\n${text}\n\`\`\``;
  } catch {
    return null;
  }
}))).filter(Boolean);

const [masterPrompt, convictionPolicy] = await Promise.all([
  read('INVESTO_MASTER_PROMPT.md'),
  read('CONVICTION_POLICY.md'),
]);

// --- prompts --------------------------------------------------------------------
const seatBrief = (m) => [
  `# Your seat: ${m.seat}`,
  '',
  `You are reviewing as the **${m.seat}** seat on the Investo Master review committee.`,
  `The seat is the documented method of ${m.name} (${m.era === 'historical' ? 'historical; a school of method, not a living reviewer' : 'active'}).`,
  '',
  'What that means exactly, and it is not a small distinction: you are applying a',
  'method, not impersonating a person. Do not write in the first person as them, do',
  'not invent quotations, and do not state what they would think about a specific',
  'security. Write as the seat. The memo says what the method finds; it never says',
  `that ${m.name} endorses, holds, or objects to anything.`,
  '',
  `**Method.** ${m.method}`,
  '',
  '**Your standing questions.** Ask each of these of the issue, and answer them:',
  ...m.review_questions.split(';').map((q) => `  - ${q.trim()}`),
  '',
  `**What this seat is best at catching.** ${m.catches}`,
  '',
  `**What does not transfer.** ${m.does_not_transfer} Do not raise a finding that`,
  'depends on being a different kind of investor than this file is.',
  '',
  `**Your own blind spot, stated so you can correct for it.** ${m.blind_spot}`,
  '',
  `**Read these sections first:** ${m.priority_sections.split(';').join(', ')}.`,
  'Read the whole issue, but weight your attention there.',
].join('\n');

const REVIEW_RULES = [
  '# How to review',
  '',
  'You are the last thing between this issue and its reader. The issue was drafted by',
  'a model reading the same store you have been given, which means a draft that talked',
  'itself into something has nothing else standing in its way.',
  '',
  'Judge the issue against the two governing documents above, not against how you',
  'would have written it. A different emphasis is not a finding. Prose you dislike is',
  'not a finding.',
  '',
  '## Severity, which decides what happens next',
  '',
  '- **blocking** — this must not be sent as written. Reserved for: a figure that does',
  '  not appear in the store; a claim contradicted by a row cited in support of it; an',
  '  UNVERIFIED row used as evidence rather than named as a claim; a decision review',
  '  proposed with an outstanding gate; language that reads as personalised financial',
  '  advice or as a guarantee; or a benchmark estimate presented as a measurement.',
  '  A blocking finding stops delivery until a human resolves it, so raise one only',
  '  when you can name the specific sentence and the specific defect.',
  '- **material** — the issue is publishable but the argument is wrong, incomplete, or',
  '  rests on something unexamined. This is where most real committee value lives.',
  '  It does not stop the send; the chair decides.',
  '- **minor** — clarity, structure, an unnecessary restatement, a missing attribution',
  '  that does not change the conclusion.',
  '',
  'Do not inflate severity to be heard, and do not manufacture findings to look',
  'diligent. "This section is sound and here is the test it passed" is a useful memo.',
  'A panel that never returns an empty findings list is a panel nobody can trust.',
  '',
  '## What you can and cannot check',
  '',
  'The store extract in the user turn is most of the evidence base, but not all of it:',
  'the macro history table is excluded for size. If a figure cannot be traced in what',
  'you were given, say that you could not trace it and raise it as `material` with the',
  'fix "verify against <file>" — do not assert that it is wrong, and do not assume it',
  'is right either.',
  '',
  '## Output',
  '',
  'Write the memo as Markdown: your reading of the issue through the seat, the',
  'questions answered, and what you would change. Two pages at most. Lead with the',
  'single thing that most needs to change, or with the fact that nothing does.',
  '',
  'Then end the memo with one fenced JSON block, and nothing after it:',
  '',
  '```json',
  '{',
  '  "verdict": "publish" | "publish-with-fixes" | "hold",',
  '  "summary": "one sentence, under 200 characters",',
  '  "findings": [',
  '    {',
  '      "severity": "blocking" | "material" | "minor",',
  '      "section": "the issue section heading it sits under",',
  '      "finding": "the defect, in one or two sentences",',
  '      "fix": "what to change, specifically",',
  '      "evidence": "the row, file or sentence that shows it"',
  '    }',
  '  ]',
  '}',
  '```',
  '',
  'An empty findings array is a valid and sometimes correct answer. "hold" is reserved',
  'for when you have raised at least one blocking finding.',
].join('\n');

const buildPrompt = (m) => ({
  system: [masterPrompt, '---', convictionPolicy, '---', seatBrief(m), '---', REVIEW_RULES].join('\n\n'),
  user: [
    `Review the Investo Master issue for ${weekId}, from the ${m.seat} seat.`,
    '',
    `## The issue under review (${artifactLabel})`,
    '',
    artifact,
    '',
    '---',
    '',
    '## The research store the issue was written from',
    '',
    ...pack,
    '',
    '---',
    '',
    'Write your memo, then the JSON block. Output the memo only — no preamble.',
  ].join('\n'),
});

const reviewDir = path.join(root, 'reviews', weekId);

// --- recording -------------------------------------------------------------------
// A memo is prose with a JSON block at the end. A memo whose block is missing or
// malformed is still saved and still reported: losing a seat's whole reading because
// the machine-readable part failed to parse would be the worst available trade.
const extractVerdict = (text) => {
  const raw = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1];
  if (!raw) return { error: 'no JSON block in the memo' };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.findings)) return { error: 'JSON block has no findings array' };
    return {
      verdict: parsed.verdict ?? 'publish-with-fixes',
      summary: parsed.summary ?? '',
      findings: parsed.findings,
    };
  } catch (err) {
    return { error: `JSON block did not parse: ${err.message}` };
  }
};

const newReviews = [];
const newFindings = [];
const superseded = [];

const reviewRow = (m, fields) => ({
  review_id: `rev-${weekId}-${m.member_id}`,
  week_id: weekId,
  report_id: reportId,
  member_id: m.member_id,
  seat: m.seat,
  artifact: artifactLabel,
  reviewed_at: now,
  ...fields,
});

// Returns a one-line result for the console, and mutates the pending-write arrays.
const recordMemo = (m, text, { modelUsed }) => {
  const parsed = extractVerdict(text);
  if (parsed.error) {
    newReviews.push(reviewRow(m, {
      model: modelUsed, verdict: 'unparsed', findings_total: '', findings_blocking: '', summary: parsed.error,
    }));
    return `memo saved, but ${parsed.error}. Findings not recorded — read the memo.`;
  }

  if (force) {
    for (const f of findings) {
      if (f.week_id === weekId && f.member_id === m.member_id && f.status === 'open') {
        f.status = 'superseded';
        f.resolution_note = `Superseded by a re-review on ${now.slice(0, 10)}.`;
        f.resolved_at = now;
        superseded.push(f.finding_id);
      }
    }
  }

  const taken = new Set([...findings, ...newFindings].map((f) => f.finding_id));
  const valid = ['blocking', 'material', 'minor'];
  for (const f of parsed.findings) {
    let n = 1;
    while (taken.has(`fnd-${weekId}-${m.member_id}-${String(n).padStart(2, '0')}`)) n += 1;
    const id = `fnd-${weekId}-${m.member_id}-${String(n).padStart(2, '0')}`;
    taken.add(id);
    newFindings.push({
      finding_id: id,
      week_id: weekId,
      report_id: reportId,
      member_id: m.member_id,
      // An unrecognised severity becomes material rather than being dropped or
      // promoted: dropping loses the finding, promoting lets a typo block a send.
      severity: valid.includes(f.severity) ? f.severity : 'material',
      section: f.section ?? '',
      finding: f.finding ?? '',
      fix: f.fix ?? '',
      evidence: f.evidence ?? '',
      status: 'open',
      resolution_note: '',
      resolved_by: '',
      resolved_at: '',
      recorded_at: now,
    });
  }

  const blocking = parsed.findings.filter((f) => f.severity === 'blocking').length;
  newReviews.push(reviewRow(m, {
    model: modelUsed,
    verdict: parsed.verdict,
    findings_total: String(parsed.findings.length),
    findings_blocking: String(blocking),
    summary: parsed.summary,
  }));
  return `${parsed.verdict} — ${parsed.findings.length} finding(s), ${blocking} blocking`;
};

// A re-review replaces that seat's row for the week rather than appending a second
// one. The findings themselves are never deleted, only superseded.
const persist = async () => {
  const merged = [
    ...reviews.filter((r) => !newReviews.some((n) => n.review_id === r.review_id)),
    ...newReviews,
  ].sort((a, b) => a.week_id.localeCompare(b.week_id) || a.member_id.localeCompare(b.member_id));
  await writeFile(reviewsPath, toCsv(REVIEW_HEADER, merged), 'utf8');
  await writeFile(findingsPath, toCsv(FINDING_HEADER, [...findings, ...newFindings]), 'utf8');

  const blockingNow = [...findings, ...newFindings].filter((f) =>
    f.status === 'open' && f.severity === 'blocking'
    && (f.report_id === reportId || (!f.report_id && f.week_id === weekId)));

  console.log(`\nWrote reviews/${weekId}/ — ${newReviews.length} memo(s) recorded`);
  console.log(`  data/committee_reviews.csv  ${merged.length} rows`);
  console.log(`  data/committee_findings.csv ${findings.length + newFindings.length} rows`
    + (superseded.length ? ` (${superseded.length} superseded)` : ''));

  if (blockingNow.length) {
    console.log(`\n${blockingNow.length} BLOCKING finding(s). The issue cannot be sent until these are resolved:`);
    for (const f of blockingNow) console.log(`  ${f.finding_id}  ${f.finding.slice(0, 90)}`);
    console.log('\nResolve each with:');
    console.log('  npm run review:resolve -- <finding_id> --status fixed --note "what changed"');
  } else {
    console.log('\nNo blocking findings. Read the memos before approving — material findings do not block.');
  }
};

// --- record a hand-run memo --------------------------------------------------------
// The other half of --emit-prompt: run the prompt anywhere, save the memo, record it
// here. The free path has to reach the same ledger as the metered one, or it becomes
// a second review process nobody can audit.
const recordId = flag('record');
if (recordId) {
  const m = roster.find((x) => x.member_id === recordId);
  if (!m) {
    console.error(`No committee member with id "${recordId}".`);
    process.exit(1);
  }
  const memoPath = path.join(reviewDir, `${m.member_id}.md`);
  const text = await readFile(memoPath, 'utf8').catch(() => undefined);
  if (!text) {
    console.error(`No memo at ${path.relative(root, memoPath)}.`);
    console.error('  Save the model output there first, JSON block included.');
    process.exit(1);
  }
  if (reviews.some((r) => r.week_id === weekId && r.member_id === m.member_id) && !force) {
    console.error(`${m.member_id} already has a recorded review for ${weekId}. Use --force to replace it.`);
    process.exit(1);
  }
  console.log(`  ${m.member_id}: ${recordMemo(m, text, { modelUsed: flag('model-used') ?? 'hand-run' })}`);
  if (dryRun) console.log('\n--dry-run: nothing written.');
  else await persist();
  process.exit(0);
}

// --- emit / dry run --------------------------------------------------------------
if (has('emit-prompt')) {
  await mkdir(reviewDir, { recursive: true });
  for (const m of panel) {
    const { system, user } = buildPrompt(m);
    const out = path.join(reviewDir, `${m.member_id}.prompt.md`);
    await writeFile(out, `${system}\n\n---\n\n${user}\n`, 'utf8');
    console.log(`Wrote ${path.relative(root, out)} — ${(system.length + user.length).toLocaleString()} chars`);
  }
  console.log(`\nRun each by hand, save the memo to reviews/${weekId}/<member_id>.md,`);
  console.log('then record findings with "npm run review:record -- <member_id>".');
  process.exit(0);
}

if (dryRun) {
  console.log(`Week:     ${weekId}`);
  console.log(`Artifact: ${artifactLabel} (${artifact.length.toLocaleString()} chars)`);
  console.log(`Model:    ${model}`);
  console.log(`Panel:    ${panel.length} seat(s)\n`);
  let total = 0;
  for (const m of panel) {
    const { system, user } = buildPrompt(m);
    total += system.length + user.length;
    console.log(`  ${describeSeat(m)}`);
    console.log(`    prompt ${(system.length + user.length).toLocaleString()} chars`);
  }
  console.log(`\nTotal ${total.toLocaleString()} chars across the panel.`);
  console.log('Dry run — no API call made, nothing written.');
  process.exit(0);
}

// --- run ---------------------------------------------------------------------------
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set. Add it to .env.local, or use --emit-prompt to run the panel by hand.');
  process.exit(1);
}

const alreadyReviewed = new Set(
  reviews.filter((r) => r.week_id === weekId).map((r) => r.member_id),
);

const runSeat = async (m) => {
  const { system, user } = buildPrompt(m);
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      // ASCII only. HTTP header values are ByteString, so the em dash this repo
      // uses everywhere in prose throws before the request is even sent.
      'x-title': 'Investo Master - review committee',
    },
    body: JSON.stringify({
      model,
      // max_tokens is the budget for reasoning AND the memo, not the memo alone. At
      // 8000 with effort high, a reasoning model spent the whole allowance thinking
      // and returned finish_reason "length" with no text — billed in full, useless.
      // 24000 leaves room for the memo after the thinking. Raising the cap does not
      // buy more reasoning; the effort setting governs that.
      max_tokens: 24000,
      reasoning: { effort: 'high' },
      usage: { include: true },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(1_800_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenRouter request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const body = await response.json();
  if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error));

  // Recorded before the response is judged usable. A call truncated by max_tokens
  // is billed in full for the reasoning it did, and a ledger that only counted
  // memos that arrived would report a wasted run as free.
  await recordCost({ root, weekId, stage: `review:${m.member_id}`, model, usage: body.usage ?? {} });

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`no memo returned (finish_reason: ${body.choices?.[0]?.finish_reason ?? 'unknown'})`);
  return { text, usage: body.usage ?? {} };
};

await mkdir(reviewDir, { recursive: true });

let failed = 0;
console.log(`Reviewing ${artifactLabel} with ${panel.length} seat(s) on ${model}.`);
console.log('Each seat is a separate call and can take a few minutes.\n');

for (const m of panel) {
  if (alreadyReviewed.has(m.member_id) && !force) {
    console.log(`  ${m.member_id}: already reviewed ${weekId}. Use --force to review again.`);
    continue;
  }

  process.stdout.write(`  ${m.member_id} (${m.seat})… `);
  let result;
  try {
    result = await runSeat(m);
  } catch (err) {
    // One seat failing must not discard the seats that succeeded. The panel is
    // recorded short, and the missing seat is reported so it can be rerun.
    console.log(`failed — ${err.message}`);
    failed += 1;
    continue;
  }

  const { text, usage } = result;
  await writeFile(path.join(reviewDir, `${m.member_id}.md`), `${text}\n`, 'utf8');
  const line = recordMemo(m, text, { modelUsed: model });
  // Cost was already written inside runSeat, one row per seat — a panel is the most
  // expensive stage precisely because it is several calls, and a total that hid that
  // would point at the wrong lever.
  console.log(line + (usage.cost !== undefined ? ` · ${formatUsd(usage.cost)}` : ''));
}

if (!newReviews.length) {
  // Non-zero when seats were attempted and every one failed. Exiting 0 there would
  // paint the workflow step green on a total panel failure, and the only thing that
  // would notice is the send gate days later — by which time the run log has scrolled
  // away. Nothing to do (an already-reviewed week) is still a success.
  console.log(failed
    ? `\nNothing recorded: all ${failed} attempted seat(s) failed.`
    : '\nNothing recorded.');
  process.exit(failed ? 1 : 0);
}

await persist();
