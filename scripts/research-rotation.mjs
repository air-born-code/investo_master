// Midweek research rotation: reviews one asset at a time, oldest first.
//
// The weekly issue is a snapshot of everything. This is the opposite: one asset,
// examined properly. Selection follows the coverage ledger — the same queue
// build-issue.mjs will draw from — so the note written here is the note the next
// issue publishes. Reviewing one name and writing up another would leave every
// rotation slot in the issue reading "not yet examined" forever.
//
// This matters most for the universe tier, where names entered by screen and have
// never been examined. A review that concludes an asset does not belong is a good
// outcome, not a failed one.
//
// Notes are appended under a dated heading, never overwritten: the core prompt
// requires dated thesis versions to be preserved rather than revised in place.
//
// Usage:
//   npm run research:next                 review the next asset via the API
//   npm run research:next -- --emit-prompt  write the prompt, run it by hand for free
//   npm run research:next -- --asset crdo   review a specific asset
//   npm run research:next -- --dry-run      show what would be reviewed

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isReviewed, reviewedEvidence, selectCoverage } from './lib/rotation.mjs';
import { formatUsd, recordCost } from './lib/cost.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const dryRun = args.includes('--dry-run');
const root = path.resolve(flag('root') ?? process.cwd());
const model = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-pro';

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

const assetsRaw = parseCsv(await read('data', 'assets.csv'));
const assetHeader = assetsRaw[0];
const assets = toObjects(assetsRaw);

const [themes, links, scores, metrics, sources, coverage] = await Promise.all([
  read('data', 'themes.csv').then((t) => toObjects(parseCsv(t))),
  read('data', 'asset_themes.csv').then((t) => toObjects(parseCsv(t))),
  read('data', 'scores.csv').then((t) => toObjects(parseCsv(t))).catch(() => []),
  read('data', 'weekly_metrics.csv').then((t) => toObjects(parseCsv(t))).catch(() => []),
  read('data', 'sources.csv').then((t) => toObjects(parseCsv(t))).catch(() => []),
  read('data', 'coverage.csv').then((t) => toObjects(parseCsv(t))).catch(() => []),
]);

// The queue the next issue will publish from. Walking it in order means the notes
// arrive just ahead of the slots that need them. Within the queue, never-reviewed
// names come first so a name is not re-examined while others wait for a first look.
const upcomingWeek = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - yearStart) / 86_400_000 + 1) / 7)).padStart(2, '0')}`;
})();

const evidenceCount = reviewedEvidence(sources);

const plan = selectCoverage({
  assets,
  scores,
  coverage,
  weekId: upcomingWeek,
  rotationSlots: Number(flag('slots') ?? 3),
  evidenceCount,
});

const queue = [...plan.rotation, ...plan.upNext];
const byId = new Map(assets.map((a) => [a.asset_id, a]));
const chosen = flag('asset')
  ? assets.find((a) => a.asset_id === flag('asset'))
  : byId.get((queue.find((q) => !byId.get(q.assetId)?.last_reviewed_date) ?? queue[0])?.assetId)
    // An empty queue means every universe name is spoken for this cycle; fall back
    // to the plain oldest-review rule so this command always has something to do.
    ?? [...assets].sort((a, b) =>
      (a.last_reviewed_date || '').localeCompare(b.last_reviewed_date || '')
        || a.asset_id.localeCompare(b.asset_id))[0];

if (!chosen) {
  console.error(flag('asset') ? `No asset "${flag('asset')}" in assets.csv.` : 'No assets to review.');
  process.exit(1);
}

const own = (rows) => rows.filter((r) => r.asset_id === chosen.asset_id);
const myLinks = own(links);
const myThemes = themes.filter((t) => myLinks.some((l) => l.theme_id === t.theme_id));
const mySources = own(sources).sort((a, b) => (a.published_at < b.published_at ? 1 : -1));

const reviewedLabel = chosen.last_reviewed_date || 'never';
const queuePosition = queue.findIndex((q) => q.assetId === chosen.asset_id);

console.log(`Next for review: ${chosen.symbol} — ${chosen.name}`);
console.log(`  tier ${chosen.tier || 'candidate'} · stage ${chosen.stage} · last reviewed ${reviewedLabel}`);
console.log(`  ${myThemes.length} theme(s) · ${mySources.length} source rows · ${own(scores).length} score rows`);
if (queuePosition === -1) {
  console.log('  Not in the upcoming rotation queue — reviewed on the oldest-review fallback.');
} else {
  console.log(`  Rotation slot ${queuePosition + 1} for ${upcomingWeek}. This note will appear in that issue.`);
}

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

const block = (title, rows) => (rows.length
  ? `### ${title}\n\n\`\`\`\n${rows.join('\n')}\n\`\`\`\n`
  : `### ${title}\n\nNo rows.\n`);

