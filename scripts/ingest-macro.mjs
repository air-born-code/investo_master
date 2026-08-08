// Stage 1a — macro ingestion from FRED.
//
// Writes three things, all append-only and idempotent:
//   data/macro.csv          the current week's observation per series (the snapshot)
//   data/macro_history.csv  a rolling multi-year monthly history per series (the chart)
//   data/sources.csv        one provenance row per series per week
//
// Re-running for a week that already has rows changes nothing.
//
// This is the numbers half of the pipeline. The model never writes these values;
// it only writes prose about them, which is what keeps the store auditable. What
// each series means, and how it reaches equity prices, is authored once in
// data/macro_series.csv and rendered every week from there — so the regime section
// is tracked rather than re-explained from memory in each issue.
//
// The history exists so a number can be read against its own past. A CPI print of
// 3.5% means one thing at the end of a decade below 2% and another in year three of
// an overshoot, and no single-week snapshot can tell those apart.
//
// Transforms are verified against the hand-authored 2026-W29 figures:
//   CPIAUCSL year-over-year -> 3.5% headline, CPILFESL -> 2.6% core,
//   PAYEMS month-over-month -> +57k, UNRATE level -> 4.2%.
//
// Usage: node --env-file-if-exists=.env.local scripts/ingest-macro.mjs [--dry-run]
//
// FRED_API_KEY uses the documented API. Without it the script falls back to
// FRED's public CSV endpoint, which needs no key but returns no series metadata.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const root = path.resolve(flag('root') ?? process.cwd());
const apiKey = process.env.FRED_API_KEY;

const isoWeekId = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const today = new Date();
const weekId = isoWeekId(today);
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

const toObjects = (rows) => {
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((k, i) => [k, cells[i] ?? ''])));
};

// --- series registry ---------------------------------------------------------
// The registry, not this file, decides what is tracked. Adding a series is a data
// edit; it must carry its own regime_role and equity_transmission before it can be
// ingested, so nothing reaches the issue without a stated reason for being there.
const registryPath = path.join(root, 'data', 'macro_series.csv');
const series = toObjects(parseCsv(await readFile(registryPath, 'utf8')));

if (!series.length) {
  console.error('data/macro_series.csv holds no series. Nothing to ingest.');
  process.exit(1);
}

for (const spec of series) {
  if (!spec.regime_role || !spec.equity_transmission) {
    console.error(`${spec.series_id} is missing regime_role or equity_transmission in data/macro_series.csv.`);
    process.exit(1);
  }
}

// --- fetch -------------------------------------------------------------------
// A ten-year monthly history needs 120 observations, plus twelve more to compute a
// year-over-year figure for the earliest of them.
const historyMonths = (spec) => Math.round(Number(spec.history_years || 10) * 12);
const observationsNeeded = (spec) => historyMonths(spec) + 14;

const fetchObservations = async (spec) => {
  const limit = observationsNeeded(spec);
  if (apiKey) {
    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    url.searchParams.set('series_id', spec.series_id);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('file_type', 'json');
    url.searchParams.set('sort_order', 'desc');
    url.searchParams.set('limit', String(limit));
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`FRED API ${response.status} for ${spec.series_id}`);
    const body = await response.json();
    return body.observations
      .filter((o) => o.value !== '.')
      .map((o) => ({ date: o.date, value: Number(o.value) }));
  }
  const response = await fetch(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${spec.series_id}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok) throw new Error(`FRED CSV ${response.status} for ${spec.series_id}`);
  const rows = parseCsv(await response.text()).slice(1);
  const all = rows
    .filter((r) => r[1] && r[1] !== '.')
    .map((r) => ({ date: r[0], value: Number(r[1]) }))
    .reverse();
  return all.slice(0, limit);
};

const monthName = (isoDate) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });

