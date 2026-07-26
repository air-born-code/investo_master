// Stage 1b — SEC filing detection from EDGAR.
//
// Appends a provenance row to data/sources.csv for each new filing by a tracked
// asset. Append-only and idempotent: rows are keyed by accession number, so a
// re-run adds nothing.
//
// Scope, deliberately: this records that a filing EXISTS and links to it. It does
// not read the document or extract figures — the claim text says only what can be
// known from the filing index. Extracting XBRL fundamentals is separate work.
//
// EDGAR requires a declared User-Agent with real contact information and asks for
// no more than 10 requests/second. Set SEC_USER_AGENT to identify yourself.
//
// Usage: node --env-file-if-exists=.env.local scripts/ingest-filings.mjs [--dry-run]
//
// Options:
//   --since YYYY-MM-DD   earliest filing date to consider (default: 90 days ago)
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

const userAgent = process.env.SEC_USER_AGENT
  ?? 'Investo Master research script (set SEC_USER_AGENT to your contact address)';
if (!process.env.SEC_USER_AGENT) {
  console.warn('SEC_USER_AGENT is not set. EDGAR asks that you identify yourself with a');
  console.warn('contact address; set SEC_USER_AGENT="Your Name your@email" to comply.\n');
}

// Forms that can move a thesis. Everything else is noise for this purpose.
const FORMS = new Set([
  '10-K', '10-Q', '8-K', '20-F', '6-K', 'S-1', 'S-4', 'DEF 14A', '425',
]);

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
const since = flag('since')
  ?? new Date(today.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);

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

// --- EDGAR -------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getJson = async (url) => {
  const response = await fetch(url, {
    headers: { 'user-agent': userAgent, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`EDGAR ${response.status} for ${url}`);
  return response.json();
};

const assetsRows = parseCsv(await readFile(path.join(root, 'data', 'assets.csv'), 'utf8'));
const [assetHeader, ...assetBody] = assetsRows;
const assets = assetBody.map((cells) => Object.fromEntries(assetHeader.map((k, i) => [k, cells[i] ?? ''])));
const equities = assets.filter((a) => a.asset_type === 'equity' && a.symbol);

// Ticker to CIK is resolved from EDGAR each run rather than stored, so a ticker
// change or re-listing cannot leave a stale mapping in the repository.
const tickerMap = await getJson('https://www.sec.gov/files/company_tickers.json');
const cikByTicker = new Map(
  Object.values(tickerMap).map((entry) => [entry.ticker, String(entry.cik_str).padStart(10, '0')]),
);

const found = [];
const unresolved = [];

for (const asset of equities) {
  const cik = cikByTicker.get(asset.symbol);
  if (!cik) { unresolved.push(asset.symbol); continue; }

  await sleep(150); // stay well inside EDGAR's 10 requests/second guidance
  const submissions = await getJson(`https://data.sec.gov/submissions/CIK${cik}.json`);
  const recent = submissions.filings?.recent;
  if (!recent) continue;

  for (let i = 0; i < recent.accessionNumber.length; i += 1) {
    const form = recent.form[i];
    const filingDate = recent.filingDate[i];
    if (filingDate < since || !FORMS.has(form)) continue;

    const accession = recent.accessionNumber[i];
    const bare = accession.replaceAll('-', '');
    found.push({
      assetId: asset.asset_id,
      symbol: asset.symbol,
      name: asset.name,
      form,
      filingDate,
      reportDate: recent.reportDate?.[i] ?? '',
      accession,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${bare}/${recent.primaryDocument[i]}`,
    });
  }
}

found.sort((a, b) => (a.filingDate < b.filingDate ? 1 : -1));

if (unresolved.length) {
  console.warn(`No EDGAR CIK for: ${unresolved.join(', ')} — skipped.\n`);
}

console.log(`Filings since ${since} for ${equities.length} tracked equities:`);
if (!found.length) console.log('  none');
for (const f of found) {
  console.log(`  ${f.symbol.padEnd(5)} ${f.form.padEnd(8)} filed ${f.filingDate}${f.reportDate ? `  period ${f.reportDate}` : ''}`);
}

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

// --- write -------------------------------------------------------------------
const sourcesPath = path.join(root, 'data', 'sources.csv');
const sourcesText = await readFile(sourcesPath, 'utf8');
const sourceRows = parseCsv(sourcesText).slice(1);
const existing = new Set(sourceRows.map((r) => r[0]));
// Also dedupe on the document URL. Filings recorded by hand before ingestion
// existed carry their own source_id, so an ID check alone would file the same
// document twice under two identities.
const existingUrls = new Set(sourceRows.map((r) => r[9]).filter(Boolean));

// Keyed by accession number: the same filing keeps one identity no matter which
// week it is picked up in, so a widened --since window cannot duplicate rows.
const rows = found
  .map((f) => ({ f, id: `src-edgar-${f.accession.replaceAll('-', '')}` }))
  .filter(({ f, id }) => !existing.has(id) && !existingUrls.has(f.url))
  .map(({ f, id }) => [
    id, asOf, f.assetId, '', 'filing',
    `${f.symbol} ${f.form} filed ${f.filingDate}`,
    'SEC EDGAR', f.filingDate, asOf, f.url, 'true', 'context',
    `${f.name} filed a ${f.form} with the SEC on ${f.filingDate}${f.reportDate ? `, covering the period ending ${f.reportDate}` : ''}. Contents not yet reviewed.`,
    'high',
  ]);

if (!rows.length) {
  console.log(`\nNothing to write — all ${found.length} filings already recorded.`);
  process.exit(0);
}

const trimmed = sourcesText.endsWith('\n') ? sourcesText : `${sourcesText}\n`;
const appended = rows.map((row) => row.map(csvCell).join(',')).join('\n');
await writeFile(sourcesPath, `${trimmed}${appended}\n`, 'utf8');

const skipped = found.length - rows.length;
console.log(`\nWrote data/sources.csv: +${rows.length} filing rows (week ${weekId})`);
if (skipped) console.log(`${skipped} already recorded — skipped.`);
console.log('Claims record that each filing exists. Reading them is a research step.');
