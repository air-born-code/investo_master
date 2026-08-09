// Evidence rotation: reads one batch of unread filings at a time, oldest first.
//
// research-rotation.mjs walks the asset queue and asks what a name amounts to.
// This walks the other queue — the one ingestion keeps filling. Every filing it
// discovers lands as a row whose claim says only that the document exists, and
// nothing has ever read them back. 315 of 371 rows in the store are that stub, so
// the store mostly records paperwork it has not opened.
//
// Selection is oldest-first by filing date, the same principle as the asset
// rotation: a document cannot be forgotten, and a busy week cannot push one
// permanently to the back.
//
// Work items are batches, not rows. EDGAR splits a merger communication across
// many 425s filed the same day — Dominion filed nineteen on 2026-05-18 — and those
// are one reading, not nineteen. Grouping happens here rather than in the store on
// purpose: the individual accessions stay in sources.csv, because the fact that
// the same accession appears under two CIKs is what revealed the NextEra/Dominion
// transaction in Issue 003. Collapsing the rows would have destroyed that finding.
//
// Usage:
//   npm run evidence:next                    read the oldest unread batch via the API
//   npm run evidence:next -- --emit-prompt   write the prompt, run it by hand for free
//   npm run evidence:next -- --list          show the queue and stop
//   npm run evidence:next -- --asset d       read the oldest unread batch for one asset
//   npm run evidence:next -- --dry-run       show what would be read

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isReviewed, reviewedEvidence } from './lib/rotation.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const dryRun = args.includes('--dry-run');
const root = path.resolve(flag('root') ?? process.cwd());
// Reading a filing is bounded extraction from one document, not synthesis, so it
// does not need the model that writes the weekly issue — and across a queue of
// several hundred batches the price difference is the whole cost of working it
// down: measured over ten batches, $0.0045 each against $0.041 on claude-opus-5.
//
// Deliberately its own variable rather than OPENROUTER_MODEL, which draft-issue.mjs
// also reads: a single shared variable means any attempt to make the cheap model
// stick here silently downgrades the weekly narrative too. Set EVIDENCE_MODEL to
// override just this script; nothing here changes what writes the issue.
const model = process.env.EVIDENCE_MODEL || 'deepseek/deepseek-v4-pro';
const maxDocs = Number(flag('max-docs') ?? 6);
const maxChars = Number(flag('max-chars') ?? 20_000);

const userAgent = process.env.SEC_USER_AGENT
  ?? 'Investo Master research script (set SEC_USER_AGENT to your contact address)';

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

const [assetsRaw, sourcesRaw] = await Promise.all([
  read('data', 'assets.csv').then(parseCsv),
  read('data', 'sources.csv').then(parseCsv),
]);
const assets = toObjects(assetsRaw);
const sources = toObjects(sourcesRaw);
const assetById = new Map(assets.map((a) => [a.asset_id, a]));

// --- the queue ----------------------------------------------------------------
// A stub is any row isReviewed() rejects. Using that predicate rather than a local
// copy of the regex is deliberate: the ranking in rotation.mjs and the worklist
// here have to agree about what counts as read, or a name can be starved of
// rotation slots for evidence this command believes it has already gathered.
const stubs = sources.filter((row) => !isReviewed(row));

// "D 425 filed 2026-07-24" — form and date come back out of the title because the
// store has no form column. A row that does not parse is its own batch, which is
// the right fallback: it gets read on its own rather than silently grouped.
const describe = (row) => {
  const m = /^(\S+)\s+(.+?)\s+filed\s+(\d{4}-\d{2}-\d{2})$/.exec(row.title ?? '');
  return m ? { symbol: m[1], form: m[2], filed: m[3] } : {};
};

const batches = new Map();
for (const row of stubs) {
  const { form } = describe(row);
  const date = row.published_at || row.as_of_date || '';
  const key = form
    ? `${row.asset_id}|${form}|${date}`
    : `${row.asset_id}|${row.source_id}`;
  if (!batches.has(key)) batches.set(key, { key, assetId: row.asset_id, form, date, rows: [] });
  batches.get(key).rows.push(row);
}

const queue = [...batches.values()].sort((a, b) =>
  (a.date || '').localeCompare(b.date || '')
  || a.assetId.localeCompare(b.assetId)
  || a.key.localeCompare(b.key));