// `transform` is the part that can silently produce a wrong number, so each series
// states explicitly how its published figure is derived. Observations arrive newest
// first; `at` is the index of the month being transformed.
const applyTransform = (spec, observations, at = 0) => {
  const target = observations[at];
  if (!target) return undefined;
  if (spec.transform === 'level') {
    return { value: target.value, level: target.value, observation: target.date };
  }
  if (spec.transform === 'mom_change') {
    const prior = observations[at + 1];
    if (!prior) return undefined;
    return {
      value: Math.round(target.value - prior.value),
      level: target.value,
      observation: target.date,
    };
  }
  // yoy_percent: match the same calendar month one year earlier rather than
  // counting back a fixed number of rows, which breaks on a revised series.
  const wanted = (() => {
    const d = new Date(`${target.date}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const yearAgo = observations.find((o) => o.date === wanted);
  if (!yearAgo) return undefined;
  return {
    value: Number(((target.value / yearAgo.value - 1) * 100).toFixed(1)),
    level: target.value,
    observation: target.date,
  };
};

// Claim text is derived from the transform rather than hand-written per series, so a
// new registry row cannot silently ship a sentence that misdescribes its own number.
const claimFor = (spec, value, when) => {
  if (spec.transform === 'yoy_percent') {
    const direction = value >= 0 ? 'rose' : 'fell';
    return `${spec.label} ${direction} ${Math.abs(value)}% year over year in ${when}.`;
  }
  if (spec.transform === 'mom_change') {
    return `${spec.label} changed by ${value >= 0 ? '+' : ''}${value},000 in ${when}.`;
  }
  const suffix = spec.unit === 'percent' ? '%' : '';
  return `${spec.label} was ${value}${suffix} in ${when}.`;
};

// --- run ---------------------------------------------------------------------
if (!apiKey) {
  console.warn('FRED_API_KEY not set — using the public CSV endpoint (no series metadata).');
}

const results = [];
const historyBySeries = new Map();

for (const spec of series) {
  const observations = await fetchObservations(spec);
  if (!observations.length) throw new Error(`No observations for ${spec.series_id}`);

  const latest = applyTransform(spec, observations, 0);
  if (!latest) throw new Error(`Could not transform the latest observation for ${spec.series_id}`);
  results.push({ spec, ...latest, when: monthName(latest.observation) });

  // Walk the window rather than only the head, so the chart is derived by exactly
  // the same code path as the headline number and cannot disagree with it.
  const points = [];
  for (let i = 0; i < historyMonths(spec) && i < observations.length; i += 1) {
    const point = applyTransform(spec, observations, i);
    if (point) points.push(point);
  }
  historyBySeries.set(spec.series_id, points.reverse());
}

console.log(`Macro observations for ${weekId} (as of ${asOf}):`);
for (const r of results) {
  const n = historyBySeries.get(r.spec.series_id).length;
  console.log(
    `  ${r.spec.series_id.padEnd(9)} ${String(r.value).padStart(8)}  ${r.spec.unit.padEnd(16)}` +
    ` ${r.observation}  history ${String(n).padStart(3)} months`,
  );
}

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

// --- macro.csv: the weekly snapshot ------------------------------------------
const macroPath = path.join(root, 'data', 'macro.csv');
const macroHeader = [
  'week_id', 'as_of_date', 'series_id', 'label', 'value', 'unit',
  'observation_date', 'transform', 'source_url',
];

let macroRows = [];
try {
  macroRows = parseCsv(await readFile(macroPath, 'utf8')).slice(1);
} catch { /* first run */ }

const existingMacro = new Set(macroRows.map((r) => `${r[0]}|${r[2]}`));
const newMacro = results
  .filter((r) => !existingMacro.has(`${weekId}|${r.spec.series_id}`))
  .map((r) => [
    weekId, asOf, r.spec.series_id, r.spec.label, r.value, r.spec.unit, r.observation,
    r.spec.transform, r.spec.source_url,
  ]);

// --- macro_history.csv: the chart series -------------------------------------
// Keyed on series and observation date, never on week, because the same month is
// re-fetched every week. A revised figure updates in place — FRED revisions are
// real information and pinning the first value seen would preserve a number the
// publisher has withdrawn. The revision itself is visible in git history.
const historyPath = path.join(root, 'data', 'macro_history.csv');
const historyHeader = [
  'series_id', 'observation_date', 'value', 'unit', 'transform', 'level', 'source_url',
];

let historyRows = [];
try {
  historyRows = parseCsv(await readFile(historyPath, 'utf8')).slice(1);
} catch { /* first run */ }

const historyIndex = new Map(historyRows.map((r) => [`${r[0]}|${r[1]}`, r]));
let historyAdded = 0;
let historyRevised = 0;

for (const spec of series) {
  for (const point of historyBySeries.get(spec.series_id)) {
    const key = `${spec.series_id}|${point.observation}`;
    const row = [
      spec.series_id, point.observation, point.value, spec.unit, spec.transform,
      point.level, spec.source_url,
    ];
    const prior = historyIndex.get(key);
    if (!prior) historyAdded += 1;
    else if (prior[2] !== String(point.value) || prior[5] !== String(point.level)) historyRevised += 1;
    else continue;
    historyIndex.set(key, row);
  }
}

const sortedHistory = [...historyIndex.values()].sort(
  (a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]),
);

// --- sources.csv: provenance --------------------------------------------------
const sourcesPath = path.join(root, 'data', 'sources.csv');
const sourcesText = await readFile(sourcesPath, 'utf8');
const sourcesRows = parseCsv(sourcesText);
const existingSources = new Set(sourcesRows.slice(1).map((r) => r[0]));

const weekSlug = weekId.toLowerCase();
const newSources = results
  .map((r) => ({ r, id: `src-${weekSlug}-fred-${r.spec.series_id.toLowerCase()}` }))
  .filter(({ id }) => !existingSources.has(id))
  .map(({ r, id }) => [
    id, asOf, '', '', 'macro_series', `FRED series ${r.spec.series_id}: ${r.spec.label}`,
    'Federal Reserve Bank of St. Louis (FRED)', r.observation, asOf,
    r.spec.source_url, 'true', 'context',
    claimFor(r.spec, r.value, r.when), 'high',
  ]);

if (!newMacro.length && !newSources.length && !historyAdded && !historyRevised) {
  console.log(`\nNothing to write — ${weekId} already ingested and no history revisions.`);
  process.exit(0);
}

if (newMacro.length) {
  const body = [macroHeader, ...macroRows, ...newMacro]
    .map((row) => row.map(csvCell).join(',')).join('\n');
  await writeFile(macroPath, `${body}\n`, 'utf8');
}

if (historyAdded || historyRevised) {
  const body = [historyHeader, ...sortedHistory]
    .map((row) => row.map(csvCell).join(',')).join('\n');
  await writeFile(historyPath, `${body}\n`, 'utf8');
}

if (newSources.length) {
  const trimmed = sourcesText.endsWith('\n') ? sourcesText : `${sourcesText}\n`;
  const appended = newSources.map((row) => row.map(csvCell).join(',')).join('\n');
  await writeFile(sourcesPath, `${trimmed}${appended}\n`, 'utf8');
}

console.log(`\nWrote data/macro.csv: +${newMacro.length} rows (${macroRows.length + newMacro.length} total)`);
console.log(
  `Wrote data/macro_history.csv: +${historyAdded} new, ${historyRevised} revised` +
  ` (${sortedHistory.length} total across ${series.length} series)`,
);
console.log(`Wrote data/sources.csv: +${newSources.length} provenance rows`);
