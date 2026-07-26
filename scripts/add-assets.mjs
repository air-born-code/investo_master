// Adds companies to the tracked universe, enriched from EDGAR.
//
// Which companies to follow is a judgement call and stays yours: you supply the
// tickers and the theme they express. This does the mechanical half — resolving
// each ticker to its CIK, legal name, exchange, and SIC industry from EDGAR, then
// writing rows to assets.csv and asset_themes.csv.
//
// New companies enter at tier "universe", meaning coverage rather than interest.
// Gates do not apply until something is promoted to candidate.
//
// Usage:
//   node scripts/add-assets.mjs --theme age-of-electricity NEE DUK SO
//   node scripts/add-assets.mjs --theme ai-physical-infrastructure --role enabler ANET
//   node scripts/add-assets.mjs --theme <id> --file tickers.txt
//   node scripts/add-assets.mjs --theme <id> --dry-run AAPL
//
// Options:
//   --role        platform | enabler | beneficiary | supplier (default: beneficiary)
//   --relevance   high | medium | low (default: medium)
//   --tier        universe | watchlist | candidate (default: universe)
//   --note        free text stored against the theme link

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const root = path.resolve(flag('root') ?? process.cwd());

const themeId = flag('theme');
const role = flag('role') ?? 'beneficiary';
const relevance = flag('relevance') ?? 'medium';
const tier = flag('tier') ?? 'universe';
const note = flag('note') ?? '';

const FLAGS_WITH_VALUES = new Set(['theme', 'role', 'relevance', 'tier', 'note', 'root', 'file']);
const tickersFromArgs = argv.filter((arg, i) => {
  if (arg.startsWith('--')) return false;
  const prev = argv[i - 1];
  return !(prev?.startsWith('--') && FLAGS_WITH_VALUES.has(prev.slice(2)));
});

const userAgent = process.env.SEC_USER_AGENT
  ?? 'Investo Master research script (set SEC_USER_AGENT to your contact address)';

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getJson = async (url) => {
  const response = await fetch(url, {
    headers: { 'user-agent': userAgent, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`EDGAR ${response.status} for ${url}`);
  return response.json();
};

// --- validate -----------------------------------------------------------------
const themeRows = parseCsv(await readFile(path.join(root, 'data', 'themes.csv'), 'utf8'));
const knownThemes = new Set(themeRows.slice(1).map((r) => r[0]));

if (!themeId || !tickersFromArgs.length) {
  console.error('Usage: node scripts/add-assets.mjs --theme <theme_id> TICKER [TICKER ...]');
  console.error(`\nKnown themes:\n  ${[...knownThemes].join('\n  ')}`);
  process.exit(1);
}
// A typo here would silently create an orphan link, so fail loudly instead.
if (!knownThemes.has(themeId)) {
  console.error(`Unknown theme "${themeId}". Known themes:\n  ${[...knownThemes].join('\n  ')}`);
  console.error('\nAdd the theme to data/themes.csv first if it is genuinely new.');
  process.exit(1);
}

const assetsPath = path.join(root, 'data', 'assets.csv');
const assetRows = parseCsv(await readFile(assetsPath, 'utf8'));
const [assetHeader, ...assetBody] = assetRows;
const existingSymbols = new Set(assetBody.map((r) => r[assetHeader.indexOf('symbol')]));

const linksPath = path.join(root, 'data', 'asset_themes.csv');
const linkRows = parseCsv(await readFile(linksPath, 'utf8'));
const [linkHeader, ...linkBody] = linkRows;
const existingLinks = new Set(linkBody.map((r) => `${r[0]}|${r[1]}`));

// --- resolve ------------------------------------------------------------------
const tickerMap = await getJson('https://www.sec.gov/files/company_tickers.json');
const cikByTicker = new Map(
  Object.values(tickerMap).map((e) => [e.ticker.toUpperCase(), String(e.cik_str).padStart(10, '0')]),
);

const today = new Date().toISOString().slice(0, 10);
const resolved = [];
const problems = [];

for (const raw of tickersFromArgs) {
  const symbol = raw.toUpperCase();
  const cik = cikByTicker.get(symbol);
  if (!cik) { problems.push(`${symbol}: no EDGAR record — check the ticker`); continue; }

  await sleep(150);
  const sub = await getJson(`https://data.sec.gov/submissions/CIK${cik}.json`);
  resolved.push({
    assetId: symbol.toLowerCase(),
    symbol,
    name: sub.name ?? symbol,
    exchange: sub.exchanges?.[0] ?? '',
    country: sub.addresses?.business?.stateOrCountryDescription ?? '',
    industry: sub.sicDescription ?? '',
    sic: sub.sic ?? '',
    alreadyTracked: existingSymbols.has(symbol),
  });
}

console.log(`Resolved ${resolved.length} of ${tickersFromArgs.length} tickers:\n`);
for (const r of resolved) {
  console.log(`  ${r.symbol.padEnd(6)} ${r.name.slice(0, 34).padEnd(36)} ${r.industry.slice(0, 30)}`);
  if (r.alreadyTracked) console.log(`  ${''.padEnd(6)} already in assets.csv — will link theme only`);
}
for (const p of problems) console.log(`  ${p}`);

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

// --- write --------------------------------------------------------------------
const col = (name) => assetHeader.indexOf(name);
const newAssets = resolved.filter((r) => !r.alreadyTracked).map((r) => {
  const row = new Array(assetHeader.length).fill('');
  row[col('asset_id')] = r.assetId;
  row[col('symbol')] = r.symbol;
  row[col('name')] = r.name;
  row[col('asset_type')] = 'equity';
  row[col('exchange')] = r.exchange;
  row[col('country')] = r.country;
  row[col('industry')] = r.industry;
  row[col('currency')] = 'USD';
  row[col('stage')] = 'discovered';
  row[col('added_date')] = today;
  row[col('tier')] = tier;
  return row;
});

const newLinks = resolved
  .filter((r) => !existingLinks.has(`${r.assetId}|${themeId}`))
  .map((r) => [r.assetId, themeId, role, relevance, note, today]);

if (!newAssets.length && !newLinks.length) {
  console.log('\nNothing to write — every ticker is already tracked and linked.');
  process.exit(0);
}

if (newAssets.length) {
  const body = [assetHeader, ...assetBody, ...newAssets]
    .map((row) => row.map(csvCell).join(',')).join('\n');
  await writeFile(assetsPath, `${body}\n`, 'utf8');
}

if (newLinks.length) {
  const body = [linkHeader, ...linkBody, ...newLinks]
    .map((row) => row.map(csvCell).join(',')).join('\n');
  await writeFile(linksPath, `${body}\n`, 'utf8');
}

console.log(`\nWrote data/assets.csv: +${newAssets.length} companies at tier "${tier}"`);
console.log(`Wrote data/asset_themes.csv: +${newLinks.length} theme links to "${themeId}"`);
if (problems.length) console.log(`${problems.length} ticker(s) could not be resolved — see above.`);
