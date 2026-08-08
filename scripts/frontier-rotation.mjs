// Frontier rotation: reviews one candidate theme or fringe entry at a time,
// oldest first. The monthly counterpart to the weekly asset rotation.
//
// Selection is by last_reviewed_date, never-reviewed first, so an entry cannot be
// quietly forgotten and a busy month does not permanently push anything to the back.
//
// Three things go into every prompt that do not go into an asset review, and each
// is there to work against a specific failure of judgement:
//
//   The graveyard. data/dead_themes.csv is supplied in full so the review has to
//   name which dead theme the candidate most resembles. Left to itself, an
//   assessment pattern-matches a candidate to the internet and to AI — the two
//   that worked — because those are the vivid cases. The base rate is the other
//   file, and it is longer.
//
//   The calibration lines. Signals from a confirmed theme are supplied alongside
//   the candidate's own, because a growth rate means nothing on its own. Forty
//   percent is impressive or unremarkable depending entirely on what the reference
//   case is doing in the same quarter.
//
//   The kill criteria the entry was written with. A review that cannot conclude
//   "this is dead" is not a review. The entry's own promote_criteria and
//   kill_criteria are quoted back so the assessment is made against what was
//   written before the evidence arrived, rather than against a standard adjusted
//   after the fact.
//
// Concluding that a candidate should be rejected, or a fringe entry killed, is a
// good outcome and the prompt says so explicitly. Most of these will fail; a file
// that never removes anything is a collection, not an instrument.
//
// This script writes prose and a review date. It never writes a status change —
// promoting a candidate into themes.csv, or killing one, stays a human edit.
//
// Usage:
//   npm run frontier:next                    review the next entry via the API
//   npm run frontier:next -- --emit-prompt    write the prompt, run it by hand for free
//   npm run frontier:next -- --entry orbital-economics
//   npm run frontier:next -- --scope fringe   restrict the queue to one tier
//   npm run frontier:next -- --dry-run        show what would be reviewed

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const dryRun = args.includes('--dry-run');
const root = path.resolve(flag('root') ?? process.cwd());
const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-opus-5';

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
};

const csvCell = (v) => (/[",\n\r]/.test(String(v ?? '')) ? `"${String(v).replaceAll('"', '""')}"` : String(v ?? ''));
const read = (...p) => readFile(path.join(root, ...p), 'utf8');

const toObjects = (rows) => {
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((k, i) => [k, cells[i] ?? ''])));
};

// --- the two tiers -----------------------------------------------------------
const candidatesRaw = parseCsv(await read('data', 'candidate_themes.csv'));
const fringeRaw = parseCsv(await read('data', 'fringe_watch.csv'));

const [curves, signals, dead, themes] = await Promise.all([
  read('data', 'cost_curves.csv').then((t) => toObjects(parseCsv(t))).catch(() => []),
  read('data', 'theme_signals.csv').then((t) => toObjects(parseCsv(t))).catch(() => []),
  read('data', 'dead_themes.csv').then((t) => toObjects(parseCsv(t))).catch(() => []),
  read('data', 'themes.csv').then((t) => toObjects(parseCsv(t))).catch(() => []),
]);

// Normalise the two tiers into one queue. They carry different fields on purpose —
// a fringe entry is not required to answer the precondition test — so the shared
// shape is only what selection needs, and the review reads the raw row.
const entries = [
  ...toObjects(candidatesRaw).map((row) => ({
    id: row.candidate_id, name: row.name, tier: 'candidate', row,
    status: row.status, reviewed: row.last_reviewed_date,
  })),
  ...toObjects(fringeRaw).map((row) => ({
    id: row.fringe_id, name: row.name, tier: 'fringe', row,
    status: row.status, reviewed: row.last_reviewed_date,
  })),
];

// Calibration rows are historical reference, not live work. Reviewing Bitcoin in
// 2026 tells us nothing we do not already know, and it would consume a slot that
// a live entry needs.
const scope = flag('scope');
const reviewable = entries.filter((e) => (
  e.status !== 'historical_calibration'
  && e.status !== 'rejected'
  && e.status !== 'killed'
  && (!scope || e.tier === scope)
));

const chosen = flag('entry')
  ? entries.find((e) => e.id === flag('entry'))
  : [...reviewable].sort((a, b) => (
    (a.reviewed || '').localeCompare(b.reviewed || '') || a.id.localeCompare(b.id)
  ))[0];

if (!chosen) {
  console.error(flag('entry')
    ? `No entry "${flag('entry')}" in candidate_themes.csv or fringe_watch.csv.`
    : 'No reviewable entries. Every row is calibration, rejected or killed.');
  process.exit(1);
}

// --- the entry's own evidence ------------------------------------------------
const myCurve = curves.find((c) => c.curve_id === chosen.row.cost_curve_id);
const mySignals = signals
  .filter((s) => s.subject_id === chosen.id)
  .sort((a, b) => a.week_id.localeCompare(b.week_id) || a.signal_id.localeCompare(b.signal_id));
