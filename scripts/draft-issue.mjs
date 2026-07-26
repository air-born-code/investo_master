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
  'gates.csv',
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
    '',
    'gates.csv records the thirteen decision gates from the conviction policy per',
    'asset. An asset cannot be proposed for decision review unless every one of its',
    'gates reads "documented". Do not assess a gate yourself or infer that one is met:',
    'report the ledger as it stands, and name the outstanding gate numbers.',
  ].join('\n'),
].join('\n\n');

const userTurn = [
  `Draft the narrative for issue week ${weekId}.`,
  '',
  'Current research store:',
  '',
  ...store,
  '',
  'Follow the Weekly Research Workflow in the core research prompt, using its',
  'section names and order:',
  '',
  '  1. Executive Summary      2. Cycle Position        3. Structural Change Radar',
  '  4. Signal Scanner         5. New Candidates        6. Existing Thesis Updates',
  '  7. Scenario Analysis      8. Decision Dashboard    9. Research Queue',
  '',
  'Then two closing sections this publishing pipeline requires:',
  '',
  '  10. Data gaps — what the store cannot answer, stated plainly',
  '  11. Action posture — the decision, and why',
  '',
  'Omit any numbered section with nothing evidenced to report rather than padding',
  'it, and say in the Executive Summary which sections you omitted and why. A quiet',
  'week is a short issue. Keep the exact heading text so the sections can be parsed.',
  '',
  'Output the Markdown only — no preamble.',
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
// Streamed, not buffered. A full issue can take well over ten minutes to
// generate, and a single silent request that long is fragile: it hits timeouts
// with nothing to show for the spend. Streaming also surfaces progress.
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
    stream: true,
    usage: { include: true },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userTurn },
    ],
  }),
  signal: AbortSignal.timeout(1_800_000),
});

if (!response.ok) {
  const detail = await response.text().catch(() => '');
  console.error(`OpenRouter request failed (${response.status}).`);
  console.error(detail.slice(0, 500));
  process.exit(1);
}

let markdown = '';
let finishReason;
let usage = {};
let buffer = '';

for await (const chunk of response.body) {
  buffer += Buffer.from(chunk).toString('utf8');
  const lines = buffer.split('\n');
  // Keep the last element: it may be a partial line split across chunks.
  buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue; // OpenRouter sends comment/keepalive lines; skip anything unparseable
    }

    if (parsed.error) {
      console.error(`\nOpenRouter error: ${parsed.error.message ?? JSON.stringify(parsed.error)}`);
      process.exit(1);
    }

    const delta = parsed.choices?.[0]?.delta?.content;
    if (delta) {
      markdown += delta;
      process.stdout.write(delta);
    }
    if (parsed.choices?.[0]?.finish_reason) finishReason = parsed.choices[0].finish_reason;
    if (parsed.usage) usage = parsed.usage;
  }
}

if (finishReason === 'length') {
  console.error('\nDraft hit the max_tokens ceiling and is truncated. Raise max_tokens and rerun.');
  process.exit(1);
}

markdown = markdown.trim();
if (!markdown) {
  console.error(`\nNo text content returned (finish_reason: ${finishReason ?? 'unknown'}).`);
  process.exit(1);
}

const draftDir = path.join(root, 'drafts');
await mkdir(draftDir, { recursive: true });
const draftPath = path.join(draftDir, `${weekId}.md`);
await writeFile(draftPath, `${markdown}\n`, 'utf8');

console.log(`\nWrote drafts/${weekId}.md`);
console.log(`Tokens — prompt ${usage.prompt_tokens ?? '?'}, completion ${usage.completion_tokens ?? '?'}`);
if (usage.cost !== undefined) console.log(`Cost — $${usage.cost}`);
