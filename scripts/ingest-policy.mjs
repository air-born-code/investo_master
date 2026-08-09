// Stage 1c — policy action detection from presidential documents and federal awards.
//
// Appends provenance rows to data/sources.csv for two kinds of government action:
//
//   1. Presidential documents (executive orders, memoranda, proclamations,
//      determinations, notices) published in the Federal Register that match a
//      tracked theme. These carry a theme_id and no asset_id: they are
//      industry-level evidence, in the same class as the IEA and EIA rows.
//
//   2. Federal contract and grant awards to tracked equities above a materiality
//      threshold. These carry an asset_id and no theme_id, like filing rows;
//      attribute them to themes through asset_themes.csv.
//
// It also writes data/frontier_policy.csv, which is a separate store for candidate
// themes and fringe entries and never touches sources.csv. That pass reads proposed
// and final agency rules as well as presidential documents, because the frontier
// tier is watching for the moment a field first becomes legible to a regulator, and
// that happens in rulemaking years before it reaches a presidential document.
//
// Scope, deliberately: this records that a policy action EXISTS, what it is
// called, and which theme its language touches. It does not interpret the action
// or claim a market consequence. Executive orders name policy, not companies —
// reading one and deciding whether it matters is a research step, not ingestion.
//
// "Big themes only": a presidential document is kept only when its text matches a
// tracked theme with enough weight to clear MIN_SCORE. Most presidential documents
// are national-emergency continuations and commemorative proclamations, so the
// unfiltered feed is roughly 90% noise for this project.
//
// Sources and their quirks, all verified:
//   - Federal Register JSON API: free, no key. Its full-text file URLs sit behind
//     a bot wall that returns HTTP 200 with an HTML "Request Access" page, so full
//     text comes from govinfo.gov instead. Never parse raw_text_url directly.
//   - USAspending POST API: free, no key. Recipient legal names differ from
//     issuer names (MP Materials files as MP MINE OPERATIONS LLC), so matching is
//     by name prefix and remains best-effort.
//
// Usage: node --env-file-if-exists=.env.local scripts/ingest-policy.mjs [--dry-run]
//
// Options:
//   --since YYYY-MM-DD   earliest publication date to consider (default: 30 days ago)
//   --min-award <usd>    materiality floor for federal awards (default: 25000000)
//   --min-score <n>      theme-match score a document must clear (default: 3)
//   --skip-awards        no federal awards
//   --skip-frontier      no candidate or fringe pass
//   --skip-themes        no active-theme pass; writes only data/frontier_policy.csv
//   --root <path>        project root (default: cwd)

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const skipAwards = argv.includes('--skip-awards');
const skipFrontier = argv.includes('--skip-frontier');
const skipThemes = argv.includes('--skip-themes');
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const root = path.resolve(flag('root') ?? process.cwd());
const minAward = Number(flag('min-award') ?? 25_000_000);
const minScore = Number(flag('min-score') ?? 3);

const userAgent = process.env.SEC_USER_AGENT
  ?? 'Investo Master research script (set SEC_USER_AGENT to your contact address)';

// Theme keywords. Weighted so that a term which is diagnostic on its own (a
// magnet, an enrichment facility) counts for more than a term that appears in any
// industrial policy document (domestic, supply chain). A document clears the bar
// on one strong term or several weak ones, which is what keeps commemorative
// proclamations out without hand-maintaining a blocklist.
const THEME_KEYWORDS = {
  'critical-minerals-security': {
    strong: ['rare earth', 'critical mineral', 'permanent magnet', 'neodymium', 'samarium',
      'dysprosium', 'praseodymium', 'gallium', 'germanium', 'graphite', 'cobalt',
      'lithium', 'national defense stockpile', 'offtake'],
    weak: ['mineral', 'mining', 'refining', 'processing', 'supply chain', 'stockpile',
      'domestic production', 'Defense Production Act'],
  },
  'advanced-nuclear-enablers': {
    strong: ['nuclear reactor', 'small modular reactor', 'advanced reactor', 'uranium',
      'enrichment', 'nuclear fuel', 'fuel cycle', 'Nuclear Regulatory Commission'],
    weak: ['nuclear', 'reactor', 'radioactive', 'Department of Energy'],
  },
  'age-of-electricity': {
    strong: ['electric grid', 'electricity demand', 'transmission line', 'bulk power system',
      'grid reliability', 'electrification', 'baseload'],
    weak: ['electricity', 'grid', 'power generation', 'energy security', 'transmission'],
  },
  'ai-physical-infrastructure': {
    strong: ['data center', 'artificial intelligence infrastructure', 'compute capacity',
      'semiconductor manufacturing', 'transformer manufacturing', 'CHIPS Act'],
    weak: ['artificial intelligence', 'semiconductor', 'data centers', 'computing',
      'advanced manufacturing'],
  },
  'high-speed-connectivity': {
    strong: ['semiconductor fabrication', 'advanced packaging', 'photonics', 'optical transceiver',
      'interconnect', 'chip export'],
    weak: ['semiconductor', 'microelectronics', 'export control', 'fiber optic'],
  },
  'vertically-integrated-space': {
    strong: ['space launch', 'commercial space', 'satellite constellation', 'orbital',
      'launch vehicle', 'spectrum allocation'],
    weak: ['space', 'satellite', 'aerospace', 'NASA'],
  },
};

