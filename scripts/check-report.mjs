import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// Minimal reader for the two committee ledgers. Kept here rather than imported so
// that validation depends on nothing that a build step could have rewritten.
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => c !== ''));
  if (!clean.length) return [];
  const header = clean.shift();
  return clean.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
};

const readLedger = async (name) =>
  readFile(path.join(process.cwd(), 'data', name), 'utf8').then(parseCsv).catch(() => []);

// A committee row is against this issue if it names the report, or if it was raised
// against the week's draft before the issue had a report_id. Reviewing the draft and
// then building must not lose the review.
const appliesTo = (row, metadata) =>
  row.report_id === metadata.report_id
  || (!row.report_id && row.week_id === metadata.week_id);

const MINIMUM_SEATS = 3;
// Issues 001 to 003 were written and sent before the committee existed. They cannot
// be retroactively reviewed, and rebuilding them is a regression gate that has to
// keep passing, so the requirement starts at the week it was adopted.
const COMMITTEE_FROM = '2026-W33';

const args = process.argv.slice(2);
// A freshly built issue is unapproved by design. This flag lets CI validate the
// structure without asserting send-readiness; the default stays a send gate.
const allowUnapproved = args.includes('--allow-unapproved');
const reportDir = path.resolve(args.find((arg) => !arg.startsWith('--')) || '');
const requiredFiles = ['report.json', 'report.md', 'report.html', 'email.html', 'email.txt'];
const failures = [];

for (const file of requiredFiles) {
  try {
    const fileStat = await stat(path.join(reportDir, file));
    if (fileStat.size === 0) failures.push(`${file} is empty`);
  } catch {
    failures.push(`${file} is missing`);
  }
}

if (failures.length === 0) {
  const metadata = JSON.parse(await readFile(path.join(reportDir, 'report.json'), 'utf8'));
  const html = await readFile(path.join(reportDir, 'email.html'), 'utf8');
  const text = await readFile(path.join(reportDir, 'email.txt'), 'utf8');
  const markdown = await readFile(path.join(reportDir, 'report.md'), 'utf8');

  const requiredMetadata = ['report_id', 'subject', 'data_cutoff', 'action_posture', 'from'];
  for (const field of requiredMetadata) {
    if (!metadata[field]) failures.push(`report.json missing ${field}`);
  }
  if (metadata.approved_for_send !== true && !allowUnapproved) failures.push('report is not approved for send');

  // The committee gate is part of the send gate, not of structural validation: a
  // freshly built issue is deliberately unreviewed, exactly as it is deliberately
  // unapproved. CI validates with --allow-unapproved and skips both.
  if (!allowUnapproved && (metadata.week_id ?? '') >= COMMITTEE_FROM) {
    const [reviews, findings] = await Promise.all([
      readLedger('committee_reviews.csv'),
      readLedger('committee_findings.csv'),
    ]);
    const seats = new Set(reviews.filter((r) => appliesTo(r, metadata)).map((r) => r.member_id));
    if (seats.size < MINIMUM_SEATS) {
      failures.push(`committee has reviewed this issue with ${seats.size} seat(s); ${MINIMUM_SEATS} required (npm run review:issue)`);
    }
    for (const f of findings) {
      if (appliesTo(f, metadata) && f.status === 'open' && f.severity === 'blocking') {
        failures.push(`blocking committee finding ${f.finding_id} is unresolved: ${f.finding.slice(0, 80)}`);
      }
    }
  }
  if (!html.toLowerCase().includes('<!doctype html>')) failures.push('email.html is not a complete HTML document');
  if (!html.includes(metadata.report_id)) failures.push('email.html is missing report ID');
  if (!html.includes(metadata.action_posture)) failures.push('email.html is missing action posture');
  if (/\{\{\s*[^{}]+?\s*\}\}/.test(html)) failures.push('email.html contains unresolved template markers');
  if (Buffer.byteLength(html, 'utf8') > 90_000) failures.push('email.html exceeds the 90 KB safety threshold');
  if (text.length < 700) failures.push('email.txt is unexpectedly short');
  if (!markdown.toLowerCase().includes('safety boundary')) failures.push('report.md is missing the safety boundary');
  if (/re_[a-zA-Z0-9]{12,}/.test(html + text + markdown)) failures.push('a Resend credential may be embedded in report output');
  if (/[A-Z0-9._%+-]+@gmail\.com/i.test(html + text + markdown)) failures.push('a Gmail address is embedded in report output');
}

if (failures.length > 0) {
  console.error('Report validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Report validation passed: ${reportDir}`);
