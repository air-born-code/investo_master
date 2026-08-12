// AI value-chain profit-pool tracker.
//
// The question this answers every week: is profit in the AI chain moving down the
// stack toward the physical layers as the buildout matures, or staying concentrated
// at the top?
//
// It deliberately does NOT re-estimate the profit shares. The cents in
// data/ai_value_chain.csv are one house's estimate on one date (iCapital, July 2026)
// and are frozen as a dated benchmark. Recomputing them weekly from our own data
// would produce a number that looks measured and is not, which is the specific
// failure this file exists to avoid.
//
// What it does instead is record the observable proxies that would show the pool
// moving, per layer, from data already in the store: how much market value we track
// in each layer, how it moved, what the layer's names are growing at, and — restated
// every single week so it cannot quietly become invisible — which layers we hold
// nothing in.
//
// Writes one thing: data/ai_profit_pool.csv, append-only, keyed on week plus layer.
// Re-running a week rewrites that week's rows rather than duplicating them.
//
// Usage: node scripts/ingest-ai-chain.mjs [--dry-run]
//
// Options:
//   --week <id>      ISO week id to write (default: current week)
//   --root <path>    project root (default: cwd)

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const root = path.resolve(flag('root') ?? process.cwd());

const isoWeekId = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const today = new Date();
const weekId = flag('week') ?? isoWeekId(today);
const asOf = today.toISOString().slice(0, 10);

// --- CSV ---------------------------------------------------------------------
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift();
  return rows
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
};

