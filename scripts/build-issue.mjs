// Builds a publishable issue for any week from the reviewed draft plus the CSV store.
//
// Unlike build-baseline.mjs — which is a hand-authored document for Issue 001 and
// is deliberately left alone, since it produced a permanent archive — this script
// is content-agnostic: the narrative comes from drafts/<week_id>.md and the
// conviction board is read from data/*.csv.
//
// New issues are written with approved_for_send: false. Sending stays a human
// decision: review the output, set the flag, then run send-report.mjs.
//
// Usage:
//   node scripts/build-issue.mjs --week 2026-W30 --issue 002 --edition "Quiet Week"
//
// Optional:
//   --root <path>      project root (default: cwd)
//   --posture "TEXT"   action posture; inferred from the draft when it says "no action"
//   --cutoff <iso>     evidence cut-off timestamp (default: now)

import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

const root = path.resolve(flag('root') ?? process.cwd());
const edition = flag('edition') ?? 'Weekly Overview';

// ISO-8601 week, matching the week_id format used across data/ and reports/.
const isoWeekId = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

// Issue numbers are derived from the archive rather than tracked in a state file,
// so a scheduled run needs no arguments and cannot drift out of sync. Rebuilding a
// week that already has an issue reuses its number, so reruns stay idempotent.
const resolveIssueNumber = async (week) => {
  const reportsDir = path.join(root, 'reports');
  let highest = 0;
  let years = [];
  try {
    years = await readdir(reportsDir);
  } catch {
    return '001';
  }
  for (const year of years) {
    let entries = [];
    try {
      entries = await readdir(path.join(reportsDir, year));
    } catch { continue; }
    for (const entry of entries) {
      const match = /^(\d{4}-W\d{2})-issue-(\d+)$/.exec(entry);
      if (!match) continue;
      if (match[1] === week) return match[2];
      highest = Math.max(highest, Number(match[2]));
    }
  }
  return String(highest + 1).padStart(3, '0');
};

const weekId = flag('week') ?? isoWeekId(new Date());
const issue = flag('issue') ?? (await resolveIssueNumber(weekId));

if (!/^\d{4}-W\d{2}$/.test(weekId)) {
  console.error(`--week must look like 2026-W30, got "${weekId}".`);
  process.exit(1);
}

const year = weekId.slice(0, 4);
const reportId = `${weekId}-${issue}`;
const reportDir = path.join(root, 'reports', year, `${weekId}-issue-${issue}`);

// --- CSV ---------------------------------------------------------------------
// Minimal RFC 4180 reader: the store quotes any field containing a comma or
// newline and escapes embedded quotes by doubling them.
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
  const rows = parseCsv(await readFile(path.join(root, 'data', name), 'utf8'));
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ''])));
};

const [assets, scores, metrics] = await Promise.all([
  readTable('assets.csv'),
  readTable('scores.csv'),
  readTable('weekly_metrics.csv'),
]);

// macro.csv only exists once ingestion has run, so treat it as optional.
const macro = await readTable('macro.csv').catch(() => []);
const macroWeeks = [...new Set(macro.map((r) => r.week_id))].sort();
const macroWeek = macroWeeks.at(-1);
const macroRows = macro.filter((r) => r.week_id === macroWeek);

const formatMacro = (row) => {
  if (row.unit === 'percent' || row.unit === 'percent_yoy') return `${row.value}%`;
  if (row.unit === 'thousands_change') {
    const n = Number(row.value);
    return `${n >= 0 ? '+' : ''}${n}k`;
  }
  return row.value;
};

// The store may not have rows for this week yet — a quiet week is legitimate, so
// fall back to the most recent week present rather than publishing an empty board.
const weeksPresent = [...new Set(scores.map((r) => r.week_id))].sort();
const boardWeek = weeksPresent.includes(weekId) ? weekId : weeksPresent.at(-1);
const boardIsStale = boardWeek !== weekId;

const byAsset = new Map(assets.map((a) => [a.asset_id, a]));
const metricFor = new Map(metrics.filter((m) => m.week_id === boardWeek).map((m) => [m.asset_id, m]));

