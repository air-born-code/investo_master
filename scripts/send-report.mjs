import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const reportDir = path.resolve(process.argv[2] || '');
const apiKey = process.env.RESEND_API_KEY;
const recipient = process.env.INVESTO_RECIPIENT_EMAIL;

if (!apiKey) throw new Error('RESEND_API_KEY is not set');
if (!recipient) throw new Error('INVESTO_RECIPIENT_EMAIL is not set');

const metadata = JSON.parse(await readFile(path.join(reportDir, 'report.json'), 'utf8'));
if (metadata.approved_for_send !== true) throw new Error('Report is not approved for send');

// Checked here as well as in check-report.mjs, and deliberately not by importing it.
// Delivery is the irreversible step, so it re-reads the ledger itself rather than
// trusting that validation ran. A finding's text is free prose containing commas and
// newlines, so this parses the CSV properly: splitting on lines would miss a blocking
// row whose text happens to wrap. See COMMITTEE.md.
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

const blocking = await readFile(path.join(process.cwd(), 'data', 'committee_findings.csv'), 'utf8')
  .then(parseCsv)
  .then((rows) => rows.filter((f) =>
    f.status === 'open'
    && f.severity === 'blocking'
    && (f.report_id === metadata.report_id || (!f.report_id && f.week_id === metadata.week_id))))
  .catch(() => []);
if (blocking.length) {
  throw new Error(
    `${blocking.length} unresolved blocking committee finding(s) for this issue: `
    + `${blocking.map((f) => f.finding_id).join(', ')}. `
    + 'Run "npm run review:list", then resolve each before sending.',
  );
}

const [html, text] = await Promise.all([
  readFile(path.join(reportDir, 'email.html'), 'utf8'),
  readFile(path.join(reportDir, 'email.txt'), 'utf8'),
]);

// The body is the size-constrained edition: Gmail clips a message near 102KB, so the
// inline charts there are drawn at reduced resolution. report.html has no such limit
// and carries the full monthly series, so it goes along as an attachment — a copy
// that can be opened, kept and read outside the mail client at full fidelity.
const attachmentName = `investo-master-issue-${metadata.issue ?? metadata.report_id}-${metadata.week_id ?? ''}.html`
  .replace(/-+\.html$/, '.html');
const archive = await readFile(path.join(reportDir, 'report.html'), 'utf8').catch(() => undefined);
if (!archive) {
  console.warn('No report.html found — sending without the full-resolution attachment.');
}

const idempotencyKey = `investo-${metadata.report_id}`;
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({
    from: metadata.from,
    to: [recipient],
    subject: metadata.subject,
    html,
    text,
    ...(archive
      ? {
        attachments: [{
          filename: attachmentName,
          content: Buffer.from(archive, 'utf8').toString('base64'),
          contentType: 'text/html',
        }],
      }
      : {}),
    tags: [
      { name: 'category', value: 'weekly-research' },
      { name: 'report_id', value: metadata.report_id },
    ],
  }),
});

const result = await response.json();
if (!response.ok) {
  throw new Error(`Resend rejected the email (${response.status}): ${JSON.stringify(result)}`);
}

const dataDir = path.join(process.cwd(), 'data');
const logPath = path.join(dataDir, 'delivery_log.csv');
await mkdir(dataDir, { recursive: true });

let needsHeader = false;
try {
  await readFile(logPath, 'utf8');
} catch {
  needsHeader = true;
}

const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const header = 'delivery_id,report_id,provider,recipient_label,attempted_at,status,provider_message_id,idempotency_key,error\n';
const attemptedAt = new Date().toISOString();
const row = [
  `${metadata.report_id}-${Date.now()}`,
  metadata.report_id,
  'resend',
  'owner',
  attemptedAt,
  'sent',
  result.id,
  idempotencyKey,
  '',
].map(csv).join(',') + '\n';

await appendFile(logPath, (needsHeader ? header : '') + row, 'utf8');
console.log(`Sent ${metadata.report_id}`);
console.log(`Resend email ID: ${result.id}`);
