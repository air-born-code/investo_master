// Stage 1e — theme-to-company discovery from EDGAR full-text search.
//
// Answers one question: which companies are filing 8-Ks that use the language of
// a tracked theme? Presidential documents name policy and almost never name
// companies, so a policy feed on its own cannot tell you who is exposed to it.
// This is the bridge — from a theme's vocabulary to the tickers using it.
//
// Writes one thing: data/theme_mentions.csv, append-only and keyed on the filing
// accession plus the theme it matched. Re-running a week changes nothing.
//
// It deliberately does NOT write to data/sources.csv, for two reasons. Most hits
// are companies outside the universe, and putting unexamined names next to SEC
// filings and central bank releases is exactly the mixing that the frontier tier
// in ingest-signals.mjs exists to prevent. And for companies already tracked, the
// filing itself is recorded by ingest-filings.mjs, so a second row would file the
// same document under two identities.
//
// It also does not add anything to the universe. Which companies to follow stays
// a judgement call, as in add-assets.mjs; this prints the command and stops.
//
// EDGAR full-text search covers 2001 onward and needs the same declared
// User-Agent as the rest of EDGAR. Set SEC_USER_AGENT to identify yourself.
//
// Usage: node --env-file-if-exists=.env.local scripts/ingest-theme-mentions.mjs [--dry-run]
//
// Options:
//   --since YYYY-MM-DD   earliest filing date to consider (default: 30 days ago)
//   --forms <list>       comma-separated forms to search (default: 8-K)
//   --theme <id>         restrict to one theme
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
const onlyTheme = flag('theme');
const forms = (flag('forms') ?? '8-K').split(',').map((f) => f.trim()).filter(Boolean);

const userAgent = process.env.SEC_USER_AGENT
  ?? 'Investo Master research script (set SEC_USER_AGENT to your contact address)';
if (!process.env.SEC_USER_AGENT) {
  console.warn('SEC_USER_AGENT is not set. EDGAR asks that you identify yourself with a');
  console.warn('contact address; set SEC_USER_AGENT="Your Name your@email" to comply.\n');
}

// Search phrases per theme. These are the diagnostic terms only — a phrase earns
// its place here if a company using it is probably talking about this theme, not
// merely adjacent to it. "Semiconductor" would return several hundred filings a
// month and identify nothing; "advanced packaging" returns few and identifies a
// great deal. Deliberately narrower than the keyword map in ingest-policy.mjs,
// which scores documents already known to be policy.
const THEME_QUERIES = {
  'critical-minerals-security': [
    'rare earth magnets', 'permanent magnet', 'neodymium', 'samarium cobalt',
    'critical minerals', 'rare earth separation', 'magnet production',
  ],
  'advanced-nuclear-enablers': [
    'small modular reactor', 'advanced reactor', 'uranium enrichment',
    'nuclear fuel cycle', 'HALEU',
  ],
  'age-of-electricity': [
    'grid interconnection', 'transmission capacity', 'load growth',
    'power purchase agreement', 'baseload power',
  ],
  'ai-physical-infrastructure': [
    'data center capacity', 'liquid cooling', 'switchgear', 'grid-scale power',
  ],
  'high-speed-connectivity': [
    'advanced packaging', 'optical transceiver', 'silicon photonics',
    'co-packaged optics', 'high-speed interconnect',
  ],
  'vertically-integrated-space': [
    'launch vehicle', 'satellite constellation', 'in-space servicing', 'lunar lander',
    'spectrum rights',
  ],
};

// Phrases removed after testing, recorded so they are not reintroduced:
// "AI infrastructure" and "power density" matched every crypto miner announcing a
// pivot, and bare "in-space" matched ordinary prose. A phrase belongs above only
// if a company using it is probably in the business, not merely describing a
// market it hopes to enter.

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
  ?? new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);

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

const readTable = async (file) => {
  const rows = parseCsv(await readFile(path.join(root, 'data', file), 'utf8'));
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((k, i) => [k, cells[i] ?? ''])));
};

