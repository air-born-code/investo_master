// One-off repair for data/sources.csv, safe to re-run.
//
// Two distinct faults accumulated in the store, and they want opposite treatment:
//
//   Duplicate source_id (16 rows). Every one is a merger communication filed once
//   and reported under two CIKs, so ingestion built two rows — correctly, one per
//   tracked asset — and gave them the same id, because the id was keyed on the
//   accession alone. Both rows are real evidence. The repair is to renumber, never
//   to delete: Issue 003's headline finding was precisely that these accessions
//   appear under both Dominion and NextEra.
//
//   Duplicate URL (9 rows). Most are not redundant either. Three are separate
//   reviewed claims drawn from one GE Vernova press release and one Vertiv release;
//   three more are macro series re-read a fortnight later with a new print. Only a
//   row repeating an earlier row's claim about the same document adds nothing, and
//   only those are dropped.
//
// So: renumber collisions, drop exact claim repeats, and leave every row that
// carries information some other row does not.
//
// Usage: node scripts/dedupe-sources.mjs [--dry-run] [--root <path>]

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isReviewed } from './lib/rotation.mjs';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const root = path.resolve(flag('root') ?? process.cwd());

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

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

// --- what has already been published -----------------------------------------
// reports/ holds issues that have been sent and drafts/ the text they came from.
// A source_id quoted in either is a live citation: renumbering or deleting it
// would leave a reader following a reference into an empty store. Those ids are
// pinned, which is why renumbering keeps the first row of a collision and moves
// the second.
const citedIds = new Set();
const scanForIds = async (dir) => {
  let entries;
  try { entries = await readdir(path.join(root, dir), { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) { await scanForIds(rel); continue; }
    const text = await readFile(path.join(root, rel), 'utf8').catch(() => '');
    for (const [, id] of text.matchAll(/\b(src-[a-z0-9][a-z0-9-]*)/gi)) citedIds.add(id);
  }
};
await scanForIds('reports');
await scanForIds('drafts');

// --- read ---------------------------------------------------------------------
const sourcesPath = path.join(root, 'data', 'sources.csv');
const original = await readFile(sourcesPath, 'utf8');
const [header, ...body] = parseCsv(original);
const col = Object.fromEntries(header.map((k, i) => [k, i]));
const get = (row, name) => row[col[name]] ?? '';

const accessionOf = (row) =>
  /^src-edgar-(?:[a-z0-9]+-)?(\d{18})$/.exec(get(row, 'source_id'))?.[1]
  ?? /\/Archives\/edgar\/data\/\d+\/(\d{18})\//.exec(get(row, 'url'))?.[1];

// --- pass 1: drop rows whose claim about a document is already recorded --------
// Keyed on claim as well as document, so the GE Vernova release keeps its three
// findings and a macro series keeps each new print. Reviewed rows are never
// dropped even on an exact repeat: a re-read that reached the same conclusion is
// worth more than the stub it replaced, and losing one silently is the failure
// mode this whole exercise is about.
const kept = [];
const dropped = [];
const seenClaims = new Set();
for (const row of body) {
  const url = get(row, 'url');
  const key = `${get(row, 'asset_id')}|${url}|${get(row, 'claim')}`;
  const redundant = Boolean(url) && seenClaims.has(key);
  const pinned = citedIds.has(get(row, 'source_id'));
  if (redundant && !pinned) { dropped.push(row); continue; }
  seenClaims.add(key);
  kept.push(row);
}

// --- pass 2: give every remaining row a unique source_id ----------------------
// First occurrence keeps the id it was published under; later ones take the
// (asset, accession) form ingestion now writes, so the store and the script agree
// on how a filing is named from here on.
const renumbered = [];
const takenIds = new Set();
for (const row of kept) {
  const id = get(row, 'source_id');
  if (!takenIds.has(id)) { takenIds.add(id); continue; }

  const assetId = get(row, 'asset_id');
  const accession = accessionOf(row);
  let next = accession && assetId
    ? `src-edgar-${assetId}-${accession}`
    : `${id}-${assetId || 'x'}`;
  for (let n = 2; takenIds.has(next); n += 1) next = `${id}-${assetId || 'x'}-${n}`;

  takenIds.add(next);
  renumbered.push({ from: id, to: next, assetId, title: get(row, 'title') });
  row[col.source_id] = next;
}

// --- report -------------------------------------------------------------------
const stubs = kept.filter((r) => !isReviewed(Object.fromEntries(header.map((k, i) => [k, r[i] ?? '']))));
console.log(`data/sources.csv: ${body.length} rows in, ${kept.length} out`);
console.log(`  ${dropped.length} dropped as an exact repeat of an earlier claim`);
for (const row of dropped) {
  console.log(`    ${get(row, 'source_id')}  ${get(row, 'title')}`);
}
console.log(`  ${renumbered.length} renumbered to break a source_id collision`);
for (const r of renumbered) {
  console.log(`    ${r.from} -> ${r.to}  (${r.assetId}: ${r.title})`);
}
console.log(`  ${stubs.length} rows still carry a placeholder claim — see npm run evidence:next`);

const remainingDupIds = [...takenIds].length !== kept.length;
if (remainingDupIds) console.warn('  WARNING: source_id is still not unique.');

const citedAndMissing = [...citedIds].filter((id) =>
  id.startsWith('src-') && body.some((r) => get(r, 'source_id') === id)
    && !kept.some((r) => get(r, 'source_id') === id));
if (citedAndMissing.length) {
  console.error(`  ERROR: would drop ${citedAndMissing.length} row(s) cited in a published issue.`);
  process.exit(1);
}

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}
if (!dropped.length && !renumbered.length) {
  console.log('\nNothing to change.');
  process.exit(0);
}

const out = [header, ...kept].map((row) => row.map(csvCell).join(',')).join('\n');
await writeFile(sourcesPath, `${out}\n`, 'utf8');
console.log('\nRewrote data/sources.csv.');