const calibration = signals
  .filter((s) => s.scope === 'theme_calibration')
  .sort((a, b) => a.week_id.localeCompare(b.week_id) || a.signal_id.localeCompare(b.signal_id));

const weeksObserved = new Set(mySignals.map((s) => s.week_id)).size;

console.log(`Next for frontier review: ${chosen.name} (${chosen.id})`);
console.log(`  tier ${chosen.tier} · status ${chosen.status} · last reviewed ${chosen.reviewed || 'never'}`);
console.log(`  ${mySignals.length} signal reading(s) across ${weeksObserved} week(s) · ${myCurve ? `curve ${myCurve.curve_id} (${myCurve.status})` : 'no cost curve'}`);
console.log(`  queue: ${reviewable.length} reviewable of ${entries.length} total`);

// One week of readings supports a description, not a trend. Saying so here is
// cheaper than discovering it in the review's own hedging.
if (weeksObserved < 4) {
  console.log(`\n  Note: ${weeksObserved} week(s) of signal history. Too short for any trend claim —`);
  console.log('  this review can assess the preconditions and the artifact, not the direction.');
}

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

const block = (title, rows) => (rows.length
  ? `### ${title}\n\n\`\`\`\n${rows.join('\n')}\n\`\`\`\n`
  : `### ${title}\n\nNo rows.\n`);

const fields = (row, keys) => keys
  .filter((k) => row[k])
  .map((k) => `${k}: ${row[k]}`);

const [masterPrompt, convictionPolicy] = await Promise.all([
  read('INVESTO_MASTER_PROMPT.md'), read('CONVICTION_POLICY.md'),
]);

const candidateSections = [
  'What it is · The five preconditions, each answered against the rows supplied ·',
  'What the signals show · What the signals cannot show ·',
  'Which dead theme it most resembles, and why that is or is not fatal ·',
  'Distance from its own graduation criteria · What to check next',
].join('\n  ');

const fringeSections = [
  'What it is and where it lives · Whether the artifact is alive ·',
  'Whether the original dismissal still holds ·',
  'Which dead theme it most resembles, and why that is or is not fatal ·',
  'Distance from promotion to candidate · What to check next',
].join('\n  ');

const system = [
  masterPrompt, '---', convictionPolicy, '---',
  [
    `You are reviewing ONE ${chosen.tier === 'fringe' ? 'fringe entry' : 'candidate theme'} in depth.`,
    'This is the frontier tier: speculative by construction, and held to a different',
    'standard from the active research store. Nothing here is investable and nothing',
    'here should be written as though it were.',
    '',
    'Every figure must come from the rows supplied below. Do not supply a number from',
    'memory and do not estimate one. Where the store cannot answer something, say so',
    'plainly rather than reasoning around it.',
    '',
    'Signal readings measure attention and activity, never value. A rising line means',
    'more people are working on something, which is equally consistent with an',
    'approaching threshold and with a bubble. Do not treat a growth rate as evidence',
    'that a thesis is correct.',
    '',
    'Read every growth rate against the calibration rows, which come from a confirmed',
    'theme. A rate quoted without that comparison is close to meaningless.',
    '',
    'The graveyard is supplied in full. You must name which dead theme this entry most',
    'resembles and say why the resemblance is or is not fatal. "None of them" is an',
    'acceptable answer only if you argue it.',
    '',
    'Concluding that this entry should be rejected or killed is a good outcome, not a',
    'failed review. Most of these will fail. Assess against the promote and kill',
    'criteria as they were written, not against a standard adjusted to fit what has',
    'since happened.',
    '',
    'Do not assess any decision gate, do not name any security, and do not propose a',
    'decision review. Nothing at this tier is close to that.',
    '',
    'Produce Markdown with these sections, and nothing else:',
    `  ${chosen.tier === 'fringe' ? fringeSections : candidateSections}`,
    '',
    'Be brief where the evidence is thin. One week of signal history supports a',
    'description and not a trend; say that rather than hedging a trend claim.',
  ].join('\n'),
].join('\n\n');

const signalLine = (s) => [
  s.week_id, s.signal_id, `${s.value} ${s.unit}`,
  s.yoy_percent === '' ? 'no yoy' : `${s.yoy_percent}% yoy`,
  s.detail || '',
].filter(Boolean).join(' | ');