const evidence = reviewedEvidence(sources);
const label = (b) => {
  const asset = assetById.get(b.assetId);
  const name = asset?.symbol || b.assetId || '(no asset)';
  const what = b.form ? `${b.rows.length}x ${b.form}` : b.rows[0].source_type;
  return `${(b.date || '????-??-??').padEnd(10)}  ${name.padEnd(6)} ${what.padEnd(14)} ${b.rows.length} row${b.rows.length === 1 ? '' : 's'}`;
};

console.log(`${stubs.length} unread rows in ${queue.length} batches (of ${sources.length} rows in the store).`);

if (args.includes('--list')) {
  for (const b of queue.slice(0, Number(flag('limit') ?? 40))) console.log(`  ${label(b)}`);
  if (queue.length > 40 && !flag('limit')) console.log(`  ... ${queue.length - 40} more`);
  process.exit(0);
}

const target = flag('asset')
  ? queue.find((b) => b.assetId === flag('asset'))
  : queue[0];

if (!target) {
  console.log(flag('asset')
    ? `Nothing unread for asset "${flag('asset')}".`
    : 'Nothing unread. Every row in the store has been read.');
  process.exit(0);
}

const asset = assetById.get(target.assetId);
console.log(`\nNext to read: ${asset?.name ?? target.assetId}`);
console.log(`  ${target.rows.length} document(s) · ${target.form ?? target.rows[0].source_type} · filed ${target.date}`);
console.log(`  ${evidence[target.assetId] ?? 0} reviewed claim(s) already on this asset`);
for (const row of target.rows.slice(0, maxDocs)) console.log(`    ${row.source_id}  ${row.url}`);
if (target.rows.length > maxDocs) {
  console.log(`    ... ${target.rows.length - maxDocs} more, not fetched this pass (--max-docs)`);
}

if (dryRun) {
  console.log('\nDry run — nothing fetched or written.');
  process.exit(0);
}

// --- fetch --------------------------------------------------------------------
const stripHtml = (html) => html
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/[ \t ]+/g, ' ')
  .replace(/\n\s*\n\s*\n+/g, '\n\n')
  .trim();

