// Digital-assets section tracker — stablecoin rails and agentic settlement.
//
// The section's thesis is that agents will need a settlement layer below the
// economic floor of card rails. That thesis is currently supported by a promotional
// social-media thread and a set of management projections, which is not enough to
// underwrite anything. This script exists so that in three months it is supported by
// a series instead.
//
// It tracks the float, not the narrative. Stablecoin supply is the cleanest fact in
// this whole area: it only grows if somebody actually funds it, so unlike
// announcements, partnerships, TVL and token prices it cannot be talked up. Everything
// collected here is chosen on that test.
//
// Deliberately NOT tracked: token prices as a thesis input, total value locked, and
// counts of announcements. All three move on narrative and none of them is evidence
// that a payment happened.
//
// Source: DefiLlama's public stablecoins API. No key required. The response carries
// prior-week and prior-month circulating figures, so week-over-week change is taken
// from the source rather than reconstructed from our own history — which means a
// missed run leaves a gap in the series but never a wrong change figure.
//
// The monthly series in the section note — non-human traffic share, adjusted transfer
// volume, agent-payment protocol usage — are NOT collected here. They need an
// authored read against a primary source, and inventing a fetch for them would put
// unverified numbers in the same file as measured ones.
//
// Writes: data/agent_traffic.csv, keyed on week plus series. Re-running a week
// replaces that week's rows.
//
// Usage: node scripts/ingest-crypto-rails.mjs [--dry-run]
//
// Options:
//   --week <id>      ISO week id to write (default: current week)
//   --seed-claims    write the unverified 2026-W32 Cloudflare call claims as a
//                    dated baseline, marked unverified. One-time; safe to repeat.
//   --root <path>    project root (default: cwd)

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const seedClaims = argv.includes('--seed-claims');
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

// Chains classified as payment-oriented rather than trading-collateral venues. This
// split is authored, not measured, and it is the softest judgement in this file — a
// dollar sitting on Tron is far more likely to be a payment balance than a dollar
// sitting on Ethereum, but "likely" is doing real work in that sentence. Recorded
// explicitly so the classification can be argued with rather than absorbed.
const PAYMENT_CHAINS = ['Tron', 'Solana', 'Base', 'Polygon'];

const API = 'https://stablecoins.llama.fi/stablecoins?includePrices=true';

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

const HEADER = [
  'week_id', 'as_of_date', 'series_id', 'theme_id', 'label', 'unit', 'value',
  'value_prior_week', 'change_pct', 'source_type', 'source_name', 'source_url',
  'is_primary', 'data_quality', 'note', 'recorded_at',
];

