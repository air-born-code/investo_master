// Stage 1d — frontier signal ingestion for candidate and fringe themes.
//
// Writes one thing: data/theme_signals.csv, append-only and keyed on week and
// signal. Re-running for a week that already has rows changes nothing.
//
// It deliberately does NOT write to data/sources.csv. Everything in this file is
// speculative by construction — candidates that have not passed the precondition
// test, and fringe entries that mostly will not survive. Letting that reach the
// weekly evidence base would put unexamined material next to SEC filings and
// central bank releases, and the separation between the two is the point of
// having a frontier tier at all. Signal rows carry their own source_url and
// accessed date, which is provenance enough for material nothing is decided on.
//
// What is measured, and why it is measured this way:
//
//   Rates, not levels, where the source supports it. arXiv fetches the trailing
//   window AND the same window one year earlier, because the level of a series only
//   tells you how large a field already is. The year-over-year change is the entire
//   signal, and computing it here rather than at read time means the comparison
//   cannot be quietly done wrong later.
//
//   GitHub search deliberately does NOT do this, and the reason is worth recording.
//   Its index prunes deleted, private and dormant repositories, so a query for a
//   past window returns repositories created then AND still alive now, while the
//   current window returns everything just created. Measured on 2026-08-08, the
//   same 90-day topic:robotics window returned 3798 for 2026 and then 647, 433,
//   358, 382, 401 for 2021-2025 — a cliff at the present followed by five flat
//   years, which is attrition and not growth. A naive year-over-year read produced
//   +487%, and the equivalent error appeared on all six topics at once. So the
//   level is recorded and the comparison is left empty; it becomes available
//   honestly in a year, when this store can compare its own equally-aged readings.
//
//   Cumulative counters are different. A GitHub star count only rises, so its
//   level is close to meaningless. For those rows the useful field is `detail`,
//   which carries the last-push date — whether the artifact is still alive is the
//   question that mattered for Bitcoin in 2010, and it is not answerable from a
//   star count.
//
// Sources and their quirks, all verified against the live APIs:
//   - arXiv: free, no key. Date-range syntax is submittedDate:[YYYYMMDDHHMM TO ...]
//     and the brackets must be percent-encoded. Asks for ~3s between requests.
//   - GitHub search: free, no key, but only 10 requests per minute unauthenticated,
//     which is the binding constraint on this whole script. Set GITHUB_TOKEN to
//     raise it to 30/min. Exceeding it returns HTTP 403, not 429.
//   - GitHub repos: a different and far more generous bucket (60/hr unauthenticated).
//   - pypistats.org: free, no key, and rate-limits aggressively on rapid sequential
//     calls. It returns HTTP 200 with an HTML body when it throttles, so a JSON
//     parse failure here means throttling rather than a malformed response.
//   - npm registry downloads: free, no key, no meaningful limit.
//
// Every fetch is best-effort. One throttled source must not lose the other
// nineteen rows, so a failed signal is reported and skipped rather than thrown.
//
// Usage: node --env-file-if-exists=.env.local scripts/ingest-signals.mjs [--dry-run]
//
// Options:
//   --only <signal_id>   ingest a single registry row
//   --source <name>      ingest one source only (arxiv, github, github_repo, pypi, npm)
//   --scope <name>       ingest one scope only (candidate, fringe, theme_calibration)
//   --root <path>        project root (default: cwd)

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const root = path.resolve(flag('root') ?? process.cwd());
const onlySignal = flag('only');
const onlySource = flag('source');
const onlyScope = flag('scope');
const githubToken = process.env.GITHUB_TOKEN;

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- registry ----------------------------------------------------------------
// As with macro_series.csv, the registry and not this file decides what is
// tracked. A row must state its lead-time band, what it measures and its caveat
// before it can be ingested, so no number reaches the store without a written
// reason for being there and a written reason to distrust it.
const registryPath = path.join(root, 'data', 'signal_registry.csv');
const registry = toObjects(parseCsv(await readFile(registryPath, 'utf8')));

if (!registry.length) {
  console.error('data/signal_registry.csv holds no signals. Nothing to ingest.');
  process.exit(1);
}

const KNOWN_SOURCES = new Set(['arxiv', 'github', 'github_repo', 'pypi', 'npm']);

for (const spec of registry) {
  if (!spec.lead_time_band || !spec.what_it_measures || !spec.caveat) {
    console.error(`${spec.signal_id} is missing lead_time_band, what_it_measures or caveat in data/signal_registry.csv.`);
    process.exit(1);
  }
  if (!KNOWN_SOURCES.has(spec.source)) {
    console.error(`${spec.signal_id} names an unknown source "${spec.source}". Known: ${[...KNOWN_SOURCES].join(', ')}.`);
    process.exit(1);
  }
}

