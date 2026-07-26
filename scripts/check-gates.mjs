// Stage 2 — decision-gate ledger.
//
// CONVICTION_POLICY.md lists thirteen gates that must all be documented before
// an opportunity can be labelled Decision Review. Nothing in the store recorded
// whether any of them were met, so the answer lived only in judgement and in
// whatever a given week's draft happened to notice.
//
// This maintains data/gates.csv — one row per asset per gate — and reports
// completeness deterministically. It does not decide whether a gate is met:
// that is the human judgement the policy exists to protect. Rows start as
// not_assessed, which is honestly different from missing.
//
// Usage:
//   node scripts/check-gates.mjs            report completeness
//   node scripts/check-gates.mjs --init     create rows for any missing pairs
//   node scripts/check-gates.mjs --strict   exit non-zero if any asset is incomplete

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const init = argv.includes('--init');
const strict = argv.includes('--strict');
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const root = path.resolve(flag('root') ?? process.cwd());

// Verbatim from CONVICTION_POLICY.md "Minimum gate for decision review".
// Keep the numbering and names in sync with that document; it is the authority.
const GATES = [
  [1, 'falsifiable_thesis', 'Falsifiable thesis'],
  [2, 'primary_evidence', 'Primary evidence'],
  [3, 'variant_perception', 'Variant perception'],
  [4, 'power_law_potential', 'Power-law potential'],
  [5, 'durability', 'Durability'],
  [6, 'management_incentives', 'Management and incentives'],
  [7, 'economics_resilience', 'Economics and financial resilience'],
  [8, 'disconfirming_research', 'Disconfirming research'],
  [9, 'valuation_asymmetry', 'Valuation asymmetry'],
  [10, 'pre_mortem', 'Pre-mortem'],
  [11, 'kill_criteria', 'Kill criteria'],
  [12, 'monitoring_plan', 'Monitoring plan'],
  [13, 'position_sizing', 'Position-sizing assessment'],
];

const STATUSES = new Set(['not_assessed', 'missing', 'drafted', 'documented']);
const COMPLETE = 'documented';

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

const readTable = async (name) => {
  const rows = parseCsv(await readFile(path.join(root, 'data', name), 'utf8'));
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((k, i) => [k, cells[i] ?? ''])));
};

const allAssets = await readTable('assets.csv');

// Gates apply to candidates only. Universe membership implies coverage, not
// interest, and laying thirteen empty gates over a hundred tracked names would
// make the ledger noise rather than a signal. A missing tier is treated as
// candidate so a store predating tiering still reports.
const CANDIDATE_TIERS = new Set(['candidate', '']);
const assets = allAssets.filter((a) => CANDIDATE_TIERS.has(a.tier ?? ''));
const covered = allAssets.length - assets.length;

const gatesPath = path.join(root, 'data', 'gates.csv');
const header = ['asset_id', 'gate_number', 'gate_id', 'gate_name', 'status', 'evidence_ref', 'assessed_date', 'notes'];

let existing = [];
try {
  existing = await readTable('gates.csv');
} catch { /* first run */ }

const key = (assetId, gateId) => `${assetId}|${gateId}`;
const byKey = new Map(existing.map((r) => [key(r.asset_id, r.gate_id), r]));

if (init) {
  const added = [];
  for (const asset of assets) {
    for (const [number, gateId, gateName] of GATES) {
      if (byKey.has(key(asset.asset_id, gateId))) continue;
      const row = {
        asset_id: asset.asset_id,
        gate_number: String(number),
        gate_id: gateId,
        gate_name: gateName,
        status: 'not_assessed',
        evidence_ref: '',
        assessed_date: '',
        notes: '',
      };
      byKey.set(key(asset.asset_id, gateId), row);
      added.push(row);
    }
  }
  if (added.length) {
    const all = [...byKey.values()].sort(
      (a, b) => a.asset_id.localeCompare(b.asset_id) || Number(a.gate_number) - Number(b.gate_number),
    );
    const body = [header, ...all.map((r) => header.map((h) => r[h] ?? ''))]
      .map((row) => row.map(csvCell).join(',')).join('\n');
    await writeFile(gatesPath, `${body}\n`, 'utf8');
    console.log(`Wrote data/gates.csv: +${added.length} rows (${all.length} total)\n`);
  } else {
    console.log('data/gates.csv already covers every asset and gate.\n');
  }
}

const rows = [...byKey.values()];
if (!rows.length) {
  console.error('No data/gates.csv found. Run with --init to create the ledger.');
  process.exit(1);
}

// Surface bad data rather than silently treating an unknown status as incomplete.
const invalid = rows.filter((r) => !STATUSES.has(r.status));
if (invalid.length) {
  console.error(`Invalid status values (allowed: ${[...STATUSES].join(', ')}):`);
  for (const r of invalid) console.error(`  ${r.asset_id} gate ${r.gate_number}: "${r.status}"`);
  process.exit(1);
}

const symbolFor = new Map(assets.map((a) => [a.asset_id, a.symbol || a.asset_id]));
const stageFor = new Map(assets.map((a) => [a.asset_id, a.stage || '']));
const assetIds = [...new Set(rows.map((r) => r.asset_id))].sort();

console.log(`Decision-gate completeness (${GATES.length} gates per asset)\n`);
console.log(`  ${'Asset'.padEnd(7)}${'Stage'.padEnd(13)}${'Documented'.padEnd(12)}Outstanding gates`);

const incomplete = [];
for (const assetId of assetIds) {
  const own = rows.filter((r) => r.asset_id === assetId);
  const done = own.filter((r) => r.status === COMPLETE);
  const missing = own
    .filter((r) => r.status !== COMPLETE)
    .sort((a, b) => Number(a.gate_number) - Number(b.gate_number))
    .map((r) => r.gate_number);
  if (missing.length) incomplete.push(assetId);
  const summary = missing.length ? missing.join(', ') : 'none — eligible for decision review';
  console.log(
    `  ${symbolFor.get(assetId).padEnd(7)}${stageFor.get(assetId).padEnd(13)}` +
    `${`${done.length}/${GATES.length}`.padEnd(12)}${summary}`,
  );
}

// A gate outstanding across every asset is a systemic hole, not an asset-specific
// one, and is usually the highest-leverage thing to fix.
console.log('\nGates outstanding across all assets:');
const systemic = GATES.filter(([, gateId]) =>
  assetIds.every((assetId) => byKey.get(key(assetId, gateId))?.status !== COMPLETE));
if (!systemic.length) console.log('  none');
for (const [number, , gateName] of systemic) console.log(`  ${String(number).padStart(2)}. ${gateName}`);

console.log(`\n${assetIds.length - incomplete.length} of ${assetIds.length} candidates clear all gates.`);
if (covered) console.log(`${covered} further asset(s) tracked at a lower tier, where gates do not apply.`);
console.log('Status values: not_assessed (nobody has looked), missing, drafted, documented.');

if (strict && incomplete.length) {
  console.error(`\nStrict mode: ${incomplete.length} asset(s) incomplete.`);
  process.exit(1);
}