const existing = await (async () => {
  try {
    return parseCsv(await readFile(path.join(root, 'data', 'agent_traffic.csv'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
})();

const rows = [];
const now = new Date().toISOString();

const push = (r) => rows.push({
  week_id: weekId,
  as_of_date: asOf,
  recorded_at: now,
  source_type: 'aggregator',
  source_name: 'DefiLlama',
  source_url: 'https://stablecoins.llama.fi/stablecoins',
  is_primary: 'false',
  data_quality: 'aggregator; on-chain supply is directly observable but the aggregation is a third party\'s',
  ...r,
});

const pct = (now_, then) => (Number.isFinite(now_) && Number.isFinite(then) && then
  ? (((now_ / then) - 1) * 100).toFixed(3)
  : '');

// --- fetch -------------------------------------------------------------------
let payload;
try {
  const response = await fetch(API, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  payload = await response.json();
} catch (error) {
  console.error(`Could not reach the stablecoin API: ${error.message}`);
  console.error('No rows written. The series is left with a gap rather than an estimate.');
  process.exit(1);
}

const assets = payload.peggedAssets ?? [];
const usd = (obj) => Number(obj?.peggedUSD);
const usdAssets = assets.filter((a) => a.pegType === 'peggedUSD');

const sumBy = (list, key) => list.reduce((s, a) => s + (usd(a[key]) || 0), 0);

const total = sumBy(usdAssets, 'circulating');
const totalPrev = sumBy(usdAssets, 'circulatingPrevWeek');
const fiat = usdAssets.filter((a) => a.pegMechanism === 'fiat-backed');
const fiatNow = sumBy(fiat, 'circulating');
const fiatPrev = sumBy(fiat, 'circulatingPrevWeek');

push({
  series_id: 'stablecoin-supply-total',
  theme_id: 'stablecoin-payment-rails',
  label: 'Total USD-pegged stablecoin supply',
  unit: 'usd',
  value: Math.round(total),
  value_prior_week: Math.round(totalPrev),
  change_pct: pct(total, totalPrev),
  note: `${usdAssets.length} USD-pegged assets. The float: it grows only if someone funds it.`,
});

push({
  series_id: 'stablecoin-supply-fiat-backed',
  theme_id: 'stablecoin-payment-rails',
  label: 'Fiat-backed stablecoin supply',
  unit: 'usd',
  value: Math.round(fiatNow),
  value_prior_week: Math.round(fiatPrev),
  change_pct: pct(fiatNow, fiatPrev),
  note: 'The regulated-rail subset. Crypto-backed and algorithmic supply is excluded because it answers a different question.',
});

for (const symbol of ['USDT', 'USDC']) {
  const a = usdAssets.find((x) => x.symbol === symbol);
  if (!a) continue;
  const v = usd(a.circulating);
  const p = usd(a.circulatingPrevWeek);
  push({
    series_id: `stablecoin-supply-${symbol.toLowerCase()}`,
    theme_id: 'stablecoin-payment-rails',
    label: `${a.name} (${symbol}) circulating supply`,
    unit: 'usd',
    value: Math.round(v),
    value_prior_week: Math.round(p),
    change_pct: pct(v, p),
    note: `${((v / total) * 100).toFixed(1)}% of USD-pegged supply.`,
  });
}

const usdc = usdAssets.find((x) => x.symbol === 'USDC');
if (usdc && total) {
  const share = (usd(usdc.circulating) / total) * 100;
  const sharePrev = totalPrev ? (usd(usdc.circulatingPrevWeek) / totalPrev) * 100 : undefined;
  push({
    series_id: 'stablecoin-usdc-share',
    theme_id: 'stablecoin-payment-rails',
    label: 'USDC share of USD-pegged supply',
    unit: 'percent',
    value: share.toFixed(3),
    value_prior_week: sharePrev === undefined ? '' : sharePrev.toFixed(3),
    change_pct: '',
    note: 'Proxy for the regulated-issuer share of the rail. Rising share is the cleanest available sign of institutional rather than offshore adoption.',
  });
}

// Per-chain supply. The classification into payment-oriented chains is authored;
// the figures are not.
const chains = payload.chains ?? [];
let paymentTotal = 0;
let paymentPrior = 0;
for (const name of PAYMENT_CHAINS) {
  const chain = chains.find((c) => c.name === name);
  if (!chain) continue;
  const v = usd(chain.totalCirculatingUSD);
  if (!Number.isFinite(v)) continue;
  // Chain rows carry no prior-week field, so it is summed from the per-asset
  // chainCirculating breakdown rather than left blank.
  const p = usdAssets.reduce(
    (s, a) => s + (Number(a.chainCirculating?.[name]?.circulatingPrevWeek?.peggedUSD) || 0),
    0,
  );
  paymentTotal += v;
  paymentPrior += p;
  push({
    series_id: `stablecoin-supply-chain-${name.toLowerCase()}`,
    theme_id: 'stablecoin-payment-rails',
    label: `Stablecoin supply on ${name}`,
    unit: 'usd',
    value: Math.round(v),
    value_prior_week: Math.round(p),
    change_pct: pct(v, p),
    note: 'Classified as payment-oriented. The classification is a judgement; the figure is not.',
  });
}

if (paymentTotal) {
  push({
    series_id: 'stablecoin-supply-payment-chains',
    theme_id: 'stablecoin-payment-rails',
    label: `Stablecoin supply on payment-oriented chains (${PAYMENT_CHAINS.join(', ')})`,
    unit: 'usd',
    value: Math.round(paymentTotal),
    value_prior_week: Math.round(paymentPrior),
    change_pct: pct(paymentTotal, paymentPrior),
    note: 'Separates payment balances from trading collateral. Authored chain classification — argue with the list, not the arithmetic.',
  });
}

// --- one-time seed of the claims that opened the section ----------------------
// These are recorded so the section has a dated baseline to verify against, NOT
// because they are believed. Every one is a second-hand report of a management
// statement, and two of them are projections. They are written with the same schema
// as the measured rows precisely so that a later primary read supersedes them in
// place rather than living in a separate file nobody opens.
const CLAIM_WEEK = '2026-W32';
const CLAIMS = [
  ['cf-agent-request-growth', 'AI agent requests, year-over-year growth', 'percent', 1700,
    'Attributed to Cloudflare Q2 2026 call. Not verified against the transcript.'],
  ['cf-nonhuman-traffic-share', 'Non-human share of Cloudflare network traffic', 'percent', 50,
    'Attributed to management as "crossed 50% this quarter". Load-bearing for the whole section and unverified. Note also that bot, crawler and agent are three different definitions.'],
  ['cf-requests-per-second', 'Cloudflare requests handled per second', 'requests_per_second', 500_000_000,
    'Quoted in the thread without a source. It is the input to every throughput figure downstream and needs checking against Cloudflare\'s own published averages.'],
  ['cf-monetizable-share-low', 'Share of requests management considers monetizable (low end)', 'percent', 1,
    'Management estimate, range 1-10%. Note the thread\'s own TPS figures are roughly double what this range implies.'],
  ['cf-monetizable-share-high', 'Share of requests management considers monetizable (high end)', 'percent', 10,
    'Management estimate, range 1-10%.'],
];

if (seedClaims) {
  for (const [id, label, unit, value, note] of CLAIMS) {
    rows.push({
      week_id: CLAIM_WEEK,
      as_of_date: '2026-08-07',
      series_id: id,
      theme_id: 'agentic-commerce',
      label,
      unit,
      value,
      value_prior_week: '',
      change_pct: '',
      source_type: 'social_media',
      source_name: 'Lorenzo Valente (@LorenzoARK), reporting Cloudflare Q2 2026 call',
      source_url: '',
      is_primary: 'false',
      data_quality: 'UNVERIFIED. Second-hand report of management statements; two entries are projections. Recorded as a baseline to check against, not as evidence.',
      note,
      recorded_at: now,
    });
  }
}

// --- write -------------------------------------------------------------------
const writtenWeeks = new Set(rows.map((r) => r.week_id));
const writtenKeys = new Set(rows.map((r) => `${r.week_id}|${r.series_id}`));
const kept = existing.filter((r) => !writtenKeys.has(`${r.week_id}|${r.series_id}`));
const out = [...kept, ...rows].sort((a, b) => (
  a.week_id === b.week_id
    ? String(a.series_id).localeCompare(String(b.series_id))
    : String(a.week_id).localeCompare(String(b.week_id))
));

const csv = [
  HEADER.join(','),
  ...out.map((r) => HEADER.map((h) => csvCell(r[h])).join(',')),
].join('\n') + '\n';

const fmt = (n) => `$${(n / 1e9).toFixed(1)}B`;
console.log(`Digital assets — ${weekId}`);
console.log(`  total USD-pegged supply   ${fmt(total)}  (${pct(total, totalPrev)}% w/w)`);
console.log(`  fiat-backed               ${fmt(fiatNow)}  (${pct(fiatNow, fiatPrev)}% w/w)`);
if (usdc) console.log(`  USDC share                ${((usd(usdc.circulating) / total) * 100).toFixed(1)}%`);
if (paymentTotal) console.log(`  on payment-oriented chains ${fmt(paymentTotal)}  (${pct(paymentTotal, paymentPrior)}% w/w)`);
console.log(`  ${rows.length} rows across weeks ${[...writtenWeeks].join(', ')}`);
if (seedClaims) console.log('  seeded 5 UNVERIFIED claim rows for 2026-W32 — verify against the transcript');

if (dryRun) {
  console.log('\n--dry-run: data/agent_traffic.csv not written');
} else {
  await writeFile(path.join(root, 'data', 'agent_traffic.csv'), csv, 'utf8');
  console.log(`\nWrote data/agent_traffic.csv — ${out.length} rows`);
}