const picked = target.rows.slice(0, maxDocs);
const documents = [];
for (const row of picked) {
  if (!row.url) { documents.push({ row, error: 'no url' }); continue; }
  try {
    const response = await fetch(row.url, {
      headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml,*/*' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) { documents.push({ row, error: `HTTP ${response.status}` }); continue; }
    const text = stripHtml(await response.text());
    documents.push({ row, text: text.slice(0, maxChars), truncated: text.length > maxChars });
  } catch (error) {
    documents.push({ row, error: error.message });
  }
  await new Promise((r) => setTimeout(r, 150)); // EDGAR asks for under 10 req/s
}

const usable = documents.filter((d) => d.text);
console.log(`\nFetched ${usable.length}/${picked.length} document(s).`);
for (const d of documents.filter((d) => d.error)) console.log(`  could not fetch ${d.row.source_id}: ${d.error}`);
if (!usable.length) {
  console.error('\nNothing readable. Nothing written.');
  process.exit(1);
}

// --- prompt -------------------------------------------------------------------
const [masterPrompt, convictionPolicy] = await Promise.all([
  read('INVESTO_MASTER_PROMPT.md'), read('CONVICTION_POLICY.md'),
]);

const system = [
  masterPrompt, '---', convictionPolicy, '---',
  [
    'You are reading filings and writing one claim per document for the evidence store.',
    '',
    'A claim states what the document says, in one or two sentences, with figures and',
    'units where the document gives them. It is not a summary of the company and not',
    'an assessment. Do not add anything the document does not contain, and do not',
    'supply a figure from memory.',
    '',
    'Several documents in a batch are often near-identical — EDGAR splits one merger',
    'communication across many Form 425 filings. Where two documents say the same',
    'thing, say so plainly in both claims rather than inventing a difference.',
    '',
    'If a document does not support any specific claim, write what it is and what it',
    'lacks — "Form 425 cover page transmitting an investor presentation; contains no',
    'transaction terms" is a useful claim. Never write that contents are unreviewed:',
    'you are the review.',
    '',
    'Return ONLY a JSON object mapping each source_id to its claim string. No prose,',
    'no code fence, no other keys.',
  ].join('\n'),
].join('\n\n');

const userTurn = [
  `Asset: ${asset?.name ?? target.assetId} (${asset?.symbol ?? '?'}), asset_id \`${target.assetId}\`.`,
  `Batch: ${picked.length} document(s), ${target.form ?? target.rows[0].source_type}, filed ${target.date}.`,
  '',
  ...usable.map((d) => [
    `### ${d.row.source_id}`,
    `title: ${d.row.title}`,
    `url: ${d.row.url}`,
    d.truncated ? '(document truncated)' : '',
    '',
    '```',
    d.text,
    '```',
    '',
  ].filter(Boolean).join('\n')),
  `Return JSON with exactly these keys: ${JSON.stringify(usable.map((d) => d.row.source_id))}`,
].join('\n');

if (args.includes('--emit-prompt')) {
  await mkdir(path.join(root, 'research'), { recursive: true });
  const p = path.join(root, 'research', `evidence-${target.assetId}-${target.date}.prompt.md`);
  await writeFile(p, `${system}\n\n---\n\n${userTurn}\n`, 'utf8');
  console.log(`\nWrote ${path.relative(root, p)} (${(system.length + userTurn.length).toLocaleString()} chars)`);
  console.log('Run it by hand, then paste the JSON into the claim column for those source_ids.');
  process.exit(0);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('\nOPENROUTER_API_KEY is not set. Add it to .env.local, or use --emit-prompt.');
  process.exit(1);
}

console.log(`Reading with ${model}...`);
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'x-title': 'Investo Master' },
  body: JSON.stringify({
    model,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: userTurn }],
  }),
  signal: AbortSignal.timeout(600_000),
});

if (!response.ok) {
  console.error(`OpenRouter request failed (${response.status}).`);
  console.error((await response.text().catch(() => '')).slice(0, 400));
  process.exit(1);
}

const payload = await response.json();
const content = payload.choices?.[0]?.message?.content ?? '';
let claims;
try {
  claims = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
} catch {
  console.error('\nModel did not return JSON. Nothing written.');
  console.error(content.slice(0, 400));
  process.exit(1);
}

// --- write back ---------------------------------------------------------------
// Every claim goes through isReviewed() before it is stored. A model that echoes
// the placeholder, or returns an empty string, would otherwise write a stub over a
// stub and mark the batch done — the queue would then skip it forever.
const accepted = new Map();
for (const [id, claim] of Object.entries(claims)) {
  const text = String(claim ?? '').trim();
  if (!picked.some((r) => r.source_id === id)) {
    console.warn(`  ignoring ${id}: not in this batch`);
  } else if (!isReviewed({ claim: text })) {
    console.warn(`  rejecting ${id}: claim is empty or still reads as unreviewed`);
  } else {
    accepted.set(id, text);
  }
}

if (!accepted.size) {
  console.error('\nNo usable claims returned. Nothing written.');
  process.exit(1);
}

// Re-read immediately before writing. Ingestion appends to this file, and reusing
// the copy parsed at startup would drop anything that landed while documents were
// being fetched.
const currentRaw = parseCsv(await read('data', 'sources.csv'));
const [header, ...bodyRows] = currentRaw;
const idCol = header.indexOf('source_id');
const claimCol = header.indexOf('claim');
const accessedCol = header.indexOf('accessed_at');
const today = new Date().toISOString().slice(0, 10);

let written = 0;
const updated = bodyRows.map((row) => {
  const claim = accepted.get(row[idCol]);
  if (!claim) return row;
  written += 1;
  const next = [...row];
  next[claimCol] = claim;
  if (accessedCol !== -1) next[accessedCol] = today;
  return next;
});

await writeFile(path.join(root, 'data', 'sources.csv'),
  `${[header, ...updated].map((r) => r.map(csvCell).join(',')).join('\n')}\n`, 'utf8');

console.log(`\nWrote ${written} claim(s) to data/sources.csv:`);
for (const [id, claim] of accepted) console.log(`  ${id}\n    ${claim}`);
// A batch is not necessarily finished: --max-docs may have capped the fetch, and a
// claim the model failed to produce leaves its row a stub. Say how many are left
// here rather than assuming the batch is done, or the next run looks like a
// regression when the same asset comes up again.
const leftInBatch = target.rows.length - written;
console.log(`\n${stubs.length - written} unread row(s) remain in the store.`);
if (leftInBatch > 0) {
  console.log(`${leftInBatch} of them are still in this batch — run again to continue it.`);
}