const board = scores
  .filter((s) => s.week_id === boardWeek)
  .map((s) => ({
    symbol: byAsset.get(s.asset_id)?.symbol ?? s.asset_id.toUpperCase(),
    name: byAsset.get(s.asset_id)?.name ?? s.asset_id,
    stage: byAsset.get(s.asset_id)?.stage ?? '',
    total: Number(s.total_score),
    asymmetry: s.valuation_asymmetry,
    confidence: s.thesis_confidence,
    uncertainty: s.most_important_uncertainty,
    checkpoint: s.next_checkpoint,
    marketCap: metricFor.get(s.asset_id)?.market_cap ?? '',
  }))
  .sort((a, b) => b.total - a.total);

const usd = (raw) => {
  const n = Number(raw);
  if (!raw || Number.isNaN(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
};

// --- draft -------------------------------------------------------------------
const draftPath = path.join(root, 'drafts', `${weekId}.md`);
let draft;
try {
  draft = (await readFile(draftPath, 'utf8')).trim();
} catch {
  console.error(`No draft found at drafts/${weekId}.md — run "npm run draft:issue" first.`);
  process.exit(1);
}

// Pull the Action posture section so the header pill matches the narrative
// instead of being asserted separately and drifting out of sync.
const postureSection = draft.split(/^##\s+Action posture\s*$/im)[1] ?? '';
let posture = flag('posture');
if (!posture) {
  if (/no action/i.test(postureSection)) posture = 'NO ACTION — RESEARCH CONTINUES';
  else {
    console.error('Could not infer the action posture from the draft. Pass --posture "TEXT".');
    process.exit(1);
  }
}

// --- markdown ----------------------------------------------------------------
const e = (v) => String(v)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const inline = (text) => e(text)
  .replace(/`([^`]+)`/g, '<code style="background:#ece8de;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2e5f8f;">$1</a>');

const renderMarkdown = (markdown) => {
  const out = [];
  const lines = markdown.split('\n');
  let i = 0;
  const isTableRow = (line) => line.trim().startsWith('|') && line.trim().endsWith('|');
  const cells = (line) => line.trim().slice(1, -1).split('|').map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i += 1; continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const size = [30, 24, 18, 15][level - 1];
      const family = level <= 2 ? "Georgia,'Times New Roman',serif" : 'inherit';
      out.push(
        `<h${level} style="margin:26px 0 10px;color:#13263d;font-family:${family};font-size:${size}px;line-height:1.3;font-weight:${level <= 2 ? 500 : 700};">${inline(heading[2])}</h${level}>`,
      );
      i += 1;
      continue;
    }

    if (isTableRow(line) && isTableRow(lines[i + 1] ?? '') && /^[\s|:-]+$/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && isTableRow(lines[i])) { body.push(cells(lines[i])); i += 1; }
      out.push(
        `<table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:10px;margin:16px 0;">` +
        `<tr>${head.map((c) => `<td style="padding:9px 11px;background:#eeeae0;color:#527095;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${inline(c)}</td>`).join('')}</tr>` +
        body.map((r) => `<tr>${r.map((c) => `<td style="padding:9px 11px;border-top:1px solid #e5e1d8;color:#263849;font-size:12px;">${inline(c)}</td>`).join('')}</tr>`).join('') +
        `</table>`,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      out.push(`<ul style="margin:12px 0;padding-left:20px;color:#354252;font-size:14px;line-height:24px;">${items.map((t) => `<li style="margin-bottom:7px;">${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      out.push(`<ol style="margin:12px 0;padding-left:20px;color:#354252;font-size:14px;line-height:24px;">${items.map((t) => `<li style="margin-bottom:7px;">${inline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) && !isTableRow(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    out.push(`<p style="margin:0 0 14px;color:#354252;font-size:14px;line-height:24px;">${inline(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
};

const plain = (markdown) => markdown
  .replace(/^\|.*\|$/gm, (row) => row.slice(1, -1).split('|').map((c) => c.trim()).join(' · '))
  .replace(/^[\s|:-]+$/gm, '')
  .replace(/^#{1,4}\s+/gm, '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// --- documents ---------------------------------------------------------------
const cutoff = flag('cutoff') ?? new Date().toISOString();
const subject = `Investo Master — Issue ${issue}: ${edition}`;
const safety =
  'Research and decision support only. No trades, promised returns, or personalised financial, tax or legal advice. The human investor retains responsibility for every decision.';

const pill = (text, bg = '#e7ede8', color = '#26533a') =>
  `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${bg};color:${color};font-size:10px;line-height:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${e(text)}</span>`;

const boardRows = board.map((c) => `
  <tr>
    <td style="padding:11px;border-top:1px solid #e5e1d8;color:#13263d;font-size:13px;font-weight:800;">${e(c.symbol)}<div style="color:#7b8792;font-size:10px;font-weight:400;">${e(c.name)}</div></td>
    <td style="padding:11px;border-top:1px solid #e5e1d8;">${pill(c.stage, c.stage === 'watchlist' ? '#e8eef5' : '#f5ead2', c.stage === 'watchlist' ? '#355d82' : '#6a4a0e')}</td>
    <td align="right" style="padding:11px;border-top:1px solid #e5e1d8;color:${c.total >= 75 ? '#2f6f54' : '#9a6b18'};font-size:16px;font-weight:800;">${c.total}</td>
    <td align="right" style="padding:11px;border-top:1px solid #e5e1d8;color:#263849;font-size:12px;">${e(c.asymmetry)}/10</td>
    <td align="right" style="padding:11px;border-top:1px solid #e5e1d8;color:#52606d;font-size:12px;">${e(c.confidence)}</td>
    <td align="right" style="padding:11px;border-top:1px solid #e5e1d8;color:#263849;font-size:12px;">${e(usd(c.marketCap))}</td>
  </tr>`).join('');

const staleNote = boardIsStale
  ? `<p style="margin:0 0 14px;color:#8a5b1c;font-size:12px;line-height:20px;background:#f5ead2;border-left:4px solid #ad7a25;padding:11px 13px;border-radius:0 8px 8px 0;">The store holds no scored rows for ${e(weekId)}. The board below is carried forward from ${e(boardWeek)} and is unchanged.</p>`
  : '';

const body = `
<div style="background:#13263d;padding:38px 34px 34px;border-radius:18px 18px 0 0;">
  <div style="color:#8fc3ff;font-size:11px;font-weight:800;letter-spacing:.17em;text-transform:uppercase;margin-bottom:18px;">Investo Master · Weekly Overview</div>
  <h1 style="margin:0 0 12px;color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:41px;font-weight:500;">Issue ${e(issue)}: ${e(edition)}</h1>
  <p style="margin:0;color:#c9d3df;font-size:13px;line-height:22px;">Week ${e(weekId)} · Evidence cut-off ${e(cutoff)}</p>
</div>
<div style="padding:32px 34px;background:#f7f4ec;">
  <div style="margin-bottom:18px;">${pill(posture)}</div>
  ${staleNote}
  ${macroRows.length ? `
  <div style="color:#527095;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin-bottom:11px;">Regime board · ${e(macroWeek)}</div>
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:12px;overflow:hidden;margin-bottom:26px;">
    ${macroRows.map((r, i) => `<tr>
      <td style="padding:11px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#52606d;font-size:11px;">${e(r.label)}</td>
      <td align="right" style="padding:11px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#13263d;font-size:13px;font-weight:800;">${e(formatMacro(r))}</td>
      <td align="right" style="padding:11px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#7b8792;font-size:10px;">${e(r.observation_date)}</td>
    </tr>`).join('')}
  </table>` : ''}
  <div style="color:#527095;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin-bottom:11px;">Conviction board · ${e(boardWeek)}</div>
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:12px;overflow:hidden;margin-bottom:6px;">
    <tr>${['Candidate', 'Stage', 'Score', 'Asym.', 'Confidence', 'Market cap'].map((h, i) => `<td ${i > 1 ? 'align="right"' : ''} style="padding:9px 11px;background:#eeeae0;color:#527095;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${e(h)}</td>`).join('')}</tr>
    ${boardRows}
  </table>
  <p style="margin:0 0 8px;color:#7b8792;font-size:10px;line-height:17px;">Scores prioritise research. They cannot override valuation, incomplete evidence or a fatal flaw.</p>
  <div style="height:1px;background:#d9d7cf;margin:30px 0;"></div>
  ${renderMarkdown(draft)}
</div>
<div style="padding:24px 34px 30px;background:#ede9df;border-radius:0 0 18px 18px;">
  <p style="margin:0 0 7px;color:#687382;font-size:11px;line-height:18px;">${e(safety)}</p>
  <p style="margin:0;color:#7a8490;font-size:10px;line-height:17px;">Report ID: ${e(reportId)} · Full claim registry: data/sources.csv</p>
</div>`;

const doc = (archive) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(subject)}</title><style>body{margin:0;background:#e7e5df;-webkit-font-smoothing:antialiased}table{border-collapse:collapse}code{font-family:ui-monospace,Menlo,monospace}@media(max-width:680px){.shell{width:100%!important}.outer{padding:0!important}}</style></head><body><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e7e5df;"><tr><td class="outer" align="center" style="padding:${archive ? '42px 16px' : '24px 12px'};"><table class="shell" role="presentation" width="660" cellspacing="0" cellpadding="0" border="0" style="width:660px;max-width:100%;"><tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${body}</td></tr></table></td></tr></table></body></html>`;

const boardText = board
  .map((c) => `- ${c.symbol} — ${c.stage} — score ${c.total} — asymmetry ${c.asymmetry}/10 — ${c.confidence} confidence — ${usd(c.marketCap)}`)
  .join('\n');

const text = [
  `INVESTO MASTER — ISSUE ${issue}: ${edition}`,
  `Week ${weekId} | Evidence cut-off ${cutoff}`,
  `Action: ${posture}`,
  '',
  boardIsStale ? `NOTE: no scored rows for ${weekId}; board carried forward from ${boardWeek}.\n` : '',
  ...(macroRows.length
    ? [`REGIME BOARD (${macroWeek})`, ...macroRows.map((r) => `- ${r.label}: ${formatMacro(r)} (${r.observation_date})`), '']
    : []),
  `CONVICTION BOARD (${boardWeek})`,
  boardText,
  '',
  plain(draft),
  '',
  'SAFETY BOUNDARY',
  safety,
  '',
  `Report ID: ${reportId}`,
].join('\n');

const markdown = [
  `# ${subject}`,
  '',
  `- Week: ${weekId}`,
  `- Report ID: ${reportId}`,
  `- Evidence cut-off: ${cutoff}`,
  `- Action posture: ${posture}`,
  '',
  ...(macroRows.length
    ? [
      `## Regime board (${macroWeek})`, '',
      '| Series | Value | Observation |', '|---|---|---|',
      ...macroRows.map((r) => `| ${r.label} | ${formatMacro(r)} | ${r.observation_date} |`),
      '',
    ]
    : []),
  `## Conviction board (${boardWeek})`,
  '',
  '| Candidate | Stage | Score | Valuation asymmetry | Thesis confidence | Market cap |',
  '|---|---|---|---|---|---|',
  ...board.map((c) => `| ${c.symbol} — ${c.name} | ${c.stage} | ${c.total} | ${c.asymmetry}/10 | ${c.confidence} | ${usd(c.marketCap)} |`),
  '',
  '---',
  '',
  draft,
  '',
  '## Safety boundary',
  '',
  safety,
].join('\n');

const meta = {
  report_id: reportId,
  issue,
  edition,
  week_id: weekId,
  data_cutoff: cutoff,
  board_week: boardWeek,
  subject,
  action_posture: posture,
  approved_for_send: false,
  approval_note: 'Not yet reviewed. Set approved_for_send to true only after reading the issue.',
  from: 'Investo Master <onboarding@resend.dev>',
  narrative_source: `drafts/${weekId}.md`,
};

await mkdir(reportDir, { recursive: true });
await Promise.all([
  writeFile(path.join(reportDir, 'report.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8'),
  writeFile(path.join(reportDir, 'report.md'), `${markdown}\n`, 'utf8'),
  writeFile(path.join(reportDir, 'report.html'), doc(true), 'utf8'),
  writeFile(path.join(reportDir, 'email.html'), doc(false), 'utf8'),
  writeFile(path.join(reportDir, 'email.txt'), `${text}\n`, 'utf8'),
]);

const relative = path.relative(root, reportDir);

// Hand the path to the next workflow step rather than making it recompute it.
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `issue_dir=${relative}\nreport_id=${reportId}\n`, 'utf8');
}

console.log(`Built ${reportId} in ${relative}`);
console.log(`  board: ${board.length} candidates from ${boardWeek}${boardIsStale ? ' (carried forward)' : ''}`);
console.log(`  email.html: ${(Buffer.byteLength(doc(false), 'utf8') / 1024).toFixed(1)} KB`);
console.log('  approved_for_send: false — review, then set it true before sending.');