// Frontier keywords, for candidate_themes.csv and fringe_watch.csv. Scored by the
// same rules and written to a different file, because a candidate is a watchlist
// entry and not evidence — see the note above data/frontier_policy.csv below.
//
// The frontier pass reads a wider slice of the Federal Register than the theme
// pass does, and the reason is structural. Presidential documents name what an
// administration has already decided to prioritise, which is late. Agency
// rulemaking — and especially PROPOSED rulemaking — is where a field first becomes
// legible to the state, which is earlier and is the whole point of watching at this
// tier. Prediction markets are the clearest case: they are regulated by the CFTC
// through ordinary rulemaking and have essentially never appeared in a presidential
// document, so the theme pass would have reported nothing about them forever.
const FRONTIER_KEYWORDS = {
  'embodied-ai': {
    strong: ['humanoid robot', 'autonomous mobile robot', 'robotic workforce',
      'robot deployment', 'embodied artificial intelligence'],
    weak: ['robotics', 'robot', 'automation', 'artificial intelligence', 'machine learning'],
  },
  'orbital-economics': {
    strong: ['in-space manufacturing', 'on-orbit servicing', 'commercial space station',
      'space traffic coordination', 'orbital debris', 'launch licensing'],
    weak: ['low earth orbit', 'orbital', 'launch', 'commercial space', 'satellite'],
  },
  'synthetic-biology': {
    strong: ['synthetic biology', 'engineering biology', 'biomanufacturing',
      'nucleic acid synthesis', 'gene synthesis', 'bioeconomy'],
    weak: ['biotechnology', 'biological', 'fermentation', 'biosecurity'],
  },
  'fault-tolerant-quantum': {
    strong: ['quantum computing', 'post-quantum cryptography', 'quantum information science',
      'cryptographically relevant quantum computer'],
    weak: ['quantum', 'cryptographic standard', 'encryption'],
  },
  'long-duration-storage': {
    strong: ['long-duration energy storage', 'grid-scale storage', 'battery energy storage'],
    weak: ['energy storage', 'battery', 'grid reliability'],
  },
  'neural-interfaces': {
    strong: ['brain-computer interface', 'neural interface', 'neurotechnology', 'neural data'],
    weak: ['implantable device', 'neurological', 'medical device'],
  },
  'fully-homomorphic-encryption': {
    strong: ['homomorphic encryption', 'privacy-enhancing technolog', 'confidential computing',
      'secure multiparty computation'],
    weak: ['encryption', 'privacy', 'cryptography', 'data protection'],
  },
  'prediction-markets': {
    strong: ['event contract', 'prediction market', 'binary option',
      'designated contract market'],
    weak: ['Commodity Futures Trading Commission', 'derivatives', 'wagering', 'swap'],
  },
  'self-driving-labs': {
    strong: ['autonomous experimentation', 'self-driving laboratory', 'materials genome',
      'artificial intelligence for science'],
    weak: ['laboratory automation', 'research infrastructure', 'high-throughput screening'],
  },
  'organoid-compute': {
    strong: ['organoid intelligence', 'biological computing', 'organoid'],
    weak: ['neural tissue', 'stem cell', 'in vitro'],
  },
};

// Awarding agencies whose spending is an instrument of industrial policy. The
// department was renamed Department of War in 2025; both names are matched so a
// rename in either direction cannot silently empty this feed.
const POLICY_AGENCIES = [
  'department of defense',
  'department of war',
  'department of energy',
  'national aeronautics',
];