// Referential integrity is a warning rather than a failure. A signal can legitimately
// outlive the candidate it was written for — that is what a rejected candidate looks
// like — and losing the series at the moment of rejection would destroy the evidence
// for why it was rejected.
const subjectIds = new Set();
for (const [file, key] of [
  ['candidate_themes.csv', 'candidate_id'],
  ['fringe_watch.csv', 'fringe_id'],
  ['themes.csv', 'theme_id'],
]) {
  try {
    for (const row of toObjects(parseCsv(await readFile(path.join(root, 'data', file), 'utf8')))) {
      subjectIds.add(row[key]);
    }
  } catch { /* optional file */ }
}
const orphans = registry.filter((s) => s.subject_id && !subjectIds.has(s.subject_id));
if (orphans.length) {
  console.warn(`Signals reference subjects absent from the tier files: ${[...new Set(orphans.map((o) => o.subject_id))].join(', ')}\n`);
}

// --- windows -----------------------------------------------------------------
// Windows end yesterday, never today: a partial day of submissions compared against
// a full day a year ago manufactures a decline that is not there.
const dayMs = 86_400_000;
const windowFor = (days) => {
  const end = new Date(today.getTime() - dayMs);
  const start = new Date(end.getTime() - (Number(days) - 1) * dayMs);
  return { start, end };
};
const shiftYear = ({ start, end }) => {
  const back = (d) => {
    const c = new Date(d);
    c.setUTCFullYear(c.getUTCFullYear() - 1);
    return c;
  };
  return { start: back(start), end: back(end) };
};
const ymd = (d) => d.toISOString().slice(0, 10);
const arxivStamp = (d, tail) => `${ymd(d).replaceAll('-', '')}${tail}`;

// --- fetching ----------------------------------------------------------------
const lastCallAt = new Map();
const minInterval = (source) => {
  if (source === 'arxiv') return 3500;
  if (source === 'github') return githubToken ? 2200 : 7000;
  if (source === 'github_repo') return 1200;
  if (source === 'pypi') return 6500;
  return 1000;
};

const pace = async (source) => {
  const previous = lastCallAt.get(source) ?? 0;
  const wait = previous + minInterval(source) - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt.set(source, Date.now());
};

const request = async (source, url, parse) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await pace(source);
    try {
      const headers = { 'user-agent': 'Investo Master research script' };
      if (source.startsWith('github') && githubToken) headers.authorization = `Bearer ${githubToken}`;
      if (source.startsWith('github')) headers.accept = 'application/vnd.github+json';
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
      // GitHub signals search throttling with 403 rather than 429, and pypistats
      // returns 200 with an HTML body, so status alone cannot detect either.
      if (response.status === 403 || response.status === 429) {
        throw new Error(`rate limited (HTTP ${response.status})`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await parse(response);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(15_000 * (attempt + 1));
    }
  }
  throw lastError;
};

const arxivCount = async (category, window) => {
  const query = `cat:${category} AND submittedDate:[${arxivStamp(window.start, '0000')} TO ${arxivStamp(window.end, '2359')}]`;
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&max_results=1`;
  return request('arxiv', url, async (response) => {
    const match = (await response.text()).match(/<opensearch:totalResults[^>]*>(\d+)</);
    if (!match) throw new Error('arXiv returned no totalResults element');
    return Number(match[1]);
  });
};

const githubCreated = async (query, window) => {
  const q = `${query} created:${ymd(window.start)}..${ymd(window.end)}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=1`;
  return request('github', url, async (response) => {
    const body = await response.json();
    if (typeof body.total_count !== 'number') throw new Error('GitHub returned no total_count');
    return body.total_count;
  });
};

const githubRepo = async (repo) => request(
  'github_repo',
  `https://api.github.com/repos/${repo}`,
  async (response) => {
    const body = await response.json();
    if (typeof body.stargazers_count !== 'number') throw new Error('GitHub returned no stargazers_count');
    return { value: body.stargazers_count, detail: `last pushed ${String(body.pushed_at).slice(0, 10)}; ${body.forks_count} forks` };
  },
);

const pypiDownloads = async (pkg) => request(
  'pypi',
  `https://pypistats.org/api/packages/${pkg}/recent`,
  async (response) => {
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { throw new Error('pypistats throttled (HTML body)'); }
    if (typeof body?.data?.last_month !== 'number') throw new Error('pypistats returned no last_month');
    return body.data.last_month;
  },
);

const npmDownloads = async (pkg) => request(
  'npm',
  `https://api.npmjs.org/downloads/point/last-month/${pkg}`,
  async (response) => {
    const body = await response.json();
    if (typeof body.downloads !== 'number') throw new Error('npm returned no downloads');
    return body.downloads;
  },
);

