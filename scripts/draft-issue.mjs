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
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
// A flag's value must not be mistaken for the project root.
const FLAGS_WITH_VALUES = new Set(['strategy']);
const positional = args.find((arg, i) => {
  if (arg.startsWith('--')) return false;
  const prev = args[i - 1];
  return !(prev?.startsWith('--') && FLAGS_WITH_VALUES.has(prev.slice(2)));
});
const root = path.resolve(positional ?? process.cwd());
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

// A lens is opt-in and applies to one issue. It supplies questions to ask of the
// store, never conclusions — see strategies/README.md.
const strategyName = flag('strategy');
let strategy;
if (strategyName) {
  try {
    strategy = await read('strategies', `${strategyName}.md`);
  } catch {
    console.error(`No lens at strategies/${strategyName}.md.`);
    console.error('Available lenses:');
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(path.join(root, 'strategies')).catch(() => []);
    for (const f of files.filter((n) => n.endsWith('.md') && n !== 'README.md')) {
      console.error(`  ${f.replace(/\.md$/, '')}`);
    }
    process.exit(1);
  }
}

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

const serialise = (rows) => rows.map((r) => r.map((cell) => (
  /[",\n\r]/.test(cell) ? `"${String(cell).replaceAll('"', '""')}"` : cell
)).join(',')).join('\n');

// sources.csv grows without bound, and sending all of it every week would make
// the prompt larger and noisier each run until it stopped fitting. A weekly issue
// needs recent evidence plus the full history of whatever is actually being
// researched, so send exactly that and say what was withheld.
const SOURCE_WINDOW_DAYS = 45;
const trimSources = async (text) => {
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  const assetCol = header.indexOf('asset_id');
  // published_at, not as_of_date: ingestion stamps as_of_date with the day it
  // ran, so every ingested row looks equally recent. The filing date is the one
  // that says whether the evidence is new.
  const dateCol = header.indexOf('published_at');

  const assetRows = parseCsv(await read('data', 'assets.csv'));
  const [assetHeader, ...assetBody] = assetRows;
  const idCol = assetHeader.indexOf('asset_id');
  const tierCol = assetHeader.indexOf('tier');
  const candidates = new Set(
    assetBody.filter((r) => (r[tierCol] ?? '') !== 'universe').map((r) => r[idCol]),
  );

  const cutoffDate = new Date(Date.now() - SOURCE_WINDOW_DAYS * 86_400_000)
    .toISOString().slice(0, 10);

  const kept = body.filter((r) =>
    candidates.has(r[assetCol]) || !r[assetCol] || r[dateCol] >= cutoffDate);
  const withheld = body.length - kept.length;

  const note = withheld
    ? `\n\n${withheld} older source rows for universe-tier assets are withheld from this prompt. They remain in the store; ask for a specific asset if its history matters.`
    : '';
  return `${serialise([header, ...kept])}\n\`\`\`${note}`;
};

const store = (await Promise.all(
  dataFiles.map(async (name) => {
    try {
      const text = (await read('data', name)).trim();
      const block = name === 'sources.csv' ? await trimSources(text) : `${text}\n\`\`\``;
      return `### data/${name}\n\n\`\`\`csv\n${block}`;
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
  ...(strategy
    ? [
      [
        `An analytical lens is applied to this issue: strategies/${strategyName}.md.`,
        'Use its questions to interrogate the store. It supplies questions, not',
        'conclusions: do not adopt its author\'s positions, and respect its own',
        'statement of what does not transfer. Say in the Executive Summary that the',
        'lens was applied, and attribute to it any conclusion reached through it.',
      ].join('\n'),
      strategy,
      '---',
    ]
    : []),
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
    'Relating evidence to themes: a filing is a fact about a company, so rows in',
    'sources.csv carry an asset_id and usually no theme_id. Do not read an empty',
    'theme_id as "no theme-level evidence". Join through asset_themes.csv, which maps',
    'each asset to the themes it expresses, and attribute the evidence to those themes.',
    'Only macro and industry-level sources carry a theme_id directly.',
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