// Corporate suffixes carry no identifying information, so they are dropped before
// comparing an issuer name to a federal recipient's legal name.
const NAME_NOISE = new Set([
  'inc', 'inc.', 'corp', 'corp.', 'corporation', 'co', 'co.', 'company', 'llc', 'l.l.c.',
  'ltd', 'ltd.', 'limited', 'plc', 'holdings', 'holding', 'group', 'the', 'and', '&',
  'technologies', 'energy', 'international', 'systems',
]);

// True when the recipient's legal name shares a distinctive whole word with the
// issuer name. Deliberately conservative: federal awards are often made to
// subsidiaries under names that share nothing with the parent (Southern Company's
// awards are filed under MISSISSIPPI POWER CO), so this misses real awards rather
// than inventing false ones. Under-reporting is recoverable; a wrong asset_id in
// the claim registry is not.
const recipientMatchesIssuer = (recipient, issuerName) => {
  const words = issuerName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w.length >= 2 && !NAME_NOISE.has(w));
  if (!words.length) return false;
  const haystack = recipient.toLowerCase();
  return words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack));
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

// --- fetch -------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getJson = async (url, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: { 'user-agent': userAgent, accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
};

const stripHtml = (html) => html
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

// Full text comes from govinfo. federalregister.gov serves an HTML "Request
// Access" interstitial with a 200 status for automated full-text requests, so a
// response that looks successful can still be a bot wall. Detect and drop it.
const getDocumentText = async (doc) => {
  const url = `https://www.govinfo.gov/content/pkg/FR-${doc.publication_date}/html/${doc.document_number}.htm`;
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': userAgent },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) return '';
    const text = stripHtml(await response.text());
    if (/Request Access|Access Denied/i.test(text.slice(0, 400))) return '';
    return text;
  } catch {
    return '';
  }
};

// --- theme matching ----------------------------------------------------------
const countTerm = (haystack, term) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (haystack.match(new RegExp(`\\b${escaped}`, 'gi')) ?? []).length;
};

// Title hits count double: an order titled "...Critical Materials" is about
// critical materials, while the same phrase buried once in a definitions section
// usually is not.
//
// A theme requires at least one strong term. Weak terms only add weight to a
// match that a strong term already established. Without this rule the generic
// vocabulary of industrial policy carries documents in on its own: a North Korea
// emergency notice scores on "nuclear", and tariff proclamations on "supply chain"
// and "domestic production", none of which are evidence about these themes.
const scoreAgainst = (keywordMap, title, body, allowed) => {
  const scores = [];
  for (const [themeId, terms] of Object.entries(keywordMap)) {
    if (!allowed.has(themeId)) continue;
    let score = 0;
    let strongHits = 0;
    const matched = new Set();
    for (const term of terms.strong) {
      const inTitle = countTerm(title, term);
      const inBody = countTerm(body, term);
      if (inTitle || inBody) { matched.add(term); strongHits += 1; }
      score += inTitle * 6 + Math.min(inBody, 4) * 3;
    }
    if (!strongHits) continue;
    for (const term of terms.weak) {
      const inTitle = countTerm(title, term);
      const inBody = countTerm(body, term);
      if (inTitle || inBody) matched.add(term);
      score += inTitle * 2 + Math.min(inBody, 4) * 1;
    }
    scores.push({ themeId, score, strongHits, matched: [...matched] });
  }
  return scores.sort((a, b) => b.score - a.score);
};

const scoreThemes = (title, body, knownThemes) =>
  scoreAgainst(THEME_KEYWORDS, title, body, knownThemes);

// --- presidential documents --------------------------------------------------
const themes = await readTable('themes.csv');
const knownThemes = new Set(themes.map((t) => t.theme_id));

const unknownKeywordThemes = Object.keys(THEME_KEYWORDS).filter((t) => !knownThemes.has(t));
if (unknownKeywordThemes.length) {
  console.warn(`Keyword map references themes absent from themes.csv: ${unknownKeywordThemes.join(', ')} — ignored.\n`);
}

const keptDocuments = [];

