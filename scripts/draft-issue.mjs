// Drafts the weekly narrative from the canonical CSV store, via OpenRouter.
//
// This script writes prose only. It never writes to data/*.csv — every figure in
// the draft has to trace back to a row that was already in the store before the
// model ran, so the research memory stays human-authored and auditable.
//
// Output lands in drafts/<week_id>.md for review. Publishing an issue is still
// build-baseline.mjs, and sending is still send-report.mjs behind approved_for_send.
//
// Usage: node --env-file-if-exists=.env.local scripts/draft-issue.mjs [root] [--dry-run]
//
// --dry-run assembles the prompt and reports its size without calling the API,
// so you can see what a run will cost before spending anything.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const root = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? process.cwd());
const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-opus-5';

// ISO-8601 week, matching the week_id format used across data/ and reports/.
const isoWeekId = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const read = (...parts) => readFile(path.join(root, ...parts), 'utf8');

const [masterPrompt, convictionPolicy] = await Promise.all([
  read('INVESTO_MASTER_PROMPT.md'),
  read('CONVICTION_POLICY.md'),
]);

// macro.csv is optional: it only exists once ingestion has run at least once.
const dataFiles = [
  'assets.csv',
  'themes.csv',
  'asset_themes.csv',
  'weekly_metrics.csv',
  'macro.csv',
  'scores.csv',
  'thesis_updates.csv',
  'sources.csv',
];

const store = (await Promise.all(
  dataFiles.map(async (name) => {
    try {
      return `### data/${name}\n\n\`\`\`csv\n${(await read('data', name)).trim()}\n\`\`\``;
    } catch {
      return null;
    }
  }),
)).filter(Boolean);

const weekId = isoWeekId(new Date());

const system = [
  masterPrompt,
  '---',
  convictionPolicy,
  '---',
  [
    'You are drafting the narrative section of a weekly Investo Master issue.',
    '',
    'Evidence rules, which override any instinct to produce a complete-looking report:',
    '- Every figure, date, and price in your draft must appear in the CSV data supplied',
    '  in the user turn. Do not supply a number from memory, and do not estimate one.',
    '- If the data does not support a claim you want to make, write the gap explicitly',
    '  under "Data gaps" rather than working around it.',
    '- Attribute each factual claim to a row in sources.csv where one exists.',
    '',
    'Length: match the substance actually present in the data. A quiet week is a short',
    'issue. Do not pad with filler sections, restated summaries, or boilerplate.',
    '',
    'The normal conclusion is no action. Only propose a decision review when the data',
    'shows evidence, asymmetry, and price aligning — and say which rows show it.',
  ].join('\n'),
].join('\n\n');

const userTurn = [
  `Draft the narrative for issue week ${weekId}.`,
  '',
  'Current research store:',
  '',
  ...store,
  '',
  'Produce Markdown with these sections: Summary, Theme notes, Watchlist notes,',
  'Data gaps, Action posture. Output the Markdown only — no preamble.',
].join('\n');

if (dryRun) {
  const chars = (text) => text.length.toLocaleString();
  console.log(`Week:          ${weekId}`);
  console.log(`Model:         ${model} (reasoning effort high)`);
  console.log(`System prompt: ${chars(system)} chars`);
  console.log(`User turn:     ${chars(userTurn)} chars (${store.length} CSV files)`);
  console.log('\nDry run — no API call made, no draft written.');
  process.exit(0);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set. Add it to .env.local and rerun.');
  process.exit(1);
}

console.log(`Drafting ${weekId} with ${model}. This can take several minutes.`);

// Note: temperature and other sampling parameters are deliberately omitted.
// Claude Opus 5 rejects them, so passing one through the gateway fails the call.
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    'x-title': 'Investo Master',
  },
  body: JSON.stringify({
    model,
    max_tokens: 16000,
    reasoning: { effort: 'high' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userTurn },
    ],
  }),
  signal: AbortSignal.timeout(600_000),
});

const payload = await response.json();

if (!response.ok || payload.error) {
  console.error(`OpenRouter request failed (${response.status}).`);
  console.error(payload.error?.message ?? JSON.stringify(payload).slice(0, 500));
  process.exit(1);
}

const choice = payload.choices?.[0];
if (choice?.finish_reason === 'length') {
  console.error('Draft hit the max_tokens ceiling and is truncated. Raise max_tokens and rerun.');
  process.exit(1);
}

const markdown = (choice?.message?.content ?? '').trim();
if (!markdown) {
  console.error(`No text content returned (finish_reason: ${choice?.finish_reason ?? 'unknown'}).`);
  process.exit(1);
}

const draftDir = path.join(root, 'drafts');
await mkdir(draftDir, { recursive: true });
const draftPath = path.join(draftDir, `${weekId}.md`);
await writeFile(draftPath, `${markdown}\n`, 'utf8');

const usage = payload.usage ?? {};
console.log(`Wrote drafts/${weekId}.md`);
console.log(`Tokens — prompt ${usage.prompt_tokens ?? '?'}, completion ${usage.completion_tokens ?? '?'}`);
if (usage.cost !== undefined) console.log(`Cost — $${usage.cost}`);
