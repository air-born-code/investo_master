// Stage 1c — price and market-capitalisation ingestion.
//
// Exists because a growth rate is not a return. data/growth_estimates.csv holds
// twenty long-run growth hypotheses and they are unreadable as investment
// information without a price beside them. weekly_metrics.csv had gone three weeks
// stale, so every valuation reference in the issue was stale with it.
//
// Two sources, deliberately different in kind:
//
//   price   Yahoo's chart endpoint. Keyless, but third-party and unaudited, so rows
//           are marked accordingly. This is a market observation, not a company
//           statement — nobody audits a last-traded price and none is claimed.
//   shares  SEC XBRL company facts (dei:EntityCommonStockSharesOutstanding). Primary
//           and issuer-reported. Market cap is derived here rather than taken from a
//           third-party field, so the number has a traceable derivation: a filed
//           share count times an observed price.
//
// That split is the point. Where a primary source exists it is used, and where one
// does not the row says so instead of borrowing someone else's confidence.
//
// Append-only and idempotent: re-running for a week that already has a row for an
// asset changes nothing, so this is safe to run on a schedule.
//
// Usage:
//   node scripts/ingest-prices.mjs [--dry-run]
//
// Options:
//   --only gev,vrt      restrict to specific asset ids
//   --tier candidate    restrict to a tier (default: all tiers)
//   --root <path>       project root (default: cwd)
//
// SEC_USER_AGENT must carry a real contact address or EDGAR returns 403.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const root = path.resolve(flag('root') ?? process.cwd());
const only = flag('only')?.split(',').map((s) => s.trim()).filter(Boolean);
const tierFilter = flag('tier');

const userAgent = process.env.SEC_USER_AGENT;
if (!userAgent) {
  console.warn('SEC_USER_AGENT is not set. EDGAR will refuse the share-count lookup, so');
  console.warn('rows will carry a price but no market capitalisation.\n');
}

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
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// --- assets ------------------------------------------------------------------
const assetRows = parseCsv(await readFile(path.join(root, 'data', 'assets.csv'), 'utf8'));
const [assetHeader, ...assetBody] = assetRows;
const col = Object.fromEntries(assetHeader.map((k, i) => [k, i]));

let assets = assetBody.map((r) => ({
  asset_id: r[col.asset_id],
  symbol: r[col.symbol],
  name: r[col.name],
  tier: r[col.tier] || 'candidate',
}));
if (only) assets = assets.filter((a) => only.includes(a.asset_id));
if (tierFilter) assets = assets.filter((a) => a.tier === tierFilter);

if (!assets.length) {
  console.error('No assets selected.');
  process.exit(1);
}

// --- price -------------------------------------------------------------------
// The chart endpoint is used rather than the quote endpoint because quote and
// quoteSummary now require a session crumb and return 401 without one. chart needs
// no credential and carries the fields actually wanted here.
const fetchPrice = async (symbol) => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Investo Master research)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`price ${response.status}`);
  const meta = (await response.json())?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error('no price in response');
  return {
    price: meta.regularMarketPrice,
    currency: meta.currency,
    observedAt: new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10),
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
  };
};

// --- shares outstanding ------------------------------------------------------
let tickerMap;
const loadTickerMap = async () => {
  if (tickerMap) return tickerMap;
  const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'user-agent': userAgent, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`EDGAR ticker map ${response.status}`);
  const body = await response.json();
  tickerMap = new Map(
    Object.values(body).map((e) => [e.ticker.toUpperCase(), String(e.cik_str).padStart(10, '0')]),
  );
  return tickerMap;
};