if (!skipThemes) {
  const frUrl = new URL('https://www.federalregister.gov/api/v1/documents.json');
  frUrl.searchParams.append('conditions[type][]', 'PRESDOCU');
  frUrl.searchParams.append('conditions[publication_date][gte]', since);
  frUrl.searchParams.set('per_page', '100');
  frUrl.searchParams.set('order', 'newest');
  for (const field of ['title', 'document_number', 'publication_date', 'subtype', 'html_url', 'abstract']) {
    frUrl.searchParams.append('fields[]', field);
  }

  const frResponse = await getJson(frUrl);
  const documents = frResponse.results ?? [];
  console.log(`Presidential documents published since ${since}: ${documents.length}`);

  for (const doc of documents) {
    await sleep(200);
    const body = await getDocumentText(doc);
    const haystack = `${doc.abstract ?? ''} ${body}`;
    const scores = scoreThemes(doc.title ?? '', haystack, knownThemes);
    const best = scores[0];
    if (!best || best.score < minScore) continue;
    keptDocuments.push({
      ...doc,
      themeId: best.themeId,
      score: best.score,
      matched: best.matched.slice(0, 6),
      textAvailable: Boolean(body),
    });
  }

  console.log(`Matched a tracked theme at score >= ${minScore}: ${keptDocuments.length}`);
  for (const d of keptDocuments) {
    console.log(`  ${d.publication_date}  ${String(d.subtype ?? 'Document').padEnd(20)} score ${String(d.score).padStart(3)}  ${d.themeId}`);
    console.log(`      ${d.title.slice(0, 96)}`);
    console.log(`      matched: ${d.matched.join(', ')}${d.textAvailable ? '' : '  (title/abstract only — full text unavailable)'}`);
  }
}

// --- frontier policy ---------------------------------------------------------
// Candidate themes and fringe entries, scored against a wider slice of the register.
//
// Screening is two-stage on purpose. Thirty days of rules and proposed rules is
// well over a thousand documents, and fetching full text for each would take hours
// and hammer govinfo for almost no benefit. So every document is first scored on
// title and abstract, which is free, and only those already showing a strong term
// are fetched in full and rescored. It under-reports — a document whose abstract
// says nothing diagnostic is missed — which is the right way for a watchlist tier
// to fail.
const frontierKept = [];

if (!skipFrontier) {
  const candidates = await readTable('candidate_themes.csv').catch(() => []);
  const fringe = await readTable('fringe_watch.csv').catch(() => []);
  const subjectTier = new Map([
    ...candidates.map((c) => [c.candidate_id, 'candidate']),
    ...fringe.map((f) => [f.fringe_id, 'fringe']),
  ]);
  const knownSubjects = new Set(subjectTier.keys());

  const unknownFrontier = Object.keys(FRONTIER_KEYWORDS).filter((s) => !knownSubjects.has(s));
  if (unknownFrontier.length) {
    console.warn(`\nFrontier keyword map references subjects absent from the tier files: ${unknownFrontier.join(', ')} — ignored.`);
  }

  const frontierUrl = new URL('https://www.federalregister.gov/api/v1/documents.json');
  for (const type of ['PRESDOCU', 'PRORULE', 'RULE']) {
    frontierUrl.searchParams.append('conditions[type][]', type);
  }
  frontierUrl.searchParams.append('conditions[publication_date][gte]', since);
  frontierUrl.searchParams.set('per_page', '1000');
  frontierUrl.searchParams.set('order', 'newest');
  for (const field of ['title', 'document_number', 'publication_date', 'type', 'subtype', 'html_url', 'abstract', 'agencies']) {
    frontierUrl.searchParams.append('fields[]', field);
  }

  let frontierDocs = [];
  try {
    frontierDocs = (await getJson(frontierUrl)).results ?? [];
  } catch (error) {
    console.warn(`\nFrontier register lookup failed (${error.message}) — frontier pass skipped.`);
  }

  console.log(`\nRegister documents since ${since} for the frontier pass (presidential, proposed rules, rules): ${frontierDocs.length}`);

  // per_page maxes at 1000 and this pass does not paginate. Hitting the cap means
  // the window was silently truncated to its most recent 1000 documents, and the
  // older end of the requested range was never examined. Rules run at roughly 120
  // a week, so any --since beyond about two months will trip this.
  if (frontierDocs.length >= 1000) {
    console.warn('  WARNING: hit the 1000-document page cap. Older documents in this window were not read.');
    console.warn('  Narrow --since, or run the pass in several shorter windows.');
  }

  // Stage one: title and abstract only. A document that shows no strong term here
  // is not worth a full-text fetch.
  const shortlist = [];
  for (const doc of frontierDocs) {
    const scores = scoreAgainst(FRONTIER_KEYWORDS, doc.title ?? '', doc.abstract ?? '', knownSubjects);
    if (scores[0]) shortlist.push({ doc, preliminary: scores[0] });
  }
  console.log(`  showing a strong term in title or abstract: ${shortlist.length}`);

  // Stage two: full text for the shortlist, then the real threshold.
  for (const { doc, preliminary } of shortlist) {
    await sleep(200);
    const body = await getDocumentText(doc);
    const haystack = `${doc.abstract ?? ''} ${body}`;
    const scores = scoreAgainst(FRONTIER_KEYWORDS, doc.title ?? '', haystack, knownSubjects);
    const best = scores[0] ?? preliminary;
    if (best.score < minScore) continue;
    frontierKept.push({
      ...doc,
      subjectId: best.themeId,
      tier: subjectTier.get(best.themeId),
      score: best.score,
      matched: best.matched.slice(0, 6),
      textAvailable: Boolean(body),
      agencyNames: (doc.agencies ?? []).map((a) => a.name).filter(Boolean).join('; '),
    });
  }

  console.log(`  matched a frontier subject at score >= ${minScore}: ${frontierKept.length}`);
  for (const d of frontierKept) {
    console.log(`  ${d.publication_date}  ${String(d.type ?? 'Document').padEnd(12)} score ${String(d.score).padStart(3)}  ${d.tier}/${d.subjectId}`);
    console.log(`      ${String(d.title).slice(0, 96)}`);
    console.log(`      matched: ${d.matched.join(', ')}${d.textAvailable ? '' : '  (title/abstract only — full text unavailable)'}`);
  }
}