const [masterPrompt, convictionPolicy] = await Promise.all([
  read('INVESTO_MASTER_PROMPT.md'), read('CONVICTION_POLICY.md'),
]);

const system = [
  masterPrompt, '---', convictionPolicy, '---',
  [
    'You are reviewing ONE asset in depth, not writing a weekly issue.',
    '',
    'Every figure must come from the rows supplied below. Do not supply a number',
    'from memory and do not estimate one. Where the store cannot answer something,',
    'say so plainly under "What the store cannot answer".',
    '',
    'The universe tier means coverage, not interest. Many of these names entered by',
    'screen and have never been examined. Concluding that an asset does not belong —',
    'because it does not express the theme it is linked to, or the link is weaker than',
    'assumed — is a useful result, not a failed review. Say so directly when it is true.',
    '',
    'Do not assess any decision gate and do not propose a decision review.',
    '',
    'Produce Markdown with these sections, and nothing else:',
    '  What it does · Why it is linked to its theme · What the evidence shows ·',
    '  What the evidence does not show · Does it belong at its current tier ·',
    '  What to check next',
    '',
    'Be brief where the evidence is thin. A name with two filings and no metrics',
    'warrants a short note, not a long one.',
  ].join('\n'),
].join('\n\n');

const userTurn = [
  `Review ${chosen.symbol} (${chosen.name}), asset_id \`${chosen.asset_id}\`.`,
  `Tier: ${chosen.tier || 'candidate'}. Stage: ${chosen.stage}. Industry: ${chosen.industry}.`,
  `Last reviewed: ${reviewedLabel}.`,
  '',
  block('Themes it is linked to', myThemes.map((t) =>
    `${t.theme_id} | ${t.name} | ${t.status} | confidence ${t.confidence} | ${t.summary}`)),
  block('Link details', myLinks.map((l) =>
    `${l.theme_id} | role ${l.role} | relevance ${l.relevance} | ${l.notes}`)),
  block('Scores', own(scores).map((s) => JSON.stringify(s))),
  block('Metrics', own(metrics).map((m) => JSON.stringify(m))),
  block('Evidence', mySources.map((s) =>
    `${s.published_at} | ${s.source_type} | ${s.title} | ${s.claim} | ${s.url}`)),
].join('\n');

const outPath = path.join(root, 'research', `${chosen.asset_id}.md`);

if (args.includes('--emit-prompt')) {
  await mkdir(path.join(root, 'research'), { recursive: true });
  const p = path.join(root, 'research', `${chosen.asset_id}.prompt.md`);
  await writeFile(p, `${system}\n\n---\n\n${userTurn}\n`, 'utf8');
  console.log(`\nWrote research/${chosen.asset_id}.prompt.md (${(system.length + userTurn.length).toLocaleString()} chars)`);
  console.log(`Run it by hand, then append the result to research/${chosen.asset_id}.md.`);
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
await mkdir(path.join(root, 'research'), { recursive: true });

// Append under a dated heading. Earlier reviews stay exactly as written, so the
// record shows how a view changed rather than only where it ended up.
let existing = '';
try { existing = await readFile(outPath, 'utf8'); } catch { /* first review */ }
const header = existing ? '' : `# ${chosen.symbol} — ${chosen.name}\n\nRotating research notes. Newest last; earlier entries are never revised.\n`;
await appendFile(outPath, `${header}\n## Review ${today}\n\n${note}\n`, 'utf8');

// Record the review so rotation moves on.
const idx = assetHeader.indexOf('last_reviewed_date');
const updated = assetsRaw.map((row, i) => {
  if (i === 0) return row;
  return row[assetHeader.indexOf('asset_id')] === chosen.asset_id
    ? row.map((cell, c) => (c === idx ? today : cell))
    : row;
});
await writeFile(path.join(root, 'data', 'assets.csv'),
  `${updated.map((r) => r.map(csvCell).join(',')).join('\n')}\n`, 'utf8');

console.log(`\n\nAppended to research/${chosen.asset_id}.md`);
console.log(`Marked ${chosen.symbol} reviewed ${today}.`);
console.log(`Tokens — prompt ${usage.prompt_tokens ?? '?'}, completion ${usage.completion_tokens ?? '?'}`);

// Attributed to the week this dive is preparing, which is the edition that will
// carry its conclusions and so the edition that should carry its cost.
const recorded = await recordCost({ root, weekId: upcomingWeek, stage: 'research', model, usage });
if (recorded.pricing === 'metered') console.log(`Cost — ${formatUsd(Number(recorded.cost_usd))}, recorded to data/model_costs.csv`);
