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
//   --rotation <n>     universe names given a full write-up this week (default: 3)
//   --site-url <url>   public site root, so the email can link to the depth pages
//                      (also read from SITE_URL)
//
// The email is a digest and the site carries the depth. Gmail clips a message at
// roughly 102KB and Issue 003 reached 91KB, so a single document that grows every
// week was already days away from being truncated mid-issue. The archive HTML keeps
// everything; the email keeps the narrative and the week's rotation.

import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { columnChart, formatValue, rangeSummary, sparkline } from './lib/chart.mjs';
import {
  COVERAGE_HEADER, DEFAULT_ROTATION_SLOTS, coverageRowsFor, describeDelta,
  describeGap, describeStaleness, mergeCoverage, reviewedEvidence, selectCoverage,
} from './lib/rotation.mjs';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

const root = path.resolve(flag('root') ?? process.cwd());
const edition = flag('edition') ?? 'Weekly Overview';
const rotationSlots = Number(flag('rotation') ?? DEFAULT_ROTATION_SLOTS);
const siteUrl = (flag('site-url') ?? process.env.SITE_URL ?? '').replace(/\/$/, '');

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

const csvCell = (v) => (/[",\n\r]/.test(String(v ?? ''))
  ? `"${String(v).replaceAll('"', '""')}"`
  : String(v ?? ''));

const [assets, scores, metrics] = await Promise.all([
  readTable('assets.csv'),
  readTable('scores.csv'),
  readTable('weekly_metrics.csv'),
]);

// Context for rotation write-ups: what a name is linked to, and how much evidence
// the store actually holds on it. Both are optional — a rotation slot has to work
// for a name the store knows almost nothing about, because most of them are.
const themeLinks = await readTable('asset_themes.csv').catch(() => []);
const sourceRows = await readTable('sources.csv').catch(() => []);

// The gate ledger drives the readiness line. Absent ledger, absent line —
// silence is better than implying gates were checked when they were not.
const gates = await readTable('gates.csv').catch(() => []);
const gateTotal = new Set(gates.map((g) => g.gate_id)).size;
const gateReady = [...new Set(gates.map((g) => g.asset_id))]
  .filter((id) => gates.filter((g) => g.asset_id === id).every((g) => g.status === 'documented'));

// macro.csv only exists once ingestion has run, so treat it as optional.
const macro = await readTable('macro.csv').catch(() => []);
const macroWeeks = [...new Set(macro.map((r) => r.week_id))].sort();
const macroWeek = macroWeeks.at(-1);
const macroRows = macro.filter((r) => r.week_id === macroWeek);

// The registry carries what each series means and how it reaches equity prices.
// It is authored once and rendered every week, so the issue tracks a series rather
// than re-explaining it — and the mechanism cannot be restated differently from one
// week to the next.
const macroSpecs = await readTable('macro_series.csv').catch(() => []);
const macroHistory = await readTable('macro_history.csv').catch(() => []);

const historyFor = (seriesId) => macroHistory
  .filter((r) => r.series_id === seriesId)
  .sort((a, b) => a.observation_date.localeCompare(b.observation_date));

// Registry order is reading order. A series appears only when this week's snapshot
// actually holds it, so a registry addition cannot show up before it is ingested.
const regime = macroSpecs
  .map((spec) => {
    const snapshot = macroRows.find((r) => r.series_id === spec.series_id);
    if (!snapshot) return undefined;
    const points = historyFor(spec.series_id);
    return { spec, snapshot, points, prior: points.at(-2) };
  })
  .filter(Boolean);

// A series that was ingested but is missing from the registry is still shown, just
// without commentary. A number in the store should never quietly vanish from the
// issue because its documentation was not written.
const unregistered = macroRows.filter((r) => !macroSpecs.some((s) => s.series_id === r.series_id));

const formatMacro = (row) => formatValue(row.value, row.unit);

// A month-over-month delta on a level series is informative. On a change series it
// is a second difference — noise dressed as signal — so it is shown only where it
// means something.
const deltaFor = ({ spec, snapshot, prior }) => {
  if (!prior || spec.transform === 'mom_change') return '';
  const change = Number(snapshot.value) - Number(prior.value);
  if (!Number.isFinite(change)) return '';
  if (Math.abs(change) < 1e-9) return 'unchanged on the month';
  const dp = Math.abs(change) < 0.1 ? 2 : 1;
  return `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(dp)} on the month`;
};

// The store may not have rows for this week yet — a quiet week is legitimate, so
// fall back to the most recent week present rather than publishing an empty board.
const weeksPresent = [...new Set(scores.map((r) => r.week_id))].sort();
const boardWeek = weeksPresent.includes(weekId) ? weekId : weeksPresent.at(-1);
const boardIsStale = boardWeek !== weekId;

const byAsset = new Map(assets.map((a) => [a.asset_id, a]));
const metricFor = new Map(metrics.filter((m) => m.week_id === boardWeek).map((m) => [m.asset_id, m]));

// --- what this issue covers ---------------------------------------------------
// The candidate tier is standing coverage and the universe tier rotates, so an
// issue is no longer a fixed five names with frozen scores. See lib/rotation.mjs
// for the selection rule; it is deterministic, so rebuilding a week reproduces it.
const coverage = await readTable('coverage.csv').catch(() => []);
const evidenceCount = reviewedEvidence(sourceRows);
const plan = selectCoverage({ assets, scores, coverage, weekId, rotationSlots, evidenceCount });

const board = plan.core.map((c) => ({
  ...c,
  total: c.score,
  marketCap: metricFor.get(c.assetId)?.market_cap ?? '',
  movement: describeDelta(c.delta),
  staleness: describeStaleness(c),
}));

// Rotation write-ups reuse the note research-rotation.mjs already produced for the
// asset, when there is one. The issue never invents an assessment: an unexamined
// name appears with its store facts and an explicit statement that it is unexamined.
const researchNote = async (assetId) => {
  const text = await readFile(path.join(root, 'research', `${assetId}.md`), 'utf8').catch(() => '');
  if (!text) return undefined;
  // Last dated review only. Earlier ones stay in the file; the issue shows current.
  const sections = text.split(/^## Review /m);
  const latest = sections.at(-1);
  if (!latest || sections.length < 2) return undefined;
  const [dateLine, ...rest] = latest.split('\n');
  return { date: dateLine.trim(), body: rest.join('\n').trim() };
};

// "5 source rows" would be a misleading thing to print: ingestion writes a stub per
// filing it finds, so a company mid-merger accumulates dozens of rows that nobody
// has opened. Report both numbers and let the gap between them show.
const evidenceLine = (assetId) => {
  const all = sourceRows.filter((s) => s.asset_id === assetId);
  const read = evidenceCount[assetId] ?? 0;
  if (!all.length) return 'no evidence recorded yet';
  if (!read) return `${all.length} filing${all.length === 1 ? '' : 's'} recorded, none read yet`;
  return `${read} of ${all.length} source row${all.length === 1 ? '' : 's'} read`;
};

const rotation = await Promise.all(plan.rotation.map(async (r) => ({
  ...r,
  themes: themeLinks.filter((l) => l.asset_id === r.assetId).map((l) => l.theme_id),
  evidence: evidenceCount[r.assetId] ?? 0,
  evidenceLine: evidenceLine(r.assetId),
  note: await researchNote(r.assetId),
})));

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
// Tolerate both "## Action posture" and the numbered "## 11. Action posture",
// since the workflow sections in the core prompt are numbered and the model
// mirrors that style. Heading level is allowed to vary for the same reason.
const postureSection = draft.split(/^#{2,4}\s+(?:\d+\.\s*)?Action posture\s*$/im)[1] ?? '';
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
// Reuse the stored cut-off when rebuilding an existing issue. Stamping the
// current time instead makes every rebuild churn all five files, which would
// make the workflow open a pull request every week whether or not anything
// actually changed.
const storedCutoff = await readFile(path.join(reportDir, 'report.json'), 'utf8')
  .then((text) => JSON.parse(text).data_cutoff)
  .catch(() => undefined);
const cutoff = flag('cutoff') ?? storedCutoff ?? new Date().toISOString();
const subject = `Investo Master — Issue ${issue}: ${edition}`;
const safety =
  'Research and decision support only. No trades, promised returns, or personalised financial, tax or legal advice. The human investor retains responsibility for every decision.';

const pill = (text, bg = '#e7ede8', color = '#26533a') =>
  `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${bg};color:${color};font-size:10px;line-height:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${e(text)}</span>`;

const link = (page, text) => (siteUrl
  ? `<a href="${siteUrl}/${page}" style="color:#2e5f8f;">${e(text)}</a>`
  : e(text));

const boardRows = board.map((c) => `
  <tr>
    <td style="padding:11px;border-top:1px solid #e5e1d8;color:#13263d;font-size:13px;font-weight:800;">${e(c.symbol)}<div style="color:#7b8792;font-size:10px;font-weight:400;">${e(c.name)}</div></td>
    <td style="padding:11px;border-top:1px solid #e5e1d8;">${pill(c.stage, c.stage === 'watchlist' ? '#e8eef5' : '#f5ead2', c.stage === 'watchlist' ? '#355d82' : '#6a4a0e')}</td>
    <td align="right" style="padding:11px;border-top:1px solid #e5e1d8;color:${c.total >= 75 ? '#2f6f54' : '#9a6b18'};font-size:16px;font-weight:800;">${c.total ?? '—'}</td>
    <td align="right" style="padding:11px;border-top:1px solid #e5e1d8;color:${c.delta ? '#13263d' : '#9aa3ad'};font-size:12px;font-weight:${c.delta ? 800 : 400};">${e(c.movement)}</td>
    <td align="right" style="padding:11px;border-top:1px solid #e5e1d8;color:#263849;font-size:12px;">${e(c.asymmetry ?? '—')}/10</td>
    <td align="right" style="padding:11px;border-top:1px solid #e5e1d8;color:#263849;font-size:12px;">${e(usd(c.marketCap))}</td>
  </tr>`).join('');

// Every core name carries the same score week, so state the age once beneath the
// board rather than repeating it on six rows.
const coreAge = [...new Set(board.map((c) => c.scoreAgeWeeks).filter((n) => n !== undefined))];
const staleNote = boardIsStale
  ? `<p style="margin:0 0 14px;color:#8a5b1c;font-size:12px;line-height:20px;background:#f5ead2;border-left:4px solid #ad7a25;padding:11px 13px;border-radius:0 8px 8px 0;">No new scoring for ${e(weekId)}. These scores were struck in ${e(boardWeek)}${coreAge.length === 1 ? ` and are ${coreAge[0]} week${coreAge[0] === 1 ? '' : 's'} old` : ''}; the movement column reads against the last issue that carried each name. An unchanged column means the assessment has not been revisited, not that the position was re-confirmed.</p>`
  : '';

// --- rotation -----------------------------------------------------------------
// The section that stops the issue being the same five names every week. Names are
// drawn oldest-covered-first from the universe tier, so coverage is automatic.
const rotationCard = (r) => `
<table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:12px;margin-bottom:12px;">
  <tr><td style="padding:15px 16px;">
    <table width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
      <td valign="top" style="color:#13263d;font-size:15px;font-weight:800;">${e(r.symbol)}
        <div style="color:#7b8792;font-size:11px;font-weight:400;padding-top:2px;">${e(r.name)}</div></td>
      <td align="right" valign="top">${pill(describeGap(r), '#eef1f5', '#355d82')}</td>
    </tr></table>
    <p style="margin:10px 0 0;color:#7b8792;font-size:11px;line-height:17px;">
      ${e(r.asset.industry || 'Industry not recorded')}${r.themes.length ? ` · ${e(r.themes.join(', '))}` : ''} · ${e(r.evidenceLine)}
    </p>
    ${r.note
    ? `<p style="margin:9px 0 0;color:#354252;font-size:13px;line-height:21px;">${inline(r.note.body.split('\n\n')[0])}</p>
       <p style="margin:7px 0 0;color:#7b8792;font-size:10px;">From the rotating research note of ${e(r.note.date)}${siteUrl ? ` · ${link('universe.html', 'full note')}` : ''}.</p>`
    : `<p style="margin:9px 0 0;color:#8a5b1c;font-size:12px;line-height:19px;">Not yet examined. This name entered by screen and is in the issue because the rotation reached it, not because a view has been formed. The store holds ${e(r.evidenceLine)}.</p>`}
  </td></tr>
</table>`;

const rotationSection = rotation.length ? `
<div style="color:#527095;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin-bottom:4px;">In rotation this week</div>
<p style="margin:0 0 12px;color:#7b8792;font-size:11px;line-height:18px;">Drawn from the ${plan.queueDepth} names at coverage tier, longest-waiting first. At ${rotationSlots} a week the full universe is read every ${plan.cycleWeeks} weeks. Appearing here means the rotation reached the name, not that it is a recommendation.</p>
${rotation.map(rotationCard).join('')}
${plan.upNext.length ? `<p style="margin:0 0 22px;color:#7b8792;font-size:11px;line-height:18px;">Next up: ${plan.upNext.map((u) => e(u.symbol)).join(' · ')}</p>` : ''}
` : '';

const movementSection = (plan.entered.length || plan.dropped.length) ? `
<div style="color:#527095;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin:22px 0 8px;">Universe changes</div>
<table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:12px;margin-bottom:22px;">
  ${plan.entered.length ? `<tr><td style="padding:12px 14px;color:#354252;font-size:12px;line-height:19px;"><strong style="color:#2f6f54;">Entered</strong> — ${plan.enteredIsBatch
    ? `${plan.entered.length} names added from a screen this week. They join the rotation queue and will each get a turn; they are not written up individually here.`
    : plan.entered.map((x) => e(x.symbol)).join(', ')}</td></tr>` : ''}
  ${plan.dropped.length ? `<tr><td style="padding:12px 14px;border-top:1px solid #e5e1d8;color:#354252;font-size:12px;line-height:19px;"><strong style="color:#9a6b18;">Dropped</strong> — ${plan.dropped.map((x) => e(x.symbol)).join(', ')}</td></tr>` : ''}
</table>` : '';

// The archive and the email differ in exactly one respect: chart resolution.
//
// Gmail clips a message at roughly 102KB and check-report.mjs enforces a 90KB
// ceiling below that, so one column per month across five ten-year series cannot
// fit alongside the narrative. The email therefore plots six-month means — coarse,
// but enough to place the current reading against its own decade, which is all the
// regime board is for. report.html keeps every month, has no size limit, is what
// the site publishes, and now travels with the email as an attachment, so the full
// resolution is never more than one click away.
const CHART_COLUMNS = { archive: Infinity, email: 21 };

const body = (archive) => `
<div style="background:#13263d;padding:38px 34px 34px;border-radius:18px 18px 0 0;">
  <div style="color:#8fc3ff;font-size:11px;font-weight:800;letter-spacing:.17em;text-transform:uppercase;margin-bottom:18px;">Investo Master · Weekly Overview</div>
  <h1 style="margin:0 0 12px;color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:41px;font-weight:500;">Issue ${e(issue)}: ${e(edition)}</h1>
  <p style="margin:0;color:#c9d3df;font-size:13px;line-height:22px;">Week ${e(weekId)} · Evidence cut-off ${e(cutoff)}</p>
</div>
<div style="padding:32px 34px;background:#f7f4ec;">
  <div style="margin-bottom:18px;">${pill(posture)}</div>
  ${staleNote}
  ${macroRows.length ? `
  <div style="color:#527095;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin-bottom:4px;">Regime board · ${e(macroWeek)}</div>
  <p style="margin:0 0 14px;color:#7b8792;font-size:11px;line-height:18px;">Each series is shown once, with its current reading against its own decade. The commentary is fixed and reviewed, not rewritten weekly; only the numbers move.</p>
  ${archive ? regime.map((entry) => {
    const { spec, snapshot, points } = entry;
    const delta = deltaFor(entry);
    return `<table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:12px;margin-bottom:12px;">
      <tr>
        <td style="padding:14px 15px 8px;">
          <table width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td valign="top" style="color:#13263d;font-size:12px;font-weight:800;line-height:16px;">${e(spec.label)}
              <div style="color:#7b8792;font-size:10px;font-weight:400;line-height:14px;padding-top:2px;">${e(snapshot.observation_date)}${delta ? ` · ${e(delta)}` : ''}</div>
            </td>
            <td align="right" valign="top" style="color:#13263d;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;line-height:22px;white-space:nowrap;">${e(formatMacro(snapshot))}</td>
          </tr></table>
          <p style="margin:8px 0 0;color:#7b8792;font-size:10px;line-height:15px;">${e(spec.regime_role)}</p>
        </td>
      </tr>
      ${points.length > 1 ? `<tr><td style="padding:2px 15px 12px;">${columnChart(points, {
        unit: snapshot.unit,
        height: 58,
        maxColumns: CHART_COLUMNS.archive,
      })}</td></tr>` : ''}
    </table>`;
  }).join('') : `
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:12px;margin-bottom:12px;">
    ${regime.map((entry, i) => `<tr>
      <td style="padding:11px 13px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#13263d;font-size:12px;font-weight:800;">${e(entry.spec.short_label || entry.spec.label)}
        <div style="color:#7b8792;font-size:10px;font-weight:400;padding-top:2px;">${e(entry.snapshot.observation_date)}${deltaFor(entry) ? ` · ${e(deltaFor(entry))}` : ''}</div></td>
      <td align="right" style="padding:11px 13px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#13263d;font-family:Georgia,'Times New Roman',serif;font-size:18px;white-space:nowrap;">${e(formatMacro(entry.snapshot))}</td>
    </tr>`).join('')}
  </table>
  <p style="margin:0 0 22px;color:#7b8792;font-size:11px;line-height:18px;">Ten-year charts and the transmission notes for each series are on the ${link('index.html', 'regime board')}. They are reference material that does not change week to week, so the email carries the readings and the site carries the depth.</p>`}
  ${unregistered.length ? `<table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:12px;margin-bottom:12px;">
    ${unregistered.map((r, i) => `<tr>
      <td style="padding:11px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#52606d;font-size:11px;">${e(r.label)} <span style="color:#c08a3e;">· not in the series registry</span></td>
      <td align="right" style="padding:11px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#13263d;font-size:13px;font-weight:800;">${e(formatMacro(r))}</td>
      <td align="right" style="padding:11px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#7b8792;font-size:10px;">${e(r.observation_date)}</td>
    </tr>`).join('')}
  </table>` : ''}
  ${archive && regime.length ? `
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef1f5;border:1px solid #d5dce5;border-radius:12px;margin-bottom:26px;">
    <tr><td style="padding:16px 17px 6px;">
      <div style="color:#355d82;font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;">How the regime reaches equity prices</div>
      <p style="margin:7px 0 0;color:#52606d;font-size:11px;line-height:18px;">Transmission mechanisms, not forecasts. Each states the channel through which a series is capable of moving prices; none asserts that it will, or in which direction.</p>
    </td></tr>
    ${regime.map((entry) => `<tr><td style="padding:12px 17px 0;">
      <div style="color:#13263d;font-size:11px;font-weight:800;">${e(entry.spec.short_label || entry.spec.label)}</div>
      <p style="margin:4px 0 0;color:#354252;font-size:12px;line-height:20px;">${e(entry.spec.equity_transmission)}</p>
      ${entry.spec.caveat ? `<p style="margin:5px 0 0;color:#8a5b1c;font-size:11px;line-height:17px;"><strong>Read with care:</strong> ${e(entry.spec.caveat)}</p>` : ''}
    </td></tr>`).join('')}
    <tr><td style="padding:14px 17px 16px;"><p style="margin:0;color:#7b8792;font-size:10px;line-height:16px;">A macro reading is context for underwriting, never a trigger for action. Nothing here is a view on any tracked company.</p></td></tr>
  </table>` : ''}` : ''}
  <div style="color:#527095;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin-bottom:11px;">Standing coverage · scored ${e(boardWeek)}</div>
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:12px;overflow:hidden;margin-bottom:6px;">
    <tr>${['Candidate', 'Stage', 'Score', 'Move', 'Asym.', 'Market cap'].map((h, i) => `<td ${i > 1 ? 'align="right"' : ''} style="padding:9px 11px;background:#eeeae0;color:#527095;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${e(h)}</td>`).join('')}</tr>
    ${boardRows}
  </table>
  <p style="margin:0 0 8px;color:#7b8792;font-size:10px;line-height:17px;">Scores prioritise research. They cannot override valuation, incomplete evidence or a fatal flaw. ${siteUrl ? `Full board with confidence, uncertainties and checkpoints: ${link('index.html', 'dashboard')}.` : ''}</p>
  ${gates.length ? `<p style="margin:8px 0 0;color:#7b8792;font-size:10px;line-height:17px;">Decision gates: ${gateReady.length} of ${[...new Set(gates.map((g) => g.asset_id))].length} candidates clear all ${gateTotal}. No candidate may reach decision review before its ledger is complete.</p>` : ''}
  <div style="height:1px;background:#d9d7cf;margin:26px 0;"></div>
  ${rotationSection}
  ${movementSection}
  <div style="height:1px;background:#d9d7cf;margin:26px 0;"></div>
  ${renderMarkdown(draft)}
</div>
<div style="padding:24px 34px 30px;background:#ede9df;border-radius:0 0 18px 18px;">
  ${siteUrl ? `<p style="margin:0 0 10px;color:#52606d;font-size:11px;line-height:19px;">${link('coverage.html', 'Coverage ledger')} · ${link('universe.html', 'Universe')} · ${link('themes.html', 'Themes')} · ${link('evidence.html', 'Evidence')} · ${link('archive.html', 'Archive')}</p>` : ''}
  <p style="margin:0 0 7px;color:#687382;font-size:11px;line-height:18px;">${e(safety)}</p>
  <p style="margin:0;color:#7a8490;font-size:10px;line-height:17px;">Report ID: ${e(reportId)} · Full claim registry: data/sources.csv</p>
</div>`;

const doc = (archive) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(subject)}</title><style>body{margin:0;background:#e7e5df;-webkit-font-smoothing:antialiased}table{border-collapse:collapse}code{font-family:ui-monospace,Menlo,monospace}@media(max-width:680px){.shell{width:100%!important}.outer{padding:0!important}}</style></head><body><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e7e5df;"><tr><td class="outer" align="center" style="padding:${archive ? '42px 16px' : '24px 12px'};"><table class="shell" role="presentation" width="660" cellspacing="0" cellpadding="0" border="0" style="width:660px;max-width:100%;"><tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${body(archive)}</td></tr></table></td></tr></table></body></html>`;

const boardText = board
  .map((c) => `- ${c.symbol} — ${c.stage} — score ${c.total ?? '—'} (${c.movement}) — asymmetry ${c.asymmetry ?? '—'}/10 — ${c.confidence ?? '—'} confidence — ${usd(c.marketCap)}`)
  .join('\n');

const rotationText = rotation.length
  ? [
    'IN ROTATION THIS WEEK',
    `Drawn from ${plan.queueDepth} coverage-tier names, longest-waiting first.`,
    `At ${rotationSlots} a week the full universe is read every ${plan.cycleWeeks} weeks.`,
    '',
    ...rotation.flatMap((r) => [
      `${r.symbol} — ${r.name} (${describeGap(r)})`,
      `  ${r.asset.industry || 'Industry not recorded'}${r.themes.length ? ` · ${r.themes.join(', ')}` : ''} · ${r.evidenceLine}`,
      r.note
        ? `  ${r.note.body.split('\n\n')[0].replace(/\s+/g, ' ').trim()}`
        : '  Not yet examined. In the issue because the rotation reached it, not because a view has been formed.',
      '',
    ]),
    ...(plan.upNext.length ? [`Next up: ${plan.upNext.map((u) => u.symbol).join(' · ')}`, ''] : []),
  ]
  : [];

const changesText = (plan.entered.length || plan.dropped.length)
  ? [
    'UNIVERSE CHANGES',
    ...(plan.entered.length
      ? [`Entered: ${plan.enteredIsBatch
        ? `${plan.entered.length} names added from a screen this week; they join the rotation queue.`
        : plan.entered.map((x) => x.symbol).join(', ')}`]
      : []),
    ...(plan.dropped.length ? [`Dropped: ${plan.dropped.map((x) => x.symbol).join(', ')}`] : []),
    '',
  ]
  : [];

const text = [
  `INVESTO MASTER — ISSUE ${issue}: ${edition}`,
  `Week ${weekId} | Evidence cut-off ${cutoff}`,
  `Action: ${posture}`,
  '',
  boardIsStale ? `NOTE: no scored rows for ${weekId}; board carried forward from ${boardWeek}.\n` : '',
  ...(macroRows.length
    ? [
      `REGIME BOARD (${macroWeek})`,
      ...regime.flatMap((entry) => {
        const delta = deltaFor(entry);
        const spark = sparkline(entry.points, 58, { unit: entry.snapshot.unit });
        return [
          `- ${entry.spec.label}: ${formatMacro(entry.snapshot)} (${entry.snapshot.observation_date}${delta ? `, ${delta}` : ''})`,
          ...(spark ? [`    ${spark}`, `    ${rangeSummary(entry.points, entry.snapshot.unit)}`] : []),
        ];
      }),
      ...unregistered.map((r) => `- ${r.label}: ${formatMacro(r)} (${r.observation_date}) [not in the series registry]`),
      '',
      // The transmission notes are the same every week by design, so they live on
      // the site with the ten-year charts. This is the plain-text alternative of
      // the email and has to match it, not the archive.
      ...(regime.length
        ? [
          `Ten-year charts and the transmission note for each series are on the regime board${siteUrl ? `: ${siteUrl}/index.html` : ' on the site'}.`,
          'A macro reading is context for underwriting, never a trigger for action.',
          '',
        ]
        : []),
    ]
    : []),
  `STANDING COVERAGE (scored ${boardWeek})`,
  boardText,
  '',
  ...rotationText,
  ...changesText,
  plain(draft),
  '',
  ...(siteUrl
    ? ['MORE', `Coverage ledger: ${siteUrl}/coverage.html`, `Universe: ${siteUrl}/universe.html`,
      `Archive: ${siteUrl}/archive.html`, '']
    : []),
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
      'Each series appears once, read against its own decade. The commentary below is',
      'authored once and reviewed, not rewritten each week; only the numbers move.',
      '',
      '| Series | Value | On the month | Observation | Decade range |',
      '|---|---:|---|---|---|',
      ...regime.map((entry) => [
        '', entry.spec.label, formatMacro(entry.snapshot), deltaFor(entry) || '—',
        entry.snapshot.observation_date, rangeSummary(entry.points, entry.snapshot.unit) || '—', '',
      ].join(' | ').trim()),
      ...unregistered.map((r) => `| ${r.label} | ${formatMacro(r)} | — | ${r.observation_date} | not in the series registry |`),
      '',
      ...regime.flatMap((entry) => {
        const spark = sparkline(entry.points, 58, { unit: entry.snapshot.unit });
        return spark ? [`\`${entry.spec.short_label || entry.spec.label}\` \`${spark}\``, ''] : [];
      }),
      ...(regime.length
        ? [
          '### How the regime reaches equity prices', '',
          'Transmission mechanisms, not forecasts. Each states the channel through which a',
          'series is capable of moving prices; none asserts that it will, or in which direction.',
          '',
          ...regime.flatMap((entry) => [
            `**${entry.spec.short_label || entry.spec.label}.** ${entry.spec.equity_transmission}`,
            ...(entry.spec.caveat ? ['', `*Read with care:* ${entry.spec.caveat}`] : []),
            '',
          ]),
          'A macro reading is context for underwriting, never a trigger for action. Nothing',
          'here is a view on any tracked company.',
          '',
        ]
        : []),
    ]
    : []),
  `## Standing coverage (scored ${boardWeek})`,
  '',
  '| Candidate | Stage | Score | Move | Valuation asymmetry | Thesis confidence | Market cap |',
  '|---|---|---|---|---|---|---|',
  ...board.map((c) => `| ${c.symbol} — ${c.name} | ${c.stage} | ${c.total ?? '—'} | ${c.movement} | ${c.asymmetry ?? '—'}/10 | ${c.confidence ?? '—'} | ${usd(c.marketCap)} |`),
  '',
  boardIsStale
    ? `Movement reads against the last issue that carried each name. An unchanged column means the assessment has not been revisited, not that it was re-confirmed.\n`
    : '',
  ...(rotation.length
    ? [
      '## In rotation this week', '',
      `Drawn from the ${plan.queueDepth} names at coverage tier, longest-waiting first. At`,
      `${rotationSlots} a week the full universe is read every ${plan.cycleWeeks} weeks. Appearing here`,
      'means the rotation reached the name, not that it is a recommendation.',
      '',
      ...rotation.flatMap((r) => [
        `### ${r.symbol} — ${r.name}`, '',
        `*${describeGap(r)} · ${r.asset.industry || 'industry not recorded'}${r.themes.length ? ` · ${r.themes.join(', ')}` : ''} · ${r.evidenceLine}*`,
        '',
        r.note
          ? `${r.note.body.split('\n\n')[0]}\n\n*From the rotating research note of ${r.note.date}.*`
          : 'Not yet examined. This name entered by screen and is in the issue because the rotation reached it, not because a view has been formed.',
        '',
      ]),
      ...(plan.upNext.length ? [`Next up: ${plan.upNext.map((u) => u.symbol).join(' · ')}`, ''] : []),
    ]
    : []),
  ...((plan.entered.length || plan.dropped.length)
    ? [
      '## Universe changes', '',
      ...(plan.entered.length
        ? [`**Entered** — ${plan.enteredIsBatch
          ? `${plan.entered.length} names added from a screen this week. They join the rotation queue and will each get a turn.`
          : plan.entered.map((x) => `${x.symbol} (${x.name})`).join(', ')}`, '']
        : []),
      ...(plan.dropped.length
        ? [`**Dropped** — ${plan.dropped.map((x) => `${x.symbol} (${x.name})`).join(', ')}`, '']
        : []),
    ]
    : []),
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
  coverage: {
    core: plan.core.map((c) => c.symbol),
    rotation: plan.rotation.map((r) => r.symbol),
    entered: plan.entered.length,
    dropped: plan.dropped.map((d) => d.symbol),
    queue_depth: plan.queueDepth,
    cycle_weeks: plan.cycleWeeks,
  },
};

// The ledger is written before the documents so a failed render cannot leave a
// week recorded as covered when nothing was published for it.
const freshCoverage = coverageRowsFor({
  plan,
  weekId,
  reportId,
  recordedAt: new Date().toISOString(),
  notes: Object.fromEntries([
    ...plan.core.map((c) => [c.assetId, `Standing coverage. Score ${c.score ?? '—'} (${describeDelta(c.delta)}), ${describeStaleness(c)}.`]),
    ...rotation.map((r) => [r.assetId, r.note
      ? `Rotation write-up from the research note of ${r.note.date}.`
      : 'Rotation slot. Not yet examined; store facts only.']),
  ]),
});
const nextCoverage = mergeCoverage(coverage, freshCoverage, weekId);
await writeFile(
  path.join(root, 'data', 'coverage.csv'),
  `${[COVERAGE_HEADER.join(','), ...nextCoverage.map((r) => COVERAGE_HEADER.map((k) => csvCell(r[k])).join(','))].join('\n')}\n`,
  'utf8',
);

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

const emailBytes = Buffer.byteLength(doc(false), 'utf8');

console.log(`Built ${reportId} in ${relative}`);
console.log(`  standing: ${board.length} candidates, scored ${boardWeek}${boardIsStale ? ' (carried forward)' : ''}`);
console.log(`  rotation: ${plan.rotation.map((r) => r.symbol).join(', ') || 'none'} — ${plan.queueDepth} in queue, full cycle ${plan.cycleWeeks} weeks`);
if (plan.entered.length) console.log(`  entered:  ${plan.enteredIsBatch ? `${plan.entered.length} names (batch)` : plan.entered.map((x) => x.symbol).join(', ')}`);
if (plan.dropped.length) console.log(`  dropped:  ${plan.dropped.map((x) => x.symbol).join(', ')}`);
console.log(`  ledger:   data/coverage.csv — ${freshCoverage.length} rows for ${weekId}, ${nextCoverage.length} total`);
console.log(`  email.html: ${(emailBytes / 1024).toFixed(1)} KB${emailBytes > 92_160 ? '  ** approaching the ~102KB Gmail clip **' : ''}`);
if (!siteUrl) console.log('  note: SITE_URL is unset, so the email names the depth pages without linking to them.');
console.log('  approved_for_send: false — review, then set it true before sending.');