// --- federal awards ----------------------------------------------------------
const assets = await readTable('assets.csv');
const equities = assets.filter((a) => a.asset_type === 'equity' && a.symbol);

const awards = [];
if (!skipAwards) {
  console.log(`\nFederal awards to tracked equities since ${since} at or above $${(minAward / 1e6).toFixed(0)}M:`);
  for (const asset of equities) {
    await sleep(120);
    let results = [];
    try {
      const payload = {
        filters: {
          recipient_search_text: [asset.name],
          award_type_codes: ['A', 'B', 'C', 'D'],
          // new_awards_only, not the default action_date: the default matches any
          // award whose period of performance overlaps the window, which returns
          // contracts first signed decades ago. Only newly signed awards are events.
          time_period: [{ start_date: since, end_date: asOf, date_type: 'new_awards_only' }],
          award_amounts: [{ lower_bound: minAward }],
        },
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date', 'Description'],
        limit: 10,
        sort: 'Award Amount',
        order: 'desc',
      };
      const data = await getJson('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      results = data.results ?? [];
    } catch (error) {
      console.warn(`  ${asset.symbol}: USAspending lookup failed (${error.message}) — skipped.`);
      continue;
    }

    for (const award of results) {
      // recipient_search_text matches loosely, so confirm the returned legal name
      // actually relates to the issuer before recording it against the asset. The
      // check is on a whole word, not a substring: "GE Vernova" reduced to "ge"
      // is a substring of GEORGIA POWER and GENERAL DYNAMICS, which would file
      // another company's award against a tracked asset.
      const recipient = String(award['Recipient Name'] ?? '');
      if (!recipientMatchesIssuer(recipient, asset.name)) continue;

      // Only agencies whose spending expresses industrial policy. Without this the
      // feed fills with the government paying its own utility bills: GSA, Interior
      // and Justice awards to tracked utilities are procurement, not a signal.
      const agency = String(award['Awarding Agency'] ?? '');
      if (!POLICY_AGENCIES.some((a) => agency.toLowerCase().includes(a))) continue;

      // Belt and braces against the date filter: new_awards_only is respected by
      // the API today, but a silent change would otherwise backfill old awards.
      const startDate = String(award['Start Date'] ?? '').slice(0, 10);
      if (startDate && startDate < since) continue;

      awards.push({
        assetId: asset.asset_id,
        symbol: asset.symbol,
        name: asset.name,
        awardId: String(award['Award ID'] ?? ''),
        recipient,
        amount: Number(award['Award Amount'] ?? 0),
        agency: String(award['Awarding Agency'] ?? ''),
        startDate: String(award['Start Date'] ?? '').slice(0, 10),
        description: String(award.Description ?? '').slice(0, 200),
      });
    }
  }
  if (!awards.length) console.log('  none');
  for (const a of awards) {
    console.log(`  ${a.symbol.padEnd(5)} $${(a.amount / 1e6).toFixed(1)}M  ${a.agency.slice(0, 34).padEnd(34)} ${a.startDate}`);
  }
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
const existingUrls = new Set(sourceRows.map((r) => r[9]).filter(Boolean));

// Keyed by Federal Register document number and USAspending award ID, so the same
// action keeps one identity however many times the window is widened.
const docRows = keptDocuments
  .map((d) => ({ d, id: `src-fedreg-${d.document_number}` }))
  .filter(({ d, id }) => !existing.has(id) && !existingUrls.has(d.html_url))
  .map(({ d, id }) => [
    id, asOf, '', d.themeId, 'presidential_action',
    d.title,
    'Federal Register', d.publication_date, asOf, d.html_url, 'true', 'context',
    `${d.subtype ?? 'Presidential document'} published ${d.publication_date}: "${d.title}". Language matches the ${d.themeId} theme (${d.matched.join(', ')}). Contents not yet reviewed; the document names policy, not companies.`,
    'high',
  ]);

const awardRows = awards
  .map((a) => ({ a, id: `src-usasp-${a.awardId.replace(/[^A-Za-z0-9]/g, '')}` }))
  .filter(({ id }) => !existing.has(id))
  .map(({ a, id }) => [
    id, asOf, a.assetId, '', 'federal_award',
    `${a.symbol} federal award ${a.startDate}`,
    'USAspending.gov', a.startDate, asOf,
    `https://www.usaspending.gov/award/${encodeURIComponent(a.awardId)}`, 'true', 'context',
    `${a.agency} awarded $${(a.amount / 1e6).toFixed(1)}M to ${a.recipient} with a start date of ${a.startDate}. Recorded as a federal award to ${a.name}; the award document has not been reviewed.`,
    'high',
  ]);

// Frontier matches go to their own file and never to sources.csv. A candidate is a
// watchlist entry, not evidence: putting an agency's proposed rule about prediction
// markets next to an SEC filing would let speculative material reach the weekly
// issue's evidence base, which is the one thing the frontier tier exists to prevent.
const frontierPath = path.join(root, 'data', 'frontier_policy.csv');
const frontierHeader = [
  'week_id', 'as_of_date', 'policy_id', 'tier', 'subject_id', 'document_type',
  'document_number', 'title', 'agencies', 'publisher', 'published_at', 'accessed_at',
  'url', 'matched_terms', 'score', 'claim',
];

let frontierExisting = [];
try {
  frontierExisting = parseCsv(await readFile(frontierPath, 'utf8')).slice(1);
} catch { /* first run */ }
const frontierSeen = new Set(frontierExisting.map((r) => r[2]));

const frontierRows = frontierKept
  .map((d) => ({ d, id: `pol-${d.subjectId}-${d.document_number}` }))
  .filter(({ id }) => !frontierSeen.has(id))
  .map(({ d, id }) => [
    weekId, asOf, id, d.tier, d.subjectId, d.type ?? '', d.document_number,
    d.title, d.agencyNames, 'Federal Register', d.publication_date, asOf, d.html_url,
    d.matched.join('; '), d.score,
    `${d.type === 'PRORULE' ? 'Proposed rule' : d.type === 'RULE' ? 'Final rule' : d.subtype ?? 'Presidential document'} published ${d.publication_date}: "${d.title}". Language matches the ${d.subjectId} ${d.tier} entry (${d.matched.join(', ')}). Contents not reviewed. This records that the state has begun writing about the area, which is a regulatory-motion signal and nothing more.`,
  ]);

const rows = [...docRows, ...awardRows];
if (!rows.length && !frontierRows.length) {
  const total = keptDocuments.length + awards.length + frontierKept.length;
  console.log(`\nNothing to write — all ${total} matched actions already recorded.`);
  process.exit(0);
}

if (rows.length) {
  const trimmed = sourcesText.endsWith('\n') ? sourcesText : `${sourcesText}\n`;
  const appended = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  await writeFile(sourcesPath, `${trimmed}${appended}\n`, 'utf8');
}

if (frontierRows.length) {
  const body = [frontierHeader, ...frontierExisting, ...frontierRows]
    .map((row) => row.map(csvCell).join(',')).join('\n');
  await writeFile(frontierPath, `${body}\n`, 'utf8');
}

const skipped = (keptDocuments.length + awards.length + frontierKept.length)
  - (rows.length + frontierRows.length);
console.log(`\nWrote data/sources.csv: +${docRows.length} presidential-action rows, +${awardRows.length} federal-award rows (week ${weekId})`);
console.log(`Wrote data/frontier_policy.csv: +${frontierRows.length} frontier rows (${frontierExisting.length + frontierRows.length} total)`);
if (skipped) console.log(`${skipped} already recorded — skipped.`);
console.log('Claims record that each action exists and which theme its language touches.');
console.log('Deciding whether it changes a thesis is a research step.');
