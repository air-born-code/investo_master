#!/usr/bin/env node
// Harvests reader comments on a published issue into data/issue_comments.csv, so
// that next week's draft answers them instead of restating last week.
//
// Why a CSV and not just the markdown: build-issue.mjs rebuilds report.md, and a
// rebuild would silently erase anything written into it. The CSV is the durable
// record. report.md is only ever an INPUT here, scanned before a rebuild can
// clobber it, and comments.md is a sidecar the builder never writes, so notes put
// there survive everything.
//
// Two ways to comment, both of which land in the same place:
//
//   1. Annotate the issue. Anywhere in reports/<year>/<week>-issue-NNN/report.md
//      or its comments.md sidecar:
//
//          <!-- @comment This assumes the 13.0c layer is merchant silicon. Check. -->
//
//      The comment is attributed to the nearest heading above it, so position is
//      the only addressing you need — there is nothing to look up.
//
//   2. From the shell, when you are not in the file:
//
//          npm run comments:add -- --section "Structural Change Radar" --text "..."
//
// Comments stay `open` across weeks until something closes them. They are never
// deleted: an answered comment becomes `addressed` with the week that answered it,
// because the point of the record is to show whether a question actually got dealt
// with, and deleting it would erase exactly that.
//
// Usage: node scripts/issue-comments.mjs [--scan] [--list] [--dry-run]
//
// Options:
//   --scan             harvest comments from the reports tree (default action)
//   --add              add one comment directly; use with --section and --text
//   --section <name>   section the comment is against (with --add)
//   --text <comment>   the comment body (with --add)
//   --week <id>        issue week to attach to (default: newest issue in reports/)
//   --list             print open comments and exit
//   --close <id>       mark a comment addressed
//   --note <text>      note recorded with --close
//   --dry-run          report what would change, write nothing
//   --root <path>      project root (default: cwd)

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? undefined : argv[i + 1];
};

const root = path.resolve(flag('root') ?? process.cwd());
const dryRun = has('dry-run');
const csvPath = path.join(root, 'data', 'issue_comments.csv');
const now = new Date().toISOString();

const HEADER = [
  'comment_id', 'week_id', 'issue', 'section', 'comment', 'status',
  'raised_date', 'source', 'addressed_week', 'addressed_note', 'recorded_at',
];

// --- csv ---------------------------------------------------------------------
const parseCsv = (text) => {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((v) => v !== ''));
  if (!clean.length) return [];
  const head = clean.shift();
  return clean.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
};