const userTurn = [
  `Review ${chosen.name}, ${chosen.tier === 'fringe' ? 'fringe_id' : 'candidate_id'} \`${chosen.id}\`.`,
  `Status: ${chosen.status}. Last reviewed: ${chosen.reviewed || 'never'}.`,
  `Signal history: ${mySignals.length} reading(s) across ${weeksObserved} week(s).`,
  '',
  block('The entry as written', fields(chosen.row, Object.keys(chosen.row))),
  myCurve
    ? block('Its cost curve', fields(myCurve, Object.keys(myCurve)))
    : '### Its cost curve\n\nNo curve is recorded for this entry. If it needs one, say what the unit should be.\n',
  block('Its signal readings', mySignals.map(signalLine)),
  block('Calibration readings from a confirmed theme', calibration.map(signalLine)),
  block('The graveyard — every theme that failed and why', dead.map((d) =>
    `${d.dead_id} | peak ${d.peak_attention} | broke: ${d.precondition_broken} | ${d.what_happened} | LESSON: ${d.lesson}`)),
  block('Active themes, for boundary checking', themes.map((t) =>
    `${t.theme_id} | ${t.name} | ${t.status} | ${t.summary}`)),
].join('\n');

const outDir = path.join(root, 'research', 'frontier');
const outPath = path.join(outDir, `${chosen.id}.md`);

if (args.includes('--emit-prompt')) {
  await mkdir(outDir, { recursive: true });
  const p = path.join(outDir, `${chosen.id}.prompt.md`);
  await writeFile(p, `${system}\n\n---\n\n${userTurn}\n`, 'utf8');
  console.log(`\nWrote research/frontier/${chosen.id}.prompt.md (${(system.length + userTurn.length).toLocaleString()} chars)`);
  console.log(`Run it by hand, then append the result to research/frontier/${chosen.id}.md.`);
  process.exit(0);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('\nOPENROUTER_API_KEY is not set. Add it to .env.local, or use --emit-prompt.');
  process.exit(1);
}

console.log(`\nReviewing with ${model}...`);
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'x-title': 'Investo Master' },
  body: JSON.stringify({
    model,
    max_tokens: 8000,
    reasoning: { effort: 'high' },
    stream: true,
    usage: { include: true },
    messages: [{ role: 'system', content: system }, { role: 'user', content: userTurn }],
  }),
  signal: AbortSignal.timeout(1_800_000),
});

if (!response.ok) {
  console.error(`OpenRouter request failed (${response.status}).`);
  console.error((await response.text().catch(() => '')).slice(0, 400));
  process.exit(1);
}

let note = '';
let usage = {};
let finishReason;
let buffer = '';
for await (const chunk of response.body) {
  buffer += Buffer.from(chunk).toString('utf8');
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let parsed;
    try { parsed = JSON.parse(data); } catch { continue; }
    if (parsed.error) {
      console.error(`\nOpenRouter error: ${parsed.error.message ?? ''}`);
      process.exit(1);
    }
    const delta = parsed.choices?.[0]?.delta?.content;
    if (delta) { note += delta; process.stdout.write(delta); }
    if (parsed.choices?.[0]?.finish_reason) finishReason = parsed.choices[0].finish_reason;
    if (parsed.usage) usage = parsed.usage;
  }
}

if (finishReason === 'length') {
  console.error('\nReview hit the max_tokens ceiling and is truncated. Not written.');
  process.exit(1);
}
note = note.trim();
if (!note) {
  console.error('\nNo content returned. Nothing written.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
await mkdir(outDir, { recursive: true });

// Append under a dated heading. Earlier reviews stay exactly as written, so the
// record shows how a view changed rather than only where it ended up. At this tier
// that matters more than at any other: the point of the file is to be able to read
// back what was believed before the outcome was known.
let existing = '';
try { existing = await readFile(outPath, 'utf8'); } catch { /* first review */ }
const header = existing
  ? ''
  : `# ${chosen.name}\n\nFrontier tier — ${chosen.tier}. Speculative by construction; nothing here is investable.\nRotating review notes. Newest last; earlier entries are never revised.\n`;
await appendFile(outPath, `${header}\n## Review ${today}\n\n${note}\n`, 'utf8');

// Record the review so rotation moves on. The two tiers live in different files
// with different key columns, so write back to whichever one the entry came from.
const [file, raw, key] = chosen.tier === 'candidate'
  ? ['candidate_themes.csv', candidatesRaw, 'candidate_id']
  : ['fringe_watch.csv', fringeRaw, 'fringe_id'];
const head = raw[0];
const idIdx = head.indexOf(key);
const reviewedIdx = head.indexOf('last_reviewed_date');
const updated = raw.map((row, i) => (
  i !== 0 && row[idIdx] === chosen.id
    ? row.map((cell, c) => (c === reviewedIdx ? today : cell))
    : row
));
await writeFile(path.join(root, 'data', file),
  `${updated.map((r) => r.map(csvCell).join(',')).join('\n')}\n`, 'utf8');

console.log(`\n\nAppended to research/frontier/${chosen.id}.md`);
console.log(`Marked ${chosen.name} reviewed ${today} in data/${file}.`);
console.log(`Tokens — prompt ${usage.prompt_tokens ?? '?'}, completion ${usage.completion_tokens ?? '?'}`);
if (usage.cost !== undefined) console.log(`Cost — $${usage.cost}`);