// --- EDGAR full-text search --------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// display_names arrive as "Legal Name  (TICK, TICKB)  (CIK 0001234567)". Some
// filers have no ticker at all (private debt issuers, trusts), and several
// tickers can share one CIK across share classes; the first is the common line.
const parseDisplayName = (display) => {
  const cik = display.match(/\(CIK\s+(\d+)\)/)?.[1] ?? '';
  const tickerGroups = [...display.matchAll(/\(([A-Z0-9.\-]+(?:,\s*[A-Z0-9.\-]+)*)\)/g)]
    .map((m) => m[1])
    .filter((g) => !/^CIK/.test(g));
  const tickers = tickerGroups.length
    ? tickerGroups[tickerGroups.length - 1].split(/,\s*/)
    : [];
  const name = display.split(/\s{2,}\(/)[0].trim();
  return { name, cik, tickers };
};

const searchFullText = async (phrase) => {
  const url = new URL('https://efts.sec.gov/LATEST/search-index');
  url.searchParams.set('q', `"${phrase}"`);
  url.searchParams.set('forms', forms.join(','));
  url.searchParams.set('startdt', since);
  url.searchParams.set('enddt', asOf);
  const response = await fetch(url, {
    headers: { 'user-agent': userAgent, accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`EDGAR FTS ${response.status} for "${phrase}"`);
  const data = await response.json();
  const hits = data.hits?.hits ?? [];
  // The endpoint returns every hit at the volumes these phrases produce, but it
  // reports a total independently. If the two ever diverge the result set is
  // being truncated and the discovery feed is quietly incomplete, so say so
  // rather than presenting a partial list as the whole picture.
  const total = data.hits?.total?.value ?? hits.length;
  if (total > hits.length) {
    console.warn(`  note: "${phrase}" reports ${total} hits but returned ${hits.length} — results truncated, narrow --since.`);
  }
  return hits;
};

// --- gather ------------------------------------------------------------------
const themes = await readTable('themes.csv');
const knownThemes = new Set(themes.map((t) => t.theme_id));
const assets = await readTable('assets.csv');
const assetByTicker = new Map(
  assets.filter((a) => a.symbol).map((a) => [a.symbol.toUpperCase(), a]),
);

const selectedThemes = Object.entries(THEME_QUERIES)
  .filter(([themeId]) => knownThemes.has(themeId))
  .filter(([themeId]) => !onlyTheme || themeId === onlyTheme);

if (!selectedThemes.length) {
  console.error(onlyTheme
    ? `No query set for theme "${onlyTheme}".`
    : 'No themes in THEME_QUERIES match themes.csv.');
  process.exit(1);
}

// Keyed by accession + theme, so one filing that hits three phrases of the same
// theme is one mention carrying three matched terms, not three mentions.
const mentions = new Map();
const failures = [];

console.log(`EDGAR full-text search over ${forms.join(', ')} filed since ${since}\n`);

for (const [themeId, phrases] of selectedThemes) {
  let themeHits = 0;
  for (const phrase of phrases) {
    await sleep(200); // stay well inside EDGAR's 10 requests/second guidance
    let hits;
    try {
      hits = await searchFullText(phrase);
    } catch (error) {
      failures.push({ themeId, phrase, message: error.message });
      continue;
    }
    themeHits += hits.length;
    for (const hit of hits) {
      const source = hit._source ?? {};
      const display = (source.display_names ?? [])[0];
      if (!display) continue;
      const { name, cik, tickers } = parseDisplayName(display);
      const accession = source.adsh ?? '';
      if (!accession) continue;

      const key = `${accession}|${themeId}`;
      const existing = mentions.get(key);
      if (existing) {
        existing.matched.add(phrase);
        continue;
      }
      const ticker = tickers[0] ?? '';
      const asset = assetByTicker.get(ticker.toUpperCase());
      mentions.set(key, {
        themeId,
        accession,
        cik,
        name,
        ticker,
        form: source.form ?? '',
        fileDate: source.file_date ?? '',
        assetId: asset?.asset_id ?? '',
        inUniverse: Boolean(asset),
        matched: new Set([phrase]),
      });
    }
  }
  console.log(`  ${themeId.padEnd(28)} ${String(themeHits).padStart(4)} raw hits across ${phrases.length} phrases`);
}

if (failures.length) {
  console.warn(`\n${failures.length} searches failed and were skipped:`);
  for (const f of failures) console.warn(`  ${f.themeId} "${f.phrase}": ${f.message}`);
}

const all = [...mentions.values()].sort((a, b) => (a.fileDate < b.fileDate ? 1 : -1));
const tracked = all.filter((m) => m.inUniverse);
const untracked = all.filter((m) => !m.inUniverse && m.ticker);

console.log(`\n${all.length} distinct filing/theme mentions: ${tracked.length} in the universe, ${untracked.length} outside it.`);

if (tracked.length) {
  console.log('\nTracked names using theme language:');
  for (const m of tracked) {
    console.log(`  ${m.ticker.padEnd(6)} ${m.fileDate}  ${m.themeId}`);
    console.log(`      ${[...m.matched].join(', ')}`);
  }
}

// Untracked names are ranked on their single strongest theme, not on the total
// across all of them. Scoring breadth rewards exactly the wrong company: shells
// and reverse-merger candidates whose press releases touch minerals, nuclear and
// space in one filing outscore a focused supplier. Depth in one theme is the
// signal; spread across several is the tell, so it is penalised rather than
// rewarded, and anything spanning three or more themes is dropped outright.
const byTicker = new Map();
for (const m of untracked) {
  const entry = byTicker.get(m.ticker) ?? {
    ticker: m.ticker, name: m.name, perTheme: new Map(),
  };
  const t = entry.perTheme.get(m.themeId) ?? { filings: new Set(), matched: new Set() };
  t.filings.add(m.accession);
  for (const p of m.matched) t.matched.add(p);
  entry.perTheme.set(m.themeId, t);
  byTicker.set(m.ticker, entry);
}

const SPREAD_LIMIT = 3;
const ranked = [...byTicker.values()]
  .map((e) => {
    const best = [...e.perTheme.entries()]
      .map(([themeId, t]) => ({ themeId, ...t, raw: t.matched.size * 2 + t.filings.size }))
      .sort((a, b) => b.raw - a.raw)[0];
    return {
      ticker: e.ticker,
      name: e.name,
      themeId: best.themeId,
      filings: best.filings,
      matched: best.matched,
      themeCount: e.perTheme.size,
      score: best.raw - (e.perTheme.size - 1) * 2,
    };
  })
  .filter((e) => e.themeCount < SPREAD_LIMIT)
  .sort((a, b) => b.score - a.score);

const dropped = byTicker.size - ranked.length;

if (ranked.length) {
  console.log('\nOutside the universe, ranked on their strongest single theme:');
  for (const e of ranked.slice(0, 20)) {
    console.log(`  ${e.ticker.padEnd(6)} score ${String(e.score).padStart(2)}  ${e.themeId.padEnd(28)} ${e.name.slice(0, 34)}`);
    console.log(`      ${e.filings.size} filing(s), matched: ${[...e.matched].join(', ')}`);
  }
  if (ranked.length > 20) console.log(`  ... and ${ranked.length - 20} more with weaker evidence`);
  if (dropped) {
    console.log(`\n${dropped} name(s) dropped for spanning ${SPREAD_LIMIT}+ themes — usually buzzword breadth, not a business.`);
  }

  // Grouped by theme because add-assets.mjs takes one theme per invocation.
  const strong = ranked.filter((e) => e.score >= 6);
  if (strong.length) {
    console.log('\nWorth a look. Which to follow stays your decision:');
    const byTheme = new Map();
    for (const e of strong.slice(0, 15)) {
      byTheme.set(e.themeId, [...(byTheme.get(e.themeId) ?? []), e.ticker]);
    }
    for (const [themeId, tickers] of byTheme) {
      console.log(`  node scripts/add-assets.mjs --theme ${themeId} ${tickers.join(' ')}`);
    }
  }
}

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

// --- write -------------------------------------------------------------------
const mentionsPath = path.join(root, 'data', 'theme_mentions.csv');
const HEADER = [
  'week_id', 'as_of_date', 'theme_id', 'accession', 'cik', 'company', 'symbol',
  'in_universe', 'asset_id', 'form', 'filed_at', 'matched_terms', 'source_url',
];

let existingRows = [];
try {
  existingRows = parseCsv(await readFile(mentionsPath, 'utf8')).slice(1);
} catch {
  existingRows = [];
}
const existing = new Set(existingRows.map((r) => `${r[3]}|${r[2]}`));

const newRows = all
  .filter((m) => !existing.has(`${m.accession}|${m.themeId}`))
  .map((m) => [
    weekId, asOf, m.themeId, m.accession, m.cik, m.name, m.ticker,
    m.inUniverse ? 'true' : 'false', m.assetId, m.form, m.fileDate,
    [...m.matched].join('; '),
    `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${m.cik}&type=${encodeURIComponent(m.form)}`,
  ]);

if (!newRows.length) {
  console.log(`\nNothing to write — all ${all.length} mentions already recorded.`);
  process.exit(0);
}

const body = [
  HEADER.join(','),
  ...existingRows.map((r) => r.map(csvCell).join(',')),
  ...newRows.map((r) => r.map(csvCell).join(',')),
].join('\n');
await writeFile(mentionsPath, `${body}\n`, 'utf8');

console.log(`\nWrote data/theme_mentions.csv: +${newRows.length} rows (${existingRows.length + newRows.length} total, week ${weekId})`);
console.log('Discovery only. Nothing here is evidence until a name is followed and read.');