const readTable = async (file) => {
  try {
    return parseCsv(await readFile(path.join(root, 'data', file), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const median = (values) => {
  const xs = values.filter((v) => v !== undefined).sort((a, b) => a - b);
  if (!xs.length) return undefined;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};

// --- inputs ------------------------------------------------------------------
const chain = await readTable('ai_value_chain.csv');
const metrics = await readTable('weekly_metrics.csv');
const growth = await readTable('growth_estimates.csv');
const existing = await readTable('ai_profit_pool.csv');

if (!chain.length) {
  console.error('data/ai_value_chain.csv is empty or missing. Nothing to track.');
  process.exit(1);
}

// The comparison week is the last week the store actually recorded metrics before
// this one — not "seven days ago". If prices were not collected last week, the
// change column must say so rather than silently compare against a stale snapshot.
const metricWeeks = [...new Set(metrics.map((m) => m.week_id))].sort();
const latestMetricWeek = metricWeeks.at(-1);
const priorMetricWeek = metricWeeks.at(-2);

const snapshotFor = (week) => new Map(
  metrics.filter((m) => m.week_id === week).map((m) => [m.asset_id, m]),
);
const latest = snapshotFor(latestMetricWeek);
const prior = snapshotFor(priorMetricWeek);

const evidenceOf = new Map(growth.map((g) => [g.asset_id, g.evidence_basis]));

// --- one row per layer -------------------------------------------------------
const rows = chain.map((layer) => {
  const ids = (layer.asset_ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const capNow = ids.reduce((sum, id) => sum + (num(latest.get(id)?.market_cap) ?? 0), 0);
  const capThen = ids.reduce((sum, id) => sum + (num(prior.get(id)?.market_cap) ?? 0), 0);
  // Only compare when both snapshots cover the same names; a name that appeared or
  // dropped out between weeks would otherwise show up as a move in the pool.
  const comparable = ids.length > 0
    && ids.every((id) => num(latest.get(id)?.market_cap) !== undefined)
    && ids.every((id) => num(prior.get(id)?.market_cap) !== undefined);
  const capChange = comparable && capThen ? ((capNow / capThen - 1) * 100) : undefined;

  const medianGrowth = median(ids.map((id) => num(latest.get(id)?.revenue_growth_yoy)));
  const medianMargin = median(ids.map((id) => num(latest.get(id)?.gross_margin)));

  const onPrimary = ids.filter((id) => evidenceOf.get(id) === 'primary_filing').length;
  const onInference = ids.filter((id) => evidenceOf.get(id) === 'screen_inference').length;

  // The gap note is regenerated every week on purpose. A layer we hold nothing in
  // is the finding, and a blank cell reads like an absence of data rather than an
  // absence of coverage.
  const cents = num(layer.profit_cents);
  const note = ids.length === 0
    ? (cents && cents > 0
      ? `No coverage. Benchmark attributes ${cents}c of every AI dollar to this layer.`
      : 'No coverage. Benchmark attributes no profit box to this layer.')
    : (capChange === undefined
      ? `${ids.length} names tracked; no comparable prior snapshot for a change figure.`
      : `${ids.length} names tracked.`);

  return {
    week_id: weekId,
    as_of_date: asOf,
    layer_id: layer.layer_id,
    layer_name: layer.name,
    exposure_class: layer.exposure_class ?? 'none',
    benchmark_profit_cents: layer.profit_cents ?? '',
    benchmark_source_id: layer.benchmark_source_id ?? '',
    our_name_count: ids.length,
    aggregate_market_cap_usd: capNow || '',
    market_cap_change_pct: capChange === undefined ? '' : capChange.toFixed(2),
    compared_with_week: capChange === undefined ? '' : (priorMetricWeek ?? ''),
    metrics_from_week: latestMetricWeek ?? '',
    median_revenue_growth_yoy: medianGrowth === undefined ? '' : medianGrowth.toFixed(3),
    median_gross_margin: medianMargin === undefined ? '' : medianMargin.toFixed(3),
    names_on_primary_evidence: onPrimary,
    names_on_screen_inference: onInference,
    note,
    recorded_at: new Date().toISOString(),
  };
});

const HEADER = [
  'week_id', 'as_of_date', 'layer_id', 'layer_name', 'exposure_class', 'benchmark_profit_cents',
  'benchmark_source_id', 'our_name_count', 'aggregate_market_cap_usd',
  'market_cap_change_pct', 'compared_with_week', 'metrics_from_week',
  'median_revenue_growth_yoy', 'median_gross_margin', 'names_on_primary_evidence',
  'names_on_screen_inference', 'note', 'recorded_at',
];

// Re-running a week replaces that week rather than appending a second copy, so the
// script is safe to run repeatedly on the same day.
const kept = existing.filter((r) => r.week_id !== weekId);
const out = [...kept, ...rows]
  .sort((a, b) => (a.week_id === b.week_id
    ? String(a.layer_id).localeCompare(String(b.layer_id))
    : String(a.week_id).localeCompare(String(b.week_id))));

const csv = [
  HEADER.join(','),
  ...out.map((r) => HEADER.map((h) => csvCell(r[h])).join(',')),
].join('\n') + '\n';

// --- report ------------------------------------------------------------------
// Cents are summed by exposure class, not by "do we hold anything here". Holding
// four interconnect names in the layer whose 13.0c describes merchant accelerators
// is adjacency, and counting it as coverage would produce a flattering number that
// is the exact opposite of what this tracker is for.
const centsIn = (cls) => rows
  .filter((r) => r.exposure_class === cls)
  .reduce((s, r) => s + Math.max(num(r.benchmark_profit_cents) ?? 0, 0), 0);

const covered = rows.filter((r) => r.our_name_count > 0);
const uncovered = rows.filter((r) => r.our_name_count === 0 && num(r.benchmark_profit_cents) > 0);
const missedCents = uncovered.reduce((s, r) => s + (num(r.benchmark_profit_cents) ?? 0), 0);

console.log(`AI value chain — ${weekId} (metrics from ${latestMetricWeek ?? 'none'})`);
console.log(`  ${rows.length} layers, ${covered.length} with coverage`);
console.log(`  benchmark cents held directly (core):  ${centsIn('core').toFixed(1)}c`);
console.log(`  benchmark cents held adjacently:       ${centsIn('adjacent').toFixed(1)}c`);
console.log(`  benchmark cents with no coverage:      ${missedCents.toFixed(1)}c`);
if (uncovered.length) {
  console.log(`  uncovered profit layers: ${uncovered.map((r) => `${r.layer_id} (${r.benchmark_profit_cents}c)`).join(', ')}`);
}
if (!priorMetricWeek) {
  console.log('  no prior metrics week — change columns left blank rather than assumed');
}

if (dryRun) {
  console.log('\n--dry-run: data/ai_profit_pool.csv not written');
} else {
  await writeFile(path.join(root, 'data', 'ai_profit_pool.csv'), csv, 'utf8');
  console.log(`\nWrote data/ai_profit_pool.csv — ${out.length} rows`);
}
