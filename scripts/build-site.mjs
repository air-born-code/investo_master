// Builds a static tracking site from the store and the published issues.
//
// The site is a presentation layer and nothing more. It reads data/*.csv and
// reports/**, holds no state of its own, and writes only to site/. Per the README,
// the public presentation layer must never become a second, conflicting research
// database — so if a number here disagrees with the store, the store is right.
//
// Output is local by default. Publishing research is a decision the investor makes
// deliberately; nothing here deploys anything.
//
// Usage: node scripts/build-site.mjs [--root <path>]
// Then:  npm run site:serve

import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { columnChart, formatValue, rangeSummary } from './lib/chart.mjs';
import { describeGap, reviewedEvidence, selectCoverage } from './lib/rotation.mjs';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const root = path.resolve(flag('root') ?? process.cwd());
const outDir = path.join(root, 'site');

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

const readTable = async (name) => {
  try {
    const rows = parseCsv(await readFile(path.join(root, 'data', name), 'utf8'));
    const [header, ...body] = rows;
    return body.map((cells) => Object.fromEntries(header.map((k, i) => [k, cells[i] ?? ''])));
  } catch {
    return [];
  }
};

const e = (v) => String(v ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const [assets, themes, links, scores, metrics, macro, gates, sources, macroSpecs, macroHistory,
  sections, aiChain, aiPool, cryptoRails, agentSeries] =
  await Promise.all([
    readTable('assets.csv'), readTable('themes.csv'), readTable('asset_themes.csv'),
    readTable('scores.csv'), readTable('weekly_metrics.csv'), readTable('macro.csv'),
    readTable('gates.csv'), readTable('sources.csv'), readTable('macro_series.csv'),
    readTable('macro_history.csv'), readTable('sections.csv'), readTable('ai_value_chain.csv'),
    readTable('ai_profit_pool.csv'), readTable('crypto_rails.csv'), readTable('agent_traffic.csv'),
  ]);

// --- issues -------------------------------------------------------------------
const issues = [];
const reportsRoot = path.join(root, 'reports');
for (const year of await readdir(reportsRoot).catch(() => [])) {
  for (const dir of await readdir(path.join(reportsRoot, year)).catch(() => [])) {
    const metaPath = path.join(reportsRoot, year, dir, 'report.json');
    try {
      const meta = JSON.parse(await readFile(metaPath, 'utf8'));
      issues.push({ ...meta, year, dir });
    } catch { /* not a published issue */ }
  }
}
issues.sort((a, b) => (a.week_id < b.week_id ? 1 : -1));
const latest = issues[0];

// --- shared layout ------------------------------------------------------------
// Sections sit above themes in the navigation as well as in the store. Electricity
// is indented under AI rather than listed beside it, because it is a layer of the AI
// value chain and presenting the two as peers is the framing the restructure removes.
const NAV = [
  ['index.html', 'Dashboard'], ['coverage.html', 'Coverage'], ['universe.html', 'Universe'],
  ['ai.html', 'AI'], ['electricity.html', '· Electricity'], ['crypto.html', 'Digital Assets'],
  ['themes.html', 'Themes'], ['gates.html', 'Gates'],
  ['evidence.html', 'Evidence'], ['archive.html', 'Archive'],
];

const page = (active, title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${e(title)} · Investo Master</title>
<style>
:root{--navy:#13263d;--blue:#527095;--cream:#f7f4ec;--line:#d9d7cf;--ink:#263849;--muted:#7b8792;--paper:#fff}
@media(prefers-color-scheme:dark){:root{--navy:#0d1826;--cream:#161b22;--line:#2b3340;--ink:#c9d3df;--muted:#8b97a6;--paper:#1c222c}}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
header{background:var(--navy);padding:22px 26px}
header a.brand{color:#fff;font-family:Georgia,serif;font-size:20px;text-decoration:none}
nav{margin-top:14px;display:flex;flex-wrap:wrap;gap:6px}
nav a{color:#c9d3df;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:6px 10px;border-radius:999px}
nav a.on{background:rgba(255,255,255,.14);color:#fff}
main{max-width:1080px;margin:0 auto;padding:26px}
h1{font-family:Georgia,serif;font-weight:500;font-size:27px;margin:0 0 6px}
h2{font-family:Georgia,serif;font-weight:500;font-size:20px;margin:30px 0 12px}
.sub{color:var(--muted);font-size:13px;margin:0 0 22px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:26px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:15px}
.card .n{font-size:26px;font-weight:800;color:var(--navy)}
@media(prefers-color-scheme:dark){.card .n{color:#8fc3ff}}
.card .l{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:3px}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:13px}
th{background:rgba(82,112,149,.1);color:var(--blue);font-size:10px;letter-spacing:.08em;text-transform:uppercase;text-align:left;padding:9px 11px}
td{padding:9px 11px;border-top:1px solid var(--line);vertical-align:top}
td.r,th.r{text-align:right}
.pill{display:inline-block;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:rgba(82,112,149,.14);color:var(--blue)}
.pill.cand{background:rgba(47,111,84,.16);color:#2f6f54}
.pill.warn{background:rgba(154,107,24,.16);color:#9a6b18}
a{color:#2e5f8f}
@media(prefers-color-scheme:dark){a{color:#8fc3ff}}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.chart-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.chart-label{font-size:12px;font-weight:800;color:var(--navy)}
@media(prefers-color-scheme:dark){.chart-label{color:#c9d3df}}
.chart-value{font-family:Georgia,serif;font-size:22px;color:var(--navy)}
@media(prefers-color-scheme:dark){.chart-value{color:#8fc3ff}}
.chart-role{font-size:11px;color:var(--muted);margin:3px 0 10px;line-height:1.45}
.chart-range{font-size:10px;color:var(--muted);margin-top:7px}
.card details{margin-top:9px;border-top:1px solid var(--line);padding-top:8px}
.card summary{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);cursor:pointer;font-weight:800}
.card details p{font-size:12px;line-height:1.55;margin:8px 0 0}
.card details p.caveat{color:#8a5b1c;font-size:11px}
@media(prefers-color-scheme:dark){.card details p.caveat{color:#c08a3e}}
.note{background:rgba(154,107,24,.1);border-left:4px solid #ad7a25;padding:13px 15px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.6;margin:20px 0}
.rb{position:relative;height:8px;min-width:90px;background:rgba(82,112,149,.14);border-radius:999px;overflow:hidden}
.rb-fill{height:8px;background:#527095;border-radius:999px}
@media(prefers-color-scheme:dark){.rb-fill{background:#6f96c4}}
details.detail{border:1px solid var(--line);background:var(--paper);border-radius:10px;padding:10px 13px;margin:8px 0}
details.detail summary{font-size:12px;font-weight:700;color:var(--blue);cursor:pointer}
details.detail p{font-size:12px;line-height:1.6;margin:9px 0 0}
footer{color:var(--muted);font-size:11px;padding:26px;max-width:1080px;margin:0 auto;border-top:1px solid var(--line)}
</style></head><body>
<header>
  <a class="brand" href="index.html">Investo Master</a>
  <nav>${NAV.map(([href, label]) =>
    `<a class="${href === active ? 'on' : ''}" href="${href}">${e(label)}</a>`).join('')}</nav>
</header>
<main>${body}</main>
<footer>
  Generated ${e(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC from data/ and reports/.
  This is a presentation layer: the CSV store is the source of truth.
  Research and decision support only — no trades, promised returns, or personalised advice.
</footer>
</body></html>`;

const table = (headers, rows) => `<div class="scroll"><table><tr>${
  headers.map((h) => `<th${h.startsWith('>') ? ' class="r"' : ''}>${e(h.replace(/^>/, ''))}</th>`).join('')
}</tr>${rows.join('')}</table></div>`;

// --- shared derivations -------------------------------------------------------
const tierOf = (a) => a.tier || 'candidate';
const candidates = assets.filter((a) => tierOf(a) === 'candidate');
const universe = assets.filter((a) => tierOf(a) === 'universe');
const nameOf = new Map(assets.map((a) => [a.asset_id, a.name || a.asset_id]));
const symbolOf = new Map(assets.map((a) => [a.asset_id, a.symbol || a.asset_id]));

const latestScoreWeek = [...new Set(scores.map((s) => s.week_id))].sort().at(-1);
const boardScores = scores.filter((s) => s.week_id === latestScoreWeek);
const latestMetricWeek = [...new Set(metrics.map((m) => m.week_id))].sort().at(-1);
const metricOf = new Map(metrics.filter((m) => m.week_id === latestMetricWeek).map((m) => [m.asset_id, m]));

const usd = (raw) => {
  const n = Number(raw);
  if (!raw || Number.isNaN(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
};

const gateTotal = new Set(gates.map((g) => g.gate_id)).size || 13;
const gatesDoneFor = (id) => gates.filter((g) => g.asset_id === id && g.status === 'documented').length;

const filings = sources
  .filter((s) => s.source_type === 'filing')
  .sort((a, b) => (a.published_at < b.published_at ? 1 : -1));

// --- dashboard ----------------------------------------------------------------
const macroWeek = [...new Set(macro.map((m) => m.week_id))].sort().at(-1);
const macroRows = macro.filter((m) => m.week_id === macroWeek);
const fmtMacro = (r) => formatValue(r.value, r.unit);

// Same registry the issue builder reads, so the site cannot describe a series
// differently from the email that was sent. Full monthly resolution here: the site
// has no size limit to respect.
const regime = macroSpecs
  .map((spec) => {
    const snapshot = macroRows.find((r) => r.series_id === spec.series_id);
    if (!snapshot) return undefined;
    const points = macroHistory
      .filter((r) => r.series_id === spec.series_id)
      .sort((a, b) => a.observation_date.localeCompare(b.observation_date));
    return { spec, snapshot, points };
  })
  .filter(Boolean);

const regimeSection = regime.length ? `
<h2>Regime board · ${e(macroWeek)}</h2>
<p class="sub">Each series once, against its own decade. Commentary is authored and reviewed, not regenerated weekly.</p>
<div class="charts">${regime.map(({ spec, snapshot, points }) => `
  <div class="card">
    <div class="chart-head">
      <span class="chart-label">${e(spec.label)}</span>
      <span class="chart-value">${e(fmtMacro(snapshot))}</span>
    </div>
    <div class="chart-role">${e(spec.regime_role)}</div>
    ${points.length > 1 ? columnChart(points, { unit: snapshot.unit, height: 66, fill: '#a9bdd2', accent: '#2e5f8f' }) : ''}
    <div class="chart-range">${e(rangeSummary(points, snapshot.unit) || snapshot.observation_date)}</div>
    <details><summary>How this reaches equity prices</summary>
      <p>${e(spec.equity_transmission)}</p>
      ${spec.caveat ? `<p class="caveat"><strong>Read with care:</strong> ${e(spec.caveat)}</p>` : ''}
    </details>
  </div>`).join('')}</div>
<p class="sub" style="margin-top:14px">Transmission mechanisms, not forecasts. A macro reading is context for underwriting, never a trigger for action.</p>
` : (macroRows.length ? `<h2>Regime board · ${e(macroWeek)}</h2>${table(
  ['Series', '>Value', '>Observation'],
  macroRows.map((r) => `<tr><td>${e(r.label)}</td><td class="r"><strong>${e(fmtMacro(r))}</strong></td><td class="r">${e(r.observation_date)}</td></tr>`),
)}` : '');

const dashboard = `
<h1>Tracking dashboard</h1>
<p class="sub">${latest
  ? `Latest issue: <strong>${e(latest.subject)}</strong> · week ${e(latest.week_id)} · ${e(latest.action_posture)}`
  : 'No issues published yet.'}</p>
<div class="grid">
  <div class="card"><div class="n">${assets.length}</div><div class="l">Tracked assets</div></div>
  <div class="card"><div class="n">${candidates.length}</div><div class="l">Candidates</div></div>
  <div class="card"><div class="n">${themes.length}</div><div class="l">Themes</div></div>
  <div class="card"><div class="n">${filings.length}</div><div class="l">Filings recorded</div></div>
  <div class="card"><div class="n">${sources.length}</div><div class="l">Source rows</div></div>
  <div class="card"><div class="n">${candidates.filter((c) => gatesDoneFor(c.asset_id) === gateTotal).length}/${candidates.length}</div><div class="l">Clear all gates</div></div>
</div>

${regimeSection}

<h2>Conviction board · ${e(latestScoreWeek ?? '—')}</h2>
${table(['Candidate', 'Stage', '>Score', '>Asym.', '>Confidence', '>Market cap', '>Gates'],
  boardScores.sort((a, b) => Number(b.total_score) - Number(a.total_score)).map((s) => `<tr>
    <td><strong>${e(symbolOf.get(s.asset_id))}</strong><div style="color:var(--muted);font-size:11px">${e(nameOf.get(s.asset_id))}</div></td>
    <td><span class="pill cand">${e(assets.find((a) => a.asset_id === s.asset_id)?.stage ?? '')}</span></td>
    <td class="r"><strong>${e(s.total_score)}</strong></td>
    <td class="r">${e(s.valuation_asymmetry)}/10</td>
    <td class="r">${e(s.thesis_confidence)}</td>
    <td class="r">${e(usd(metricOf.get(s.asset_id)?.market_cap))}</td>
    <td class="r">${gatesDoneFor(s.asset_id)}/${gateTotal}</td></tr>`))}

<h2>Most recent filings</h2>
${table(['Filed', 'Asset', 'Document', ''], filings.slice(0, 15).map((f) => `<tr>
  <td>${e(f.published_at)}</td>
  <td><strong>${e(symbolOf.get(f.asset_id) ?? f.asset_id)}</strong></td>
  <td>${e(f.title)}</td>
  <td class="r"><a href="${e(f.url)}" rel="noopener">open</a></td></tr>`))}
`;

// --- universe -----------------------------------------------------------------
const themesFor = (id) => links.filter((l) => l.asset_id === id).map((l) => l.theme_id);
const universePage = `
<h1>Universe</h1>
<p class="sub">${assets.length} tracked · ${candidates.length} candidate · ${universe.length} coverage.
Universe membership implies coverage, not interest.</p>
${table(['Symbol', 'Name', 'Tier', 'Stage', 'Industry', 'Themes'],
  [...assets].sort((a, b) => tierOf(a).localeCompare(tierOf(b)) || (a.symbol ?? '').localeCompare(b.symbol ?? ''))
    .map((a) => `<tr>
      <td><strong>${e(a.symbol)}</strong></td>
      <td>${e(a.name)}</td>
      <td><span class="pill ${tierOf(a) === 'candidate' ? 'cand' : ''}">${e(tierOf(a))}</span></td>
      <td>${e(a.stage)}</td>
      <td style="color:var(--muted)">${e(a.industry)}</td>
      <td style="font-size:11px;color:var(--muted)">${e(themesFor(a.asset_id).join(', '))}</td></tr>`))}
`;

// --- themes -------------------------------------------------------------------
// Grouped by section. A theme with no section_id is rendered under "Unsectioned"
// rather than silently dropped — an unclassified theme is a gap in the taxonomy and
// should be visible as one.
const themeBlock = (t) => {
  const members = links.filter((l) => l.theme_id === t.theme_id);
  return `<h3 style="font-family:Georgia,serif;font-weight:500;font-size:17px;margin:22px 0 8px">${e(t.name)}</h3>
  <p class="sub"><span class="pill ${t.status === 'active' ? 'cand' : 'warn'}">${e(t.status)}</span>
  &nbsp;${e(t.time_horizon)} · ${e(t.confidence)} confidence</p>
  <p style="margin:-12px 0 14px">${e(t.summary)}</p>
  ${members.length ? table(['Symbol', 'Name', 'Role', '>Relevance'], members.map((m) => `<tr>
    <td><strong>${e(symbolOf.get(m.asset_id) ?? m.asset_id)}</strong></td>
    <td>${e(nameOf.get(m.asset_id))}</td>
    <td>${e(m.role)}</td>
    <td class="r">${e(m.relevance)}</td></tr>`))
    : '<p class="sub">No assets tracked against this theme yet. The absence is the current finding.</p>'}`;
};

const sectionOrder = sections.length
  ? sections.map((s) => s.section_id)
  : [...new Set(themes.map((t) => t.section_id).filter(Boolean))];
const unsectioned = themes.filter((t) => !sectionOrder.includes(t.section_id));

const themesPage = `
<h1>Themes</h1>
<p class="sub">Structural changes being tracked, and the assets that express them.
Themes sit inside sections; ${e(sections.length)} sections, ${e(themes.length)} themes.</p>
${sectionOrder.map((id) => {
  const section = sections.find((s) => s.section_id === id);
  const members = themes.filter((t) => t.section_id === id);
  if (!members.length) return '';
  return `<h2>${e(section?.name ?? id)}</h2>
  <p class="sub" style="margin-bottom:6px">${e(section?.summary ?? '')}</p>
  ${members.map(themeBlock).join('')}`;
}).join('')}
${unsectioned.length ? `<h2>Unsectioned</h2>
<p class="sub">Themes not yet assigned to a section. This list should normally be empty.</p>
${unsectioned.map(themeBlock).join('')}` : ''}
`;

// --- AI section ---------------------------------------------------------------
// The parent section. The point of this page is the one comparison no per-theme page
// can make: where the benchmark says profit sits, against where our coverage sits.
// The cents are a single third-party estimate on a single date and are labelled as
// such everywhere they appear — the page is built so a reader cannot mistake the
// benchmark for a measurement.
const aiSection = sections.find((s) => s.section_id === 'ai');
const aiThemes = themes.filter((t) => t.section_id === 'ai');
const poolWeek = [...new Set(aiPool.map((r) => r.week_id))].sort().at(-1);
const poolRows = aiPool.filter((r) => r.week_id === poolWeek);
const poolOf = new Map(poolRows.map((r) => [r.layer_id, r]));

const centsIn = (cls) => aiChain
  .filter((l) => (l.exposure_class || 'none') === cls)
  .reduce((sum, l) => sum + Math.max(Number(l.profit_cents) || 0, 0), 0);
const coreCents = centsIn('core');
const adjacentCents = centsIn('adjacent');
const noneCents = centsIn('none');
const chainNameCount = aiChain.reduce((sum, l) => {
  const ids = (l.asset_ids || '').split(',').filter(Boolean);
  return sum + (l.parent_layer_id === 'dc-chips-servers' && l.layer_id === 'custom-asics' ? 0 : ids.length);
}, 0);

// A profit bar scaled to the largest slice, so 29.7c against 0.2c is visible as the
// order-of-magnitude difference it is rather than two similar-looking table cells.
const centsMax = Math.max(...aiChain.map((l) => Number(l.profit_cents) || 0), 1);
const centsBar = (cents, cls) => {
  const v = Number(cents);
  if (!Number.isFinite(v) || v <= 0) return '<span style="color:var(--muted);font-size:11px">no profit box</span>';
  const fill = cls === 'core' ? '#2f6f54' : (cls === 'adjacent' ? '#9a6b18' : '#b64f4f');
  return `<div class="rb"><div class="rb-fill" style="width:${((v / centsMax) * 100).toFixed(1)}%;background:${fill}"></div></div>`;
};

// The red "none" is reserved for layers that actually have a profit box. Marking a
// routing bucket or a cost line as a coverage gap would inflate the count of things
// we are supposedly missing, which is the same dishonesty as understating it.
const exposurePill = (cls, count, hasProfitBox) => {
  if (count > 0) {
    return cls === 'adjacent'
      ? `<span class="pill warn">${count} adjacent</span>`
      : `<span class="pill cand">${count} held</span>`;
  }
  return hasProfitBox
    ? '<span class="pill" style="background:rgba(182,79,79,.16);color:#b64f4f">none</span>'
    : '<span style="color:var(--muted);font-size:11px">n/a</span>';
};

const aiPage = aiChain.length ? `
<h1>Artificial Intelligence</h1>
<p class="sub">${e(aiSection?.summary ?? '')}
<br><strong>Central question:</strong> ${e(aiSection?.central_question ?? '')}</p>

<div class="grid">
  <div class="card"><div class="n">${e(coreCents.toFixed(1))}¢</div><div class="l">Profit we cover directly</div></div>
  <div class="card"><div class="n">${e(adjacentCents.toFixed(1))}¢</div><div class="l">Covered only adjacently</div></div>
  <div class="card"><div class="n">${e(noneCents.toFixed(1))}¢</div><div class="l">No coverage at all</div></div>
  <div class="card"><div class="n">${e(aiThemes.length)}</div><div class="l">Themes in section</div></div>
</div>

<div class="note">
  <strong>Read the cents as one house's estimate, not a measurement.</strong> Every profit figure on
  this page comes from a single iCapital exhibit dated July 2026, which publishes no allocation
  methodology and describes itself as illustrative. It is stored as a dated benchmark so that later
  estimates can be compared against it. Nothing here is recomputed weekly — what <em>is</em> updated
  weekly is our own observable position in each layer.
</div>

<h2>Where the dollar goes</h2>
<p class="sub">A user pays $1.00. Because the model layer loses money, a further 17.3¢ of external
funding enters alongside it, so $1.173 flows through the chain against $1.00 of real demand — roughly
15% of everything moving through this chart is subsidy rather than revenue.</p>

${table(['Layer', '>Profit per $1', '>Share', 'Our coverage', 'What the position is'],
  aiChain
    .filter((l) => l.frame_position !== 'outside-frame' || l.layer_id === 'application-layer')
    .sort((a, b) => Number(a.flow_order) - Number(b.flow_order))
    .map((l) => {
      const ids = (l.asset_ids || '').split(',').map((s) => s.trim()).filter(Boolean);
      const cls = l.exposure_class || 'none';
      const cents = Number(l.profit_cents);
      const indent = l.parent_layer_id ? 'padding-left:26px' : '';
      return `<tr>
        <td style="${indent}"><strong>${e(l.name)}</strong>
          <div style="color:var(--muted);font-size:11px">${e(l.what_it_is)}</div></td>
        <td class="r" style="white-space:nowrap">${Number.isFinite(cents) && cents !== 0
          ? `<strong>${cents > 0 ? '' : '−'}${Math.abs(cents).toFixed(1)}¢</strong>`
          : '<span style="color:var(--muted)">—</span>'}</td>
        <td>${centsBar(l.profit_cents, cls)}</td>
        <td>${exposurePill(cls, ids.length, l.has_profit_box === 'true')}
          ${ids.length ? `<div style="color:var(--muted);font-size:10px;margin-top:3px">${
            e(ids.map((id) => symbolOf.get(id) ?? id).join(' '))}</div>` : ''}</td>
        <td style="font-size:12px">${e(l.exposure_verdict)}</td></tr>`;
    }))}

<div class="note">
  <strong>The finding.</strong> ${e(coreCents.toFixed(1))}¢ of every AI dollar lands in layers we
  cover directly, ${e(adjacentCents.toFixed(1))}¢ in a layer we touch only adjacently, and
  ${e(noneCents.toFixed(1))}¢ in layers we do not track at all — including the single largest slice
  in the chain. Our deepest coverage sits in flows this exhibit draws as spending leaving the frame
  with no profit box drawn. That may be the exhibit's blind spot or it may be ours; both readings are
  set out in <code>research/sections/ai.md</code> and neither is settled here.
</div>

${poolRows.length ? `<h2>Position by layer · ${e(poolWeek)}</h2>
<p class="sub">Updated every week by <code>scripts/ingest-ai-chain.mjs</code>. The benchmark cents are
frozen; these columns are ours and they move.</p>
${table(['Layer', '>Benchmark', '>Names', '>Tracked market cap', '>Change', '>Median growth', '>On primary evidence'],
  poolRows
    .filter((r) => Number(r.our_name_count) > 0 || Number(r.benchmark_profit_cents) > 0)
    .sort((a, b) => (Number(b.benchmark_profit_cents) || 0) - (Number(a.benchmark_profit_cents) || 0))
    .map((r) => `<tr>
      <td><strong>${e(r.layer_name)}</strong></td>
      <td class="r">${r.benchmark_profit_cents ? `${e(r.benchmark_profit_cents)}¢` : '—'}</td>
      <td class="r">${e(r.our_name_count)}</td>
      <td class="r">${e(usd(r.aggregate_market_cap_usd))}</td>
      <td class="r" style="color:${Number(r.market_cap_change_pct) >= 0 ? '#2f6f54' : '#9a6b18'}">${
        r.market_cap_change_pct ? `${Number(r.market_cap_change_pct) >= 0 ? '+' : ''}${e(r.market_cap_change_pct)}%` : '—'}</td>
      <td class="r">${r.median_revenue_growth_yoy ? `${(Number(r.median_revenue_growth_yoy) * 100).toFixed(1)}%` : '—'}</td>
      <td class="r">${e(r.names_on_primary_evidence)}/${e(r.our_name_count)}</td></tr>`))}
<p class="sub" style="margin-top:10px">Market caps are from <code>weekly_metrics.csv</code>
(${e(poolRows[0]?.metrics_from_week ?? '—')}); the change column compares against
${e(poolRows.find((r) => r.compared_with_week)?.compared_with_week || 'no prior snapshot')} and is
left blank rather than estimated where the two weeks do not cover the same names.</p>` : ''}

<h2>Themes in this section</h2>
<p class="sub">Electricity is one of these, not a peer of the section.</p>
${table(['Theme', 'Status', 'Horizon', '>Assets', ''],
  aiThemes.map((t) => `<tr>
    <td><strong>${e(t.name)}</strong>
      <div style="color:var(--muted);font-size:11px">${e(t.summary)}</div></td>
    <td><span class="pill ${t.status === 'active' ? 'cand' : 'warn'}">${e(t.status)}</span></td>
    <td style="font-size:12px">${e(t.time_horizon)}</td>
    <td class="r">${links.filter((l) => l.theme_id === t.theme_id).length}</td>
    <td class="r">${t.theme_id === 'age-of-electricity'
      ? '<a href="electricity.html">open</a>' : ''}</td></tr>`))}

<h2>Section evidence</h2>
${table(['Published', 'Stance', 'Claim', '>Reliability'],
  sources.filter((s) => aiThemes.some((t) => t.theme_id === s.theme_id) && s.source_type !== 'filing')
    .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
    .slice(0, 20)
    .map((s) => `<tr>
      <td style="white-space:nowrap">${e(s.published_at)}</td>
      <td><span class="pill ${s.stance === 'contradicts' ? 'warn' : ''}">${e(s.stance)}</span></td>
      <td style="font-size:12px">${e(s.claim)}</td>
      <td class="r" style="font-size:11px">${e(s.reliability)}${s.is_primary === 'true' ? ' · primary' : ''}</td></tr>`))}

<p class="sub" style="margin-top:20px">Section note: <code>research/sections/ai.md</code>.
Layer taxonomy: <code>data/ai_value_chain.csv</code>. Weekly series:
<code>data/ai_profit_pool.csv</code>.</p>
` : '<h1>Artificial Intelligence</h1><p class="sub">No value-chain taxonomy recorded yet.</p>';

// --- Digital assets section ---------------------------------------------------
// Separate from AI on purpose. The demand hypothesis overlaps; the constraints, the
// failure modes and the falsifiers do not, and nesting it under AI would import the
// AI narrative as an assumption rather than testing it.
const cryptoSection = sections.find((s) => s.section_id === 'digital-assets');
const cryptoThemes = themes.filter((t) => t.section_id === 'digital-assets');
const seriesWeek = [...new Set(agentSeries.map((r) => r.week_id))].sort().at(-1);
const seriesRows = agentSeries.filter((r) => r.week_id === seriesWeek);
const claimRows = agentSeries.filter((r) => r.data_quality?.startsWith('UNVERIFIED'));

const fmtSeries = (r) => {
  const v = Number(r.value);
  if (!Number.isFinite(v)) return e(r.value);
  if (r.unit === 'usd') return usd(v);
  if (r.unit === 'percent') return `${Number(v.toFixed(2)).toLocaleString()}%`;
  if (r.unit === 'requests_per_second') return `${(v / 1e6).toFixed(0)}M/s`;
  return v.toLocaleString();
};

const cryptoPage = cryptoRails.length ? `
<h1>Digital Assets</h1>
<p class="sub">${e(cryptoSection?.summary ?? '')}
<br><strong>Central question:</strong> ${e(cryptoSection?.central_question ?? '')}</p>

<div class="grid">
  <div class="card"><div class="n">0</div><div class="l">Names tracked</div></div>
  <div class="card"><div class="n">${e(cryptoRails.length)}</div><div class="l">Stack layers mapped</div></div>
  <div class="card"><div class="n">${e(seriesRows.length)}</div><div class="l">Weekly series</div></div>
  <div class="card"><div class="n">${e(claimRows.length)}</div><div class="l">Unverified claims</div></div>
</div>

<div class="note">
  <strong>Zero positions, and that is the current finding.</strong> This section was opened on the
  strength of one promotional thread reporting management statements from an earnings call that has
  not yet been read. Nothing here is screened, scored or recommended. The tracker starts now
  precisely because the argument for the section is a trend and we do not yet have one.
</div>

${seriesRows.length ? `<h2>The float · ${e(seriesWeek)}</h2>
<p class="sub">Stablecoin supply is the cleanest fact in this area: it grows only if somebody funds
it, so unlike announcements, TVL and token prices it cannot be talked up. Token prices are
deliberately not tracked as a thesis input.</p>
${table(['Series', '>Value', '>Prior week', '>Change', 'Note'],
  seriesRows
    .filter((r) => !r.data_quality?.startsWith('UNVERIFIED'))
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    .map((r) => `<tr>
      <td><strong>${e(r.label)}</strong></td>
      <td class="r" style="white-space:nowrap"><strong>${e(fmtSeries(r))}</strong></td>
      <td class="r" style="white-space:nowrap;color:var(--muted)">${
        r.value_prior_week ? e(fmtSeries({ ...r, value: r.value_prior_week })) : '—'}</td>
      <td class="r" style="color:${Number(r.change_pct) >= 0 ? '#2f6f54' : '#9a6b18'}">${
        r.change_pct ? `${Number(r.change_pct) >= 0 ? '+' : ''}${Number(r.change_pct).toFixed(2)}%` : '—'}</td>
      <td style="font-size:11px;color:var(--muted)">${e(r.note)}</td></tr>`))}` : ''}

<h2>The stack, and who might capture it</h2>
<p class="sub">Mapped so the section can be argued with. No name below has been screened; the
candidates column records who would be looked at, not who should be owned.</p>
${table(['Layer', 'What it is', 'Value capture', '>Confidence', 'Why it might not capture'],
  cryptoRails.sort((a, b) => Number(a.flow_order) - Number(b.flow_order)).map((l) => `<tr>
    <td><strong>${e(l.name)}</strong>
      ${l.listed_candidates_unscreened ? `<div style="color:var(--muted);font-size:10px;margin-top:3px">${e(l.listed_candidates_unscreened)}</div>` : ''}</td>
    <td style="font-size:12px">${e(l.what_it_is)}</td>
    <td style="font-size:12px">${e(l.value_capture)}</td>
    <td class="r"><span class="pill ${l.capture_confidence === 'high' ? 'cand' : 'warn'}">${e(l.capture_confidence)}</span></td>
    <td style="font-size:12px">${e(l.why_it_might_not_capture)}</td></tr>`))}

${claimRows.length ? `<h2>Claims recorded as unverified</h2>
<p class="sub">Second-hand reports of management statements from the Cloudflare Q2 2026 call, stored
as a dated baseline to check against rather than as evidence. Two of them are projections. Verifying
these against the transcript is the section's first research task.</p>
${table(['Claim', '>Reported value', 'Why it is held at arm\'s length'],
  claimRows.map((r) => `<tr>
    <td><strong>${e(r.label)}</strong></td>
    <td class="r" style="white-space:nowrap">${e(fmtSeries(r))}</td>
    <td style="font-size:12px">${e(r.note)}</td></tr>`))}` : ''}

<h2>Themes in this section</h2>
${table(['Theme', 'Status', 'Horizon', '>Confidence'],
  cryptoThemes.map((t) => `<tr>
    <td><strong>${e(t.name)}</strong>
      <div style="color:var(--muted);font-size:11px">${e(t.summary)}</div></td>
    <td><span class="pill ${t.status === 'active' ? 'cand' : 'warn'}">${e(t.status)}</span></td>
    <td style="font-size:12px">${e(t.time_horizon)}</td>
    <td class="r">${e(t.confidence)}</td></tr>`))}

<p class="sub" style="margin-top:20px">Section note: <code>research/sections/digital-assets.md</code>,
which sets out where the thread that opened this section does not survive checking. Stack taxonomy:
<code>data/crypto_rails.csv</code>. Weekly series: <code>data/agent_traffic.csv</code>.</p>
` : '<h1>Digital Assets</h1><p class="sub">No rail taxonomy recorded yet.</p>';

// --- Age of Electricity tracking page -----------------------------------------
// The theme with a growth table gets its own page, because the point of that table
// is comparison across the value chain and a generic theme listing cannot show it.
// Growth ranges are hypotheses with a stated basis, not measured figures — the
// evidence-basis and confidence columns are load-bearing and are never omitted.
const LAYER_LABELS = {
  'prime-movers': ['Prime movers', 'Generation equipment. The delivery slot is the scarce asset.'],
  'grid-equipment': ['Grid & electrical equipment', 'Transformers, switchgear, distribution. Severe shortage, but manufacturable.'],
  'thermal-white-space': ['Thermal & white space', 'Power and cooling inside the data hall. Content per megawatt is rising.'],
  'build-and-install': ['Build & install', 'Engineering and construction. The moat is trained labour, not capital.'],
  'merchant-generation': ['Merchant generation', 'Existing fleets re-contracted into a short market. Judge on price, not revenue.'],
  'regulated-rate-base': ['Regulated rate base', 'Allowed return on invested capital. No pricing power; the ceiling is political.'],
  'fuel-cycle': ['Fuel cycle', 'Long-dated demand implied by contracts signed today.'],
};

const ECONOMICS_NOTE = [
  ['Scarcity rent', 'Sold-out capacity converts into price and margin above trend. Decays as capacity is added — part of it is cyclical, not structural.'],
  ['Regulated return', 'Earns an allowed return on a growing rate base. Load growth justifies more capital; it does not raise price.'],
  ['Merchant price bet', 'The fleet already exists, so operating leverage runs through margin and cash flow per share. Directional both ways.'],
  ['Contracted commodity', 'Fuel and component demand implied by today’s contracts. Commodity pricing and execution risk remain.'],
];

const growth = await readTable('growth_estimates.csv');
const electricityTheme = themes.find((t) => t.theme_id === 'age-of-electricity');

// A range bar so twenty CAGR bands can be compared by eye. Scaled to the widest
// band on the page so the comparison is honest rather than per-row flattering.
const growthScaleMax = Math.max(20, ...growth.map((g) => Number(g.revenue_cagr_high) || 0));
const rangeBar = (low, high) => {
  const lo = Number(low) || 0;
  const hi = Number(high) || 0;
  const left = (lo / growthScaleMax) * 100;
  const width = Math.max(((hi - lo) / growthScaleMax) * 100, 1.5);
  return `<div class="rb"><div class="rb-fill" style="margin-left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></div></div>`;
};

const confPill = (c) => `<span class="pill ${c === 'medium' ? 'cand' : 'warn'}">${e(c)}</span>`;

// A growth rate is not a return, so the growth table carries a price beside every
// rate. The comparison week is the last week the store actually scored anything —
// the point is whether the market has moved since the underwriting, not since an
// arbitrary date.
const priorMetricWeek = [...new Set(metrics.map((m) => m.week_id))].sort().at(-2);
const priorPriceOf = new Map(
  metrics.filter((m) => m.week_id === priorMetricWeek).map((m) => [m.asset_id, Number(m.price)]),
);

const priceCell = (assetId) => {
  const now = Number(metricOf.get(assetId)?.price);
  if (!Number.isFinite(now) || !now) return '<td class="r">—</td>';
  const then = priorPriceOf.get(assetId);
  const change = Number.isFinite(then) && then
    ? ((now / then - 1) * 100)
    : undefined;
  const tone = change === undefined ? 'var(--muted)' : (change >= 0 ? '#2f6f54' : '#9a6b18');
  return `<td class="r" style="white-space:nowrap">${now.toFixed(2)}
    ${change === undefined ? '' : `<div style="color:${tone};font-size:10px">${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}% vs ${e(priorMetricWeek ?? '')}</div>`}</td>`;
};

const electricityPage = growth.length ? `
<p class="sub" style="margin-bottom:4px"><a href="ai.html">Artificial Intelligence</a> ›
The Age of Electricity</p>
<h1>The Age of Electricity</h1>
<p class="sub"><strong>A layer of the AI value chain, not a peer of it.</strong> Nineteen of the names
below sit in the energy-spending flow that the profit-pool benchmark on the
<a href="ai.html">AI section page</a> draws as spending leaving the frame with no profit box. Read
this page against that one.<br>
${e(electricityTheme?.summary ?? '')}
${electricityTheme ? `<br><span class="pill cand">${e(electricityTheme.status)}</span> ${e(electricityTheme.time_horizon)} · ${e(electricityTheme.confidence)} confidence · updated ${e(electricityTheme.last_updated_date)}` : ''}</p>

<div class="grid">
  <div class="card"><div class="n">${growth.length}</div><div class="l">Names tracked</div></div>
  <div class="card"><div class="n">${Object.keys(LAYER_LABELS).filter((k) => growth.some((g) => g.chain_layer === k)).length}</div><div class="l">Chain layers</div></div>
  <div class="card"><div class="n">${growth.filter((g) => g.evidence_basis === 'primary_filing').length}</div><div class="l">On primary filings</div></div>
  <div class="card"><div class="n">${growth.filter((g) => g.evidence_basis === 'screen_inference').length}</div><div class="l">Unverified</div></div>
</div>

<div class="note">
  <strong>Read the growth ranges as hypotheses.</strong> They are reasoned long-run judgements with a
  stated basis, not measured figures. ${growth.filter((g) => g.evidence_basis === 'screen_inference').length}
  of ${growth.length} rest on screen inference and have not been checked against a primary filing.
  A growth rate is not a return: no price is applied here, and the two names with the deepest
  evidence both scored 1/10 on valuation asymmetry at the last scoring week.
</div>

<h2>The four economic models in one theme</h2>
<p class="sub">Conflating these is the main way to hold this theme and still lose money.</p>
${table(['Model', 'How value is created and what limits it'],
  ECONOMICS_NOTE.map(([name, note]) => `<tr><td style="white-space:nowrap"><strong>${e(name)}</strong></td><td>${e(note)}</td></tr>`))}

${Object.entries(LAYER_LABELS).map(([layer, [label, blurb]]) => {
  const members = growth.filter((g) => g.chain_layer === layer);
  if (!members.length) return '';
  return `<h2>${e(label)}</h2>
  <p class="sub">${e(blurb)}</p>
  ${table(['Name', 'Long-run revenue CAGR', '>Range', 'Economics', '>Pricing power', '>Market cap', '>Price', '>Evidence', '>Confidence'],
    members.map((g) => `<tr>
      <td><strong>${e(g.symbol)}</strong><div style="color:var(--muted);font-size:11px">${e(nameOf.get(g.asset_id) ?? g.asset_id)}</div></td>
      <td style="white-space:nowrap"><strong>${e(g.revenue_cagr_low)}–${e(g.revenue_cagr_high)}%</strong>
        <div style="color:var(--muted);font-size:10px">over ${e(g.horizon_years)} years</div></td>
      <td>${rangeBar(g.revenue_cagr_low, g.revenue_cagr_high)}</td>
      <td style="font-size:11px">${e(g.economics_type.replace(/-/g, ' '))}</td>
      <td class="r" style="font-size:11px">${e(g.pricing_power.replace(/-/g, ' '))}</td>
      <td class="r" style="white-space:nowrap">${e(usd(metricOf.get(g.asset_id)?.market_cap))}</td>
      ${priceCell(g.asset_id)}
      <td class="r" style="font-size:10px;color:var(--muted)">${e(g.evidence_basis.replace(/_/g, ' '))}</td>
      <td class="r">${confPill(g.confidence)}</td></tr>`))}
  ${members.map((g) => `<details class="detail"><summary>${e(g.symbol)} — basis, uncertainty and falsifier</summary>
    <p><strong>Position in the chain.</strong> ${e(g.role_in_chain)}</p>
    <p><strong>Growth basis.</strong> ${e(g.growth_basis)}</p>
    <p><strong>Current anchor.</strong> ${e(g.current_growth_anchor)}</p>
    <p><strong>Key uncertainty.</strong> ${e(g.key_uncertainty)}</p>
    <p><strong>What would falsify the rate.</strong> ${e(g.falsifier)}</p>
    <p><strong>Next checkpoint.</strong> ${e(g.next_checkpoint)}</p>
  </details>`).join('')}`;
}).join('')}

<h2>Theme evidence</h2>
<p class="sub">Every claim behind this page, including the rows that cut against it.</p>
${table(['Published', 'Stance', 'Claim', '>Reliability', ''],
  sources.filter((s) => s.theme_id === 'age-of-electricity')
    .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
    .map((s) => `<tr>
      <td style="white-space:nowrap">${e(s.published_at)}</td>
      <td><span class="pill ${s.stance === 'contradicts' ? 'warn' : ''}">${e(s.stance)}</span></td>
      <td style="font-size:12px">${e(s.claim)}</td>
      <td class="r" style="font-size:11px">${e(s.reliability)}${s.is_primary === 'true' ? ' · primary' : ''}</td>
      <td class="r">${s.url ? `<a href="${e(s.url)}" rel="noopener">open</a>` : ''}</td></tr>`))}

<p class="sub" style="margin-top:20px">Full thesis, bear case and falsification criteria:
<code>research/themes/age-of-electricity.md</code>. Growth table source: <code>data/growth_estimates.csv</code>.</p>
` : '<h1>The Age of Electricity</h1><p class="sub">No growth estimates recorded yet.</p>';

// --- gates --------------------------------------------------------------------
const gateNames = [...new Map(gates.map((g) => [g.gate_id, g])).values()]
  .sort((a, b) => Number(a.gate_number) - Number(b.gate_number));
const gatesPage = `
<h1>Decision gates</h1>
<p class="sub">All ${gateTotal} must be documented before a candidate can reach decision review.
Gates apply to candidates only; ${universe.length} assets are tracked at coverage tier.</p>
${gates.length ? table(['Gate', ...candidates.map((c) => `>${c.symbol}`)],
  gateNames.map((g) => `<tr><td>${e(g.gate_number)}. ${e(g.gate_name)}</td>${
    candidates.map((c) => {
      const row = gates.find((x) => x.asset_id === c.asset_id && x.gate_id === g.gate_id);
      const s = row?.status ?? 'not_assessed';
      return `<td class="r" style="color:${s === 'documented' ? '#2f6f54' : 'var(--muted)'}">${e(s.replace('_', ' '))}</td>`;
    }).join('')}</tr>`))
  : '<p>No ledger yet. Run <code>npm run gates:init</code>.</p>'}
`;

// --- evidence -----------------------------------------------------------------
const byType = {};
for (const s of sources) byType[s.source_type] = (byType[s.source_type] ?? 0) + 1;
const evidencePage = `
<h1>Evidence</h1>
<p class="sub">${sources.length} source rows. Primary sources are filings and official datasets;
web-sourced leads are recorded as leads, not proof.</p>
<div class="grid">${Object.entries(byType).sort((a, b) => b[1] - a[1])
  .map(([type, n]) => `<div class="card"><div class="n">${n}</div><div class="l">${e(type.replace(/_/g, ' '))}</div></div>`).join('')}</div>
<h2>All evidence, newest first</h2>
${table(['Published', 'Asset', 'Type', 'Claim', ''],
  [...sources].sort((a, b) => (a.published_at < b.published_at ? 1 : -1)).slice(0, 200).map((s) => `<tr>
    <td>${e(s.published_at)}</td>
    <td>${e(symbolOf.get(s.asset_id) ?? '—')}</td>
    <td style="color:var(--muted)">${e(s.source_type)}</td>
    <td>${e(s.claim).slice(0, 160)}</td>
    <td class="r">${s.url ? `<a href="${e(s.url)}" rel="noopener">open</a>` : ''}</td></tr>`))}
${sources.length > 200 ? `<p class="sub">Showing the 200 most recent of ${sources.length}.</p>` : ''}
`;

// --- archive ------------------------------------------------------------------
const archivePage = `
<h1>Archive</h1>
<p class="sub">Every published issue. Unapproved issues are drafts awaiting review.</p>
${table(['Week', 'Issue', 'Edition', 'Posture', '>Status', ''], issues.map((i) => `<tr>
  <td><strong>${e(i.week_id)}</strong></td>
  <td>${e(i.issue)}</td>
  <td>${e(i.edition)}</td>
  <td style="font-size:11px">${e(i.action_posture)}</td>
  <td class="r"><span class="pill ${i.approved_for_send ? 'cand' : 'warn'}">${i.approved_for_send ? 'approved' : 'draft'}</span></td>
  <td class="r"><a href="issues/${e(i.dir)}.html">read</a></td></tr>`))}
`;

// --- coverage -----------------------------------------------------------------
// The week-on-week record: what each issue actually covered, and what is waiting.
// The ledger is written by build-issue.mjs; this page only reads it, so the site
// cannot claim coverage that no issue delivered.
const coverage = await readTable('coverage.csv');
const coveredWeeks = [...new Set(coverage.map((c) => c.week_id))].sort();
const recentWeeks = coveredWeeks.slice(-12);

const evidenceCount = reviewedEvidence(sources);

// What the next issue would pick if it ran now. Same function the issue builder
// calls, so the queue shown here is the queue that will actually be used.
const nextWeek = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - yearStart) / 86_400_000 + 1) / 7)).padStart(2, '0')}`;
})();
const nextPlan = selectCoverage({ assets, scores, coverage, weekId: nextWeek, evidenceCount });

const slotPill = { core: 'cand', rotation: '', entered: 'warn', dropped: 'warn' };
const slotMark = { core: '●', rotation: '◆', entered: '+', dropped: '×' };

// One row per asset, one column per recent week. This is the artefact that answers
// "are we over-focusing?" at a glance: a row of solid dots across every week is a
// name the issue cannot stop talking about.
const gridAssets = [...new Set(coverage.map((c) => c.asset_id))]
  .map((id) => assets.find((a) => a.asset_id === id) ?? { asset_id: id, symbol: id.toUpperCase() })
  .sort((a, b) => (tierOf(a)).localeCompare(tierOf(b)) || (a.symbol ?? '').localeCompare(b.symbol ?? ''));

const slotAt = (assetId, week) => coverage
  .filter((c) => c.asset_id === assetId && c.week_id === week)
  .map((c) => c.slot);

const appearances = (assetId) => coverage
  .filter((c) => c.asset_id === assetId && (c.slot === 'core' || c.slot === 'rotation')).length;

const coveragePage = `
<h1>Coverage</h1>
<p class="sub">What each issue covered, week by week. The candidate tier is standing coverage;
the ${nextPlan.queueDepth} names at coverage tier rotate, longest-waiting first, so no name is
permanently in the issue and none is permanently out.</p>

<div class="grid">
  <div class="card"><div class="n">${coveredWeeks.length}</div><div class="l">Weeks recorded</div></div>
  <div class="card"><div class="n">${gridAssets.length}</div><div class="l">Assets that have appeared</div></div>
  <div class="card"><div class="n">${nextPlan.queueDepth}</div><div class="l">In the rotation queue</div></div>
  <div class="card"><div class="n">${nextPlan.cycleWeeks}w</div><div class="l">Full universe cycle</div></div>
</div>

<h2>Up next · ${e(nextWeek)}</h2>
<p class="sub">What the next issue will pick if it runs now. Selection is deterministic,
so this is a prediction the builder is bound to.</p>
${table(['Symbol', 'Name', 'Waiting since', '>Evidence'], nextPlan.rotation.map((r) => `<tr>
  <td><strong>${e(r.symbol)}</strong></td>
  <td>${e(r.name)}</td>
  <td style="color:var(--muted)">${e(describeGap(r))}</td>
  <td class="r">${evidenceCount[r.assetId] ?? 0}</td></tr>`))}
${nextPlan.upNext.length ? `<p class="sub" style="margin-top:10px">Then: ${nextPlan.upNext.map((u) => e(u.symbol)).join(' · ')}</p>` : ''}

<h2>Week by week</h2>
<p class="sub">${slotMark.core} standing coverage · ${slotMark.rotation} rotation write-up ·
${slotMark.entered} entered the store · ${slotMark.dropped} dropped.
Showing the ${recentWeeks.length} most recent weeks.</p>
${coveredWeeks.length ? table(
  ['Symbol', 'Tier', ...recentWeeks.map((w) => `>${w.replace('2026-', '')}`), '>Write-ups'],
  gridAssets.map((a) => `<tr>
    <td><strong>${e(a.symbol)}</strong></td>
    <td><span class="pill ${tierOf(a) === 'candidate' ? 'cand' : ''}">${e(tierOf(a))}</span></td>
    ${recentWeeks.map((w) => {
    const slots = slotAt(a.asset_id, w);
    if (!slots.length) return '<td class="r" style="color:var(--line)">·</td>';
    return `<td class="r" title="${e(slots.join(', '))}">${slots.map((s) => slotMark[s] ?? '?').join('')}</td>`;
  }).join('')}
    <td class="r"><strong>${appearances(a.asset_id)}</strong></td></tr>`),
) : '<p>No ledger yet. It is written by <code>npm run issue:build</code>.</p>'}

<h2>Coverage log</h2>
<p class="sub">Every ledger row, newest first. This is the record the rotation reads from.</p>
${table(['Week', 'Symbol', 'Slot', '>Score', 'Note'],
  [...coverage].reverse().slice(0, 150).map((c) => `<tr>
    <td>${e(c.week_id)}</td>
    <td><strong>${e(symbolOf.get(c.asset_id) ?? c.asset_id)}</strong></td>
    <td><span class="pill ${slotPill[c.slot] ?? ''}">${e(c.slot)}</span></td>
    <td class="r">${e(c.score || '—')}</td>
    <td style="color:var(--muted);font-size:12px">${e(c.note)}</td></tr>`))}
${coverage.length > 150 ? `<p class="sub">Showing the 150 most recent of ${coverage.length}.</p>` : ''}
`;

// --- write --------------------------------------------------------------------
await mkdir(path.join(outDir, 'issues'), { recursive: true });
await Promise.all([
  writeFile(path.join(outDir, 'index.html'), page('index.html', 'Dashboard', dashboard), 'utf8'),
  writeFile(path.join(outDir, 'coverage.html'), page('coverage.html', 'Coverage', coveragePage), 'utf8'),
  writeFile(path.join(outDir, 'universe.html'), page('universe.html', 'Universe', universePage), 'utf8'),
  writeFile(path.join(outDir, 'themes.html'), page('themes.html', 'Themes', themesPage), 'utf8'),
  writeFile(path.join(outDir, 'ai.html'), page('ai.html', 'Artificial Intelligence', aiPage), 'utf8'),
  writeFile(path.join(outDir, 'electricity.html'), page('electricity.html', 'The Age of Electricity', electricityPage), 'utf8'),
  writeFile(path.join(outDir, 'crypto.html'), page('crypto.html', 'Digital Assets', cryptoPage), 'utf8'),
  writeFile(path.join(outDir, 'gates.html'), page('gates.html', 'Gates', gatesPage), 'utf8'),
  writeFile(path.join(outDir, 'evidence.html'), page('evidence.html', 'Evidence', evidencePage), 'utf8'),
  writeFile(path.join(outDir, 'archive.html'), page('archive.html', 'Archive', archivePage), 'utf8'),
]);

// Search engines are asked to stay out at the file level too, not only via
// headers. This is a request, not access control: anyone with the URL can still
// read everything. Real privacy is deployment protection or not deploying.
await writeFile(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');

// Issue pages are the archival HTML already produced by the issue builder, copied
// rather than regenerated so the site cannot disagree with the published record.
for (const i of issues) {
  await copyFile(
    path.join(reportsRoot, i.year, i.dir, 'report.html'),
    path.join(outDir, 'issues', `${i.dir}.html`),
  ).catch(() => {});
}

console.log(`Built site/ — ${NAV.length} pages, ${issues.length} issues`);
console.log(`  ${assets.length} assets, ${themes.length} themes, ${sources.length} sources`);
console.log('  Local only. Nothing is deployed; publishing research is a deliberate decision.');
