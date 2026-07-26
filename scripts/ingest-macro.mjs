// Stage 1a — macro ingestion from FRED.
//
// Appends the current week's macro observations to data/macro.csv and a
// provenance row per series to data/sources.csv. Append-only and idempotent:
// re-running for a week that already has rows changes nothing.
//
// This is the numbers half of the pipeline. The model never writes these values;
// it only writes prose about them, which is what keeps the store auditable.
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

// `transform` is the part that can silently produce a wrong number, so each
// series states explicitly how its published figure is derived.
const series = [
  {
    id: 'FEDFUNDS',
    label: 'Effective federal funds rate',
    unit: 'percent',
    transform: 'level',
    claim: (v, when) => `The effective federal funds rate was ${v}% in ${when}.`,
  },
  {
    id: 'CPIAUCSL',
    label: 'US headline CPI',
    unit: 'percent_yoy',
    transform: 'yoy_percent',
    claim: (v, when) => `US headline CPI rose ${v}% year over year in ${when}.`,
  },
  {
    id: 'CPILFESL',
    label: 'US core CPI',
    unit: 'percent_yoy',
    transform: 'yoy_percent',
    claim: (v, when) => `US core CPI rose ${v}% year over year in ${when}.`,
  },
  {
    id: 'UNRATE',
    label: 'US unemployment rate',
    unit: 'percent',
    transform: 'level',
    claim: (v, when) => `US unemployment was ${v}% in ${when}.`,
  },
  {
    id: 'PAYEMS',
    label: 'US nonfarm payrolls, monthly change',
    unit: 'thousands_change',
    transform: 'mom_change',
    claim: (v, when) => `US nonfarm payrolls changed by ${v},000 in ${when}.`,
  },
];

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

// --- fetch -------------------------------------------------------------------
// 14 observations is enough for a year-over-year comparison on monthly data.
const fetchObservations = async (id) => {
  if (apiKey) {
    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    url.searchParams.set('series_id', id);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('file_type', 'json');
    url.searchParams.set('sort_order', 'desc');
    url.searchParams.set('limit', '14');
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`FRED API ${response.status} for ${id}`);
    const body = await response.json();
    return body.observations
      .filter((o) => o.value !== '.')
      .map((o) => ({ date: o.date, value: Number(o.value) }));
  }
  const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`FRED CSV ${response.status} for ${id}`);
  const rows = parseCsv(await response.text()).slice(1);
  return rows
    .filter((r) => r[1] && r[1] !== '.')
    .map((r) => ({ date: r[0], value: Number(r[1]) }))
    .reverse();
};

const monthName = (isoDate) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });

const applyTransform = (spec, observations) => {
  const [latest] = observations;
  if (!latest) throw new Error(`No observations for ${spec.id}`);
  if (spec.transform === 'level') return { value: latest.value, observation: latest.date };
  if (spec.transform === 'mom_change') {
    const prior = observations[1];
    if (!prior) throw new Error(`Need two observations for ${spec.id}`);
    return { value: Math.round(latest.value - prior.value), observation: latest.date };
  }
  // yoy_percent: match the same calendar month one year earlier rather than
  // counting back a fixed number of rows, which breaks on a revised series.
  const target = new Date(`${latest.date}T00:00:00Z`);
  target.setUTCFullYear(target.getUTCFullYear() - 1);
  const wanted = target.toISOString().slice(0, 10);
  const yearAgo = observations.find((o) => o.date === wanted);
  if (!yearAgo) throw new Error(`No ${wanted} observation for ${spec.id} to compute year-over-year`);
  return {
    value: Number(((latest.value / yearAgo.value - 1) * 100).toFixed(1)),
    observation: latest.date,
  };
};

// --- run ---------------------------------------------------------------------
if (!apiKey) {
  console.warn('FRED_API_KEY not set — using the public CSV endpoint (no series metadata).');
}

const results = [];
for (const spec of series) {
  const observations = await fetchObservations(spec.id);
  const { value, observation } = applyTransform(spec, observations);
  results.push({ ...spec, value, observation, when: monthName(observation) });
}

console.log(`Macro observations for ${weekId} (as of ${asOf}):`);
for (const r of results) {
  console.log(`  ${r.id.padEnd(9)} ${String(r.value).padStart(8)}  ${r.unit.padEnd(16)} ${r.observation}`);
}

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

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
  .filter((r) => !existingMacro.has(`${weekId}|${r.id}`))
  .map((r) => [
    weekId, asOf, r.id, r.label, r.value, r.unit, r.observation, r.transform,
    `https://fred.stlouisfed.org/series/${r.id}`,
  ]);

const sourcesPath = path.join(root, 'data', 'sources.csv');
const sourcesText = await readFile(sourcesPath, 'utf8');
const sourcesRows = parseCsv(sourcesText);
const existingSources = new Set(sourcesRows.slice(1).map((r) => r[0]));

const weekSlug = weekId.toLowerCase();
const newSources = results
  .map((r) => ({ r, id: `src-${weekSlug}-fred-${r.id.toLowerCase()}` }))
  .filter(({ id }) => !existingSources.has(id))
  .map(({ r, id }) => [
    id, asOf, '', '', 'macro_series', `FRED series ${r.id}: ${r.label}`,
    'Federal Reserve Bank of St. Louis (FRED)', r.observation, asOf,
    `https://fred.stlouisfed.org/series/${r.id}`, 'true', 'context',
    r.claim(r.value, r.when), 'high',
  ]);

if (!newMacro.length && !newSources.length) {
  console.log(`\nNothing to write — ${weekId} already ingested.`);
  process.exit(0);
}

if (newMacro.length) {
  const body = [macroHeader, ...macroRows, ...newMacro]
    .map((row) => row.map(csvCell).join(',')).join('\n');
  await writeFile(macroPath, `${body}\n`, 'utf8');
}

if (newSources.length) {
  const trimmed = sourcesText.endsWith('\n') ? sourcesText : `${sourcesText}\n`;
  const appended = newSources.map((row) => row.map(csvCell).join(',')).join('\n');
  await writeFile(sourcesPath, `${trimmed}${appended}\n`, 'utf8');
}

console.log(`\nWrote data/macro.csv: +${newMacro.length} rows (${macroRows.length + newMacro.length} total)`);
console.log(`Wrote data/sources.csv: +${newSources.length} provenance rows`);