// --- run ---------------------------------------------------------------------
if (!githubToken) {
  console.warn('GITHUB_TOKEN not set — GitHub search is limited to 10 requests/minute, so this run will be slow.\n');
}

const selected = registry.filter((s) => (
  (!onlySignal || s.signal_id === onlySignal)
  && (!onlySource || s.source === onlySource)
  && (!onlyScope || s.scope === onlyScope)
));

if (!selected.length) {
  console.error('No registry rows matched the given filters.');
  process.exit(1);
}

console.log(`Frontier signals for ${weekId} (as of ${asOf}): ${selected.length} of ${registry.length} rows\n`);

const results = [];
const failures = [];

for (const spec of selected) {
  const label = `${spec.signal_id.padEnd(26)} ${spec.source.padEnd(12)} ${spec.query.slice(0, 28).padEnd(28)}`;
  try {
    let value;
    let prior = '';
    let yoy = '';
    let detail = '';
    let window = { start: '', end: '' };

    if (spec.source === 'arxiv') {
      const current = windowFor(spec.window_days);
      value = await arxivCount(spec.query, current);
      prior = await arxivCount(spec.query, shiftYear(current));
      // A zero prior year is a real possibility for the thin categories and would
      // otherwise produce Infinity, which would corrupt any later aggregation.
      yoy = prior > 0 ? Number(((value / prior - 1) * 100).toFixed(1)) : '';
      window = { start: ymd(current.start), end: ymd(current.end) };
    } else if (spec.source === 'github') {
      // Level only — see the note at the top of this file on index attrition.
      const current = windowFor(spec.window_days);
      value = await githubCreated(spec.query, current);
      detail = 'level only; year-over-year is not computable from this API';
      window = { start: ymd(current.start), end: ymd(current.end) };
    } else if (spec.source === 'github_repo') {
      const repo = await githubRepo(spec.query);
      value = repo.value;
      detail = repo.detail;
    } else if (spec.source === 'pypi') {
      value = await pypiDownloads(spec.query);
      const w = windowFor(30);
      window = { start: ymd(w.start), end: ymd(w.end) };
    } else {
      value = await npmDownloads(spec.query);
      const w = windowFor(30);
      window = { start: ymd(w.start), end: ymd(w.end) };
    }

    results.push({ spec, value, prior, yoy, detail, window });
    const change = yoy === '' ? '' : `  ${yoy >= 0 ? '+' : ''}${yoy}% yoy`;
    console.log(`  ${label} ${String(value).padStart(12)}${change}${detail ? `  (${detail})` : ''}`);
  } catch (error) {
    failures.push({ spec, error });
    console.log(`  ${label} ${'FAILED'.padStart(12)}  ${error.message}`);
  }
}

if (failures.length) {
  console.warn(`\n${failures.length} of ${selected.length} signals failed and were skipped: ${failures.map((f) => f.spec.signal_id).join(', ')}`);
  console.warn('Re-run to retry only those, or pass --source to isolate one API.');
}

if (!results.length) {
  console.error('\nNo signals were retrieved. Nothing written.');
  process.exit(1);
}

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

// --- theme_signals.csv -------------------------------------------------------
const signalsPath = path.join(root, 'data', 'theme_signals.csv');
const header = [
  'week_id', 'as_of_date', 'signal_id', 'scope', 'subject_id', 'source', 'query',
  'unit', 'value', 'window_start', 'window_end', 'value_prior_year', 'yoy_percent',
  'detail', 'source_url',
];

let existingRows = [];
try {
  existingRows = parseCsv(await readFile(signalsPath, 'utf8')).slice(1);
} catch { /* first run */ }

const existing = new Set(existingRows.map((r) => `${r[0]}|${r[2]}`));
const newRows = results
  .filter((r) => !existing.has(`${weekId}|${r.spec.signal_id}`))
  .map((r) => [
    weekId, asOf, r.spec.signal_id, r.spec.scope, r.spec.subject_id, r.spec.source,
    r.spec.query, r.spec.unit, r.value, r.window.start, r.window.end, r.prior, r.yoy,
    r.detail, r.spec.source_url,
  ]);

if (!newRows.length) {
  console.log(`\nNothing to write — ${weekId} already ingested for every retrieved signal.`);
  process.exit(0);
}

const body = [header, ...existingRows, ...newRows]
  .map((row) => row.map(csvCell).join(',')).join('\n');
await writeFile(signalsPath, `${body}\n`, 'utf8');

console.log(`\nWrote data/theme_signals.csv: +${newRows.length} rows (${existingRows.length + newRows.length} total)`);
if (failures.length) process.exitCode = 1;
