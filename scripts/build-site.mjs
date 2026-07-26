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

const [assets, themes, links, scores, metrics, macro, gates, sources] = await Promise.all([
  readTable('assets.csv'), readTable('themes.csv'), readTable('asset_themes.csv'),
  readTable('scores.csv'), readTable('weekly_metrics.csv'), readTable('macro.csv'),
  readTable('gates.csv'), readTable('sources.csv'),
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
const NAV = [
  ['index.html', 'Dashboard'], ['universe.html', 'Universe'], ['themes.html', 'Themes'],
  ['gates.html', 'Gates'], ['evidence.html', 'Evidence'], ['archive.html', 'Archive'],
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
const fmtMacro = (r) => (r.unit === 'thousands_change'
  ? `${Number(r.value) >= 0 ? '+' : ''}${r.value}k`
  : `${r.value}%`);

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

${macroRows.length ? `<h2>Regime board · ${e(macroWeek)}</h2>${table(
  ['Series', '>Value', '>Observation'],
  macroRows.map((r) => `<tr><td>${e(r.label)}</td><td class="r"><strong>${e(fmtMacro(r))}</strong></td><td class="r">${e(r.observation_date)}</td></tr>`),
)}` : ''}

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
const themesPage = `
<h1>Themes</h1>
<p class="sub">Structural changes being tracked, and the assets that express them.</p>
${themes.map((t) => {
  const members = links.filter((l) => l.theme_id === t.theme_id);
  return `<h2>${e(t.name)}</h2>
  <p class="sub"><span class="pill ${t.status === 'active' ? 'cand' : 'warn'}">${e(t.status)}</span>
  &nbsp;${e(t.time_horizon)} · ${e(t.confidence)} confidence</p>
  <p style="margin:-12px 0 14px">${e(t.summary)}</p>
  ${table(['Symbol', 'Name', 'Role', '>Relevance'], members.map((m) => `<tr>
    <td><strong>${e(symbolOf.get(m.asset_id) ?? m.asset_id)}</strong></td>
    <td>${e(nameOf.get(m.asset_id))}</td>
    <td>${e(m.role)}</td>
    <td class="r">${e(m.relevance)}</td></tr>`))}`;
}).join('')}
`;

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

// --- write --------------------------------------------------------------------
await mkdir(path.join(outDir, 'issues'), { recursive: true });
await Promise.all([
  writeFile(path.join(outDir, 'index.html'), page('index.html', 'Dashboard', dashboard), 'utf8'),
  writeFile(path.join(outDir, 'universe.html'), page('universe.html', 'Universe', universePage), 'utf8'),
  writeFile(path.join(outDir, 'themes.html'), page('themes.html', 'Themes', themesPage), 'utf8'),
  writeFile(path.join(outDir, 'gates.html'), page('gates.html', 'Gates', gatesPage), 'utf8'),
  writeFile(path.join(outDir, 'evidence.html'), page('evidence.html', 'Evidence', evidencePage), 'utf8'),
  writeFile(path.join(outDir, 'archive.html'), page('archive.html', 'Archive', archivePage), 'utf8'),
]);

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