// dei:EntityCommonStockSharesOutstanding is the cover-page share count every filer
// reports. Taking the observation with the latest `end` date means the count comes
// from the most recent filing rather than the most recent fiscal period, which is
// the fresher of the two and the one a market cap should use.
const fetchShares = async (symbol) => {
  const map = await loadTickerMap();
  const cik = map.get(symbol.toUpperCase());
  if (!cik) return undefined;
  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/dei/EntityCommonStockSharesOutstanding.json`;
  const response = await fetch(url, {
    headers: { 'user-agent': userAgent, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return undefined;
  const units = (await response.json())?.units?.shares ?? [];
  const latest = units
    .filter((u) => u.val > 0 && u.end)
    .sort((a, b) => a.end.localeCompare(b.end))
    .at(-1);
  if (!latest) return undefined;
  return { shares: latest.val, reportedFor: latest.end, form: latest.form, filed: latest.filed };
};

// --- run ---------------------------------------------------------------------
console.log(`Fetching ${assets.length} asset(s) for ${weekId} (as of ${asOf})\n`);

const results = [];
for (const asset of assets) {
  const row = { ...asset };
  try {
    Object.assign(row, await fetchPrice(asset.symbol));
  } catch (error) {
    row.error = `price: ${error.message}`;
  }
  if (userAgent && row.price) {
    try {
      const shares = await fetchShares(asset.symbol);
      if (shares) {
        Object.assign(row, shares);
        row.marketCap = Math.round(row.price * shares.shares);
      }
    } catch { /* market cap is optional; the price row still stands */ }
  }
  results.push(row);

  const cap = row.marketCap
    ? `$${(row.marketCap / 1e9).toFixed(1)}B`
    : (row.price ? 'no share count' : '');
  console.log(
    `  ${asset.symbol.padEnd(5)} ${(row.price ? row.price.toFixed(2) : '—').padStart(9)}` +
    ` ${(row.currency ?? '').padEnd(4)} ${cap.padStart(16)}` +
    `${row.error ? `  ${row.error}` : ''}`,
  );
  await sleep(150);
}

const priced = results.filter((r) => r.price);
const capped = results.filter((r) => r.marketCap);
console.log(`\n${priced.length}/${results.length} priced, ${capped.length} with a derived market cap.`);

const failures = results.filter((r) => r.error);
if (failures.length) {
  console.log(`${failures.length} failed: ${failures.map((f) => f.symbol).join(', ')}`);
}

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}
if (!priced.length) {
  console.error('\nNothing priced. Not writing.');
  process.exit(1);
}

// --- write -------------------------------------------------------------------
const metricsPath = path.join(root, 'data', 'weekly_metrics.csv');
const metricsRows = parseCsv(await readFile(metricsPath, 'utf8'));
const [metricsHeader, ...metricsBody] = metricsRows;
const mi = Object.fromEntries(metricsHeader.map((k, i) => [k, i]));

const existing = new Set(metricsBody.map((r) => `${r[mi.week_id]}|${r[mi.asset_id]}`));

// Fundamentals are left empty rather than guessed. A blank cell is a known gap; a
// filled one implies the figure was sourced, and none of these were.
const newMetrics = priced
  .filter((r) => !existing.has(`${weekId}|${r.asset_id}`))
  .map((r) => {
    const row = new Array(metricsHeader.length).fill('');
    row[mi.week_id] = weekId;
    row[mi.as_of_date] = asOf;
    row[mi.asset_id] = r.asset_id;
    row[mi.price] = r.price;
    row[mi.currency] = r.currency ?? 'USD';
    if (r.marketCap) {
      row[mi.market_cap] = r.marketCap;
      row[mi.valuation_metric] = 'market_cap_usd';
      row[mi.valuation_value] = r.marketCap;
    }
    row[mi.data_quality] = r.marketCap
      ? `price is a third-party market observation (${r.observedAt}); market cap derived from it and the ${r.form} share count reported for ${r.reportedFor} (SEC XBRL dei:EntityCommonStockSharesOutstanding); fundamentals not collected`
      : `price is a third-party market observation (${r.observedAt}); no share count available so no market cap; fundamentals not collected`;
    return row;
  });

if (!newMetrics.length) {
  console.log(`\nNothing to write — ${weekId} already has rows for every priced asset.`);
  process.exit(0);
}

await writeFile(
  metricsPath,
  `${[metricsHeader, ...metricsBody, ...newMetrics].map((r) => r.map(csvCell).join(',')).join('\n')}\n`,
  'utf8',
);

// One provenance row for the batch rather than one per asset. Twenty near-identical
// rows would bulk out the claim registry without adding a claim.
const sourcesPath = path.join(root, 'data', 'sources.csv');
const sourcesText = await readFile(sourcesPath, 'utf8');
const sourceId = `src-${weekId.toLowerCase()}-prices`;
if (!sourcesText.includes(sourceId)) {
  const observed = [...new Set(priced.map((r) => r.observedAt))].sort();
  const claim = `Prices for ${priced.length} tracked assets observed ${observed.join(' and ')}` +
    `; market capitalisation derived for ${capped.length} of them from SEC-reported shares outstanding.`;
  const row = [
    sourceId, asOf, '', '', 'market_data', `Weekly price and market-cap snapshot, ${weekId}`,
    'Yahoo Finance chart endpoint; SEC XBRL company facts', asOf, asOf,
    'https://data.sec.gov/api/xbrl/', 'false', 'context', claim, 'medium',
  ];
  const trimmed = sourcesText.endsWith('\n') ? sourcesText : `${sourcesText}\n`;
  await writeFile(sourcesPath, `${trimmed}${row.map(csvCell).join(',')}\n`, 'utf8');
}

console.log(`\nWrote data/weekly_metrics.csv: +${newMetrics.length} rows`);
console.log('Wrote data/sources.csv: +1 provenance row');
