import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const reportDir = path.resolve(process.argv[2] || '');
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
  if (metadata.approved_for_send !== true) failures.push('report is not approved for send');
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