const cell = (v) => (/[",\n\r]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
const toCsv = (rows) => [HEADER.join(','), ...rows.map((r) => HEADER.map((h) => cell(r[h])).join(','))].join('\n') + '\n';

const existing = await readFile(csvPath, 'utf8').then(parseCsv).catch(() => []);

// --- issue discovery ---------------------------------------------------------
// An issue directory is reports/<year>/<week>-issue-<nnn>.
const issueDirs = async () => {
  const out = [];
  const years = await readdir(path.join(root, 'reports'), { withFileTypes: true }).catch(() => []);
  for (const y of years) {
    if (!y.isDirectory()) continue;
    const dirs = await readdir(path.join(root, 'reports', y.name), { withFileTypes: true }).catch(() => []);
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const m = d.name.match(/^(\d{4}-W\d{2})-issue-(\d+)$/);
      if (m) out.push({ dir: path.join(root, 'reports', y.name, d.name), week_id: m[1], issue: m[2] });
    }
  }
  return out.sort((a, b) => a.week_id.localeCompare(b.week_id));
};

const issues = await issueDirs();
if (!issues.length) {
  console.error('No issue directories found under reports/. Build an issue first.');
  process.exit(1);
}

// --- listing -----------------------------------------------------------------
if (has('list')) {
  const open = existing.filter((r) => r.status === 'open');
  if (!open.length) {
    console.log('No open comments.');
  } else {
    console.log(`${open.length} open comment(s):\n`);
    for (const r of open) {
      console.log(`  ${r.comment_id}  [${r.week_id} · ${r.section || 'general'}]`);
      console.log(`    ${r.comment}\n`);
    }
  }
  process.exit(0);
}

// --- closing -----------------------------------------------------------------
const closeId = flag('close');
if (closeId) {
  const target = existing.find((r) => r.comment_id === closeId);
  if (!target) { console.error(`No comment with id ${closeId}`); process.exit(1); }
  target.status = 'addressed';
  target.addressed_week = flag('week') ?? issues.at(-1).week_id;
  target.addressed_note = flag('note') ?? '';
  if (dryRun) console.log(`--dry-run: would close ${closeId}`);
  else { await writeFile(csvPath, toCsv(existing), 'utf8'); console.log(`Closed ${closeId} in ${target.addressed_week}.`); }
  process.exit(0);
}

// --- id ----------------------------------------------------------------------
const slug = (s) => String(s).toLowerCase()
  .replace(/^\d+\.\s*/, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 40) || 'general';

const makeId = (week, section, taken) => {
  const base = `cmt-${week}-${slug(section)}`;
  let n = 1;
  while (taken.has(`${base}-${String(n).padStart(2, '0')}`)) n++;
  return `${base}-${String(n).padStart(2, '0')}`;
};

const taken = new Set(existing.map((r) => r.comment_id));
// Dedupe on the content itself, so re-scanning an annotated file is safe and a
// comment left in place across several runs is recorded exactly once.
const seen = new Set(existing.map((r) => `${r.week_id}|${slug(r.section)}|${r.comment.trim()}`));
const added = [];

const record = ({ week_id, issue, section, comment, source }) => {
  const key = `${week_id}|${slug(section)}|${comment.trim()}`;
  if (seen.has(key)) return false;
  seen.add(key);
  const id = makeId(week_id, section, taken);
  taken.add(id);
  added.push({
    comment_id: id,
    week_id,
    issue,
    section: section || 'general',
    comment: comment.trim(),
    status: 'open',
    raised_date: now.slice(0, 10),
    source,
    addressed_week: '',
    addressed_note: '',
    recorded_at: now,
  });
  return true;
};

// --- direct add --------------------------------------------------------------
if (has('add')) {
  const text = flag('text');
  if (!text) { console.error('--add needs --text "your comment"'); process.exit(1); }
  const wk = flag('week') ?? issues.at(-1).week_id;
  const iss = issues.find((i) => i.week_id === wk);
  if (!iss) { console.error(`No issue for week ${wk}`); process.exit(1); }
  const ok = record({
    week_id: wk, issue: iss.issue, section: flag('section') ?? 'general', comment: text, source: 'cli',
  });
  if (!ok) { console.log('That comment is already recorded.'); process.exit(0); }
  if (dryRun) console.log(`--dry-run: would add ${added[0].comment_id}`);
  else {
    await writeFile(csvPath, toCsv([...existing, ...added]), 'utf8');
    console.log(`Added ${added[0].comment_id} against ${added[0].section} (${wk}).`);
  }
  process.exit(0);
}

// --- scan --------------------------------------------------------------------
// Matches <!-- @comment ... --> (any number of lines) and a bare "@comment ..."
// line, so a note dashed off in the sidecar without HTML syntax still counts.
const BLOCK = /<!--\s*@comment\b([\s\S]*?)-->/g;
const BARE = /^\s*@comment\b[:\s]+(.+)$/;

const scanFile = async (file, meta) => {
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text === null) return 0;

  // Section is the nearest heading above the comment, so where you put it is the
  // whole addressing scheme. Build a line -> heading index once, and alongside it
  // a mask of lines that are code — fenced or four-space indented. Documentation
  // that shows the marker syntax lives in code blocks, and quoting the syntax must
  // never file a comment, or every issue arrives pre-loaded with its own examples.
  const lines = text.split('\n');
  const headingAt = [];
  const isCode = [];
  let current = '';
  let fenced = false;
  for (const line of lines) {
    if (/^\s{0,3}(```|~~~)/.test(line)) { fenced = !fenced; isCode.push(true); headingAt.push(current); continue; }
    isCode.push(fenced || /^ {4,}\S/.test(line));
    const m = line.match(/^#{1,4}\s+(.*)$/);
    if (m && !fenced) current = m[1].replace(/^\d+\.\s*/, '').trim();
    headingAt.push(current);
  }
  const lineOf = (index) => text.slice(0, index).split('\n').length - 1;

  let n = 0;
  for (const m of text.matchAll(BLOCK)) {
    const body = m[1].trim();
    const at = lineOf(m.index);
    if (isCode[at]) continue;
    if (body && record({ ...meta, section: headingAt[at], comment: body, source: path.basename(file) })) n++;
  }
  lines.forEach((line, i) => {
    // Skip bare markers that sit inside an HTML block already handled above.
    if (isCode[i] || /<!--/.test(line)) return;
    const m = line.match(BARE);
    if (m && record({ ...meta, section: headingAt[i], comment: m[1], source: path.basename(file) })) n++;
  });
  return n;
};

let scanned = 0;
for (const iss of issues) {
  for (const name of ['report.md', 'comments.md']) {
    scanned += await scanFile(path.join(iss.dir, name), { week_id: iss.week_id, issue: iss.issue });
  }
}

const openTotal = [...existing, ...added].filter((r) => r.status === 'open').length;
console.log(`Issue comments — scanned ${issues.length} issue(s)`);
console.log(`  new comments found: ${added.length}`);
console.log(`  open in total:      ${openTotal}`);
for (const a of added) console.log(`    ${a.comment_id}  [${a.section}]  ${a.comment.slice(0, 72)}${a.comment.length > 72 ? '…' : ''}`);

if (!added.length) {
  console.log('\nNothing new to record.');
} else if (dryRun) {
  console.log('\n--dry-run: data/issue_comments.csv not written');
} else {
  await writeFile(csvPath, toCsv([...existing, ...added]), 'utf8');
  console.log(`\nWrote data/issue_comments.csv — ${existing.length + added.length} rows`);
}
