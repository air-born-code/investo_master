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
import { formatValue, rangeSummary, sparkline } from './lib/chart.mjs';

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
  'sections.csv',
  'themes.csv',
  'asset_themes.csv',
  // Reader comments on issues already sent. First in the list after the taxonomy
  // because answering them outranks everything else the draft does: an issue that
  // ignores last week's question is worse than one that says nothing new.
  'issue_comments.csv',
  // Section-level structure. The value-chain and rails taxonomies are what let the
  // draft write about a layer rather than only about a company, and the two pool
  // series are what stop each week's section being re-argued from scratch.
  'ai_value_chain.csv',
  'ai_profit_pool.csv',
  'crypto_rails.csv',
  'agent_traffic.csv',
  'growth_estimates.csv',
  'weekly_metrics.csv',
  'macro.csv',
  'macro_series.csv',
  'macro_history.csv',
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

// macro_history.csv holds a decade of monthly observations per series — 600 rows and
// growing. Sending it raw would spend a large share of the prompt on numbers the model
// should not be restating anyway. What the narrative actually needs is trajectory: the
// direction over three and twelve months, where the reading sits against its own decade,
// and the shape. So the history arrives summarised.
//
// The sparkline is rendered by the same function the issue uses, so the model is looking
// at the same shape the reader will see rather than a separate description of it.
const summariseHistory = async (text) => {
  const [header, ...body] = parseCsv(text);
  const col = Object.fromEntries(header.map((k, i) => [k, i]));
  const specs = parseCsv(await read('data', 'macro_series.csv').catch(() => ''));
  const specCol = specs.length ? Object.fromEntries(specs[0].map((k, i) => [k, i])) : {};
  const labelFor = new Map(specs.slice(1).map((r) => [r[specCol.series_id], r[specCol.label]]));
  const transformFor = new Map(specs.slice(1).map((r) => [r[specCol.series_id], r[specCol.transform]]));

  const bySeries = new Map();
  for (const row of body) {
    const id = row[col.series_id];
    if (!bySeries.has(id)) bySeries.set(id, []);
    bySeries.get(id).push({
      observation_date: row[col.observation_date],
      value: Number(row[col.value]),
      unit: row[col.unit],
    });
  }

  const lines = [];
  for (const [id, raw] of bySeries) {
    const points = raw.sort((a, b) => a.observation_date.localeCompare(b.observation_date));
    const unit = points.at(-1)?.unit;
    const at = (back) => points.at(-1 - back);

    // On a level series the useful figure is how far it has moved. On a change series
    // — payrolls, say — the difference between this month's change and the change three
    // months ago is a second difference, which is noise wearing the costume of a trend.
    // There the useful figure is the mean of the change over the window, which is also
    // what the series' own caveat in the registry points the reader toward.
    const isChangeSeries = transformFor.get(id) === 'mom_change';
    const pp = unit === 'percent' || unit === 'percent_yoy' ? 'pp' : '';
    const move = (back) => {
      const then = at(back);
      const now = at(0);
      if (!then || !now) return 'n/a';
      const d = now.value - then.value;
      return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(2)}${pp}`;
    };
    const mean = (back) => {
      const window = points.slice(-back);
      if (!window.length) return 'n/a';
      const avg = window.reduce((sum, p) => sum + p.value, 0) / window.length;
      return formatValue(avg, unit);
    };

    const trend = isChangeSeries
      ? `3-month mean ${mean(3)} · 12-month mean ${mean(12)}`
      : `3-month change ${move(3)} · 12-month change ${move(12)}`;

    lines.push([
      `${id} (${labelFor.get(id) ?? id})`,
      `  window ${points[0].observation_date} → ${points.at(-1).observation_date} (${points.length} monthly observations)`,
      `  latest ${formatValue(at(0)?.value, unit)} · ${trend}`,
      `  ${rangeSummary(points, unit)}`,
      `  shape  ${sparkline(points, 58, { unit })}`,
    ].join('\n'));
  }

  return `${lines.join('\n\n')}\n\`\`\`\n\nThis is a summary, not the raw table. The full monthly history is in the store; ask for a specific series if a month-by-month figure matters. Do not restate these levels in the narrative — the issue renders them as a board above your text.`;
};

const store = (await Promise.all(
  dataFiles.map(async (name) => {
    try {
      const text = (await read('data', name)).trim();
      if (name === 'sources.csv') {
        return `### data/${name}\n\n\`\`\`csv\n${await trimSources(text)}`;
      }
      if (name === 'macro_history.csv') {
        return `### data/${name} (summarised)\n\n\`\`\`\n${await summariseHistory(text)}`;
      }
      return `### data/${name}\n\n\`\`\`csv\n${text}\n\`\`\``;
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
    '',
    'Sections: sections.csv is the top level of the taxonomy and themes.csv now carries',
    'a section_id. Write the Structural Change Radar section by section. Electricity is',
    'a LAYER of the AI section, never a peer of it — the returns available to a turbine',
    'or switchgear maker depend on the chain above them, which decides how much money',
    'reaches that layer at all.',
    '',
    'ai_value_chain.csv carries the profit-per-dollar benchmark for each layer of the AI',
    'chain. Those cents are one third-party estimate on ONE date with no published',
    'methodology. Cite them as a benchmark, attributed and dated; never as measurement,',
    'and never build an argument that needs them to be precise. ai_profit_pool.csv is',
    'the weekly series of OUR position by layer — that is the part that moves and the',
    'part worth writing about. One observation is not a trend; say so until there are',
    'several.',
    '',
    'agent_traffic.csv holds the digital-assets series. Any row whose data_quality',
    'begins with "UNVERIFIED" is a second-hand report of a management statement: it may',
    'be named as a claim, with attribution, and never used as evidence for a conclusion.',
    'That section holds zero tracked names, which is a finding to report, not a gap to',
    'write around.',
    '',
    'READER COMMENTS — do this before anything else.',
    '',
    'issue_comments.csv holds comments the reader left on issues already sent. Every row',
    'with status "open" is an unanswered question from a real person who read the last',
    'issue, and answering them is the highest-priority work in this draft. Open the issue',
    'with a section titled "Answering last week" that takes each open comment in turn,',
    'quotes it, and responds to the thing actually asked.',
    '',
    'How to answer one:',
    '- Answer from the store. If the CSVs contain the answer, give it with the figures.',
    '- If they do not, say so plainly, name what would settle it, and add it to the',
    '  Research Queue. An honest "we do not know, here is how we would find out" is a',
    '  complete answer; a plausible-sounding one assembled from nothing is not.',
    '- If the comment identifies a mistake, say it was a mistake, in those words. Do not',
    '  soften it, and do not quietly correct the record without acknowledging it.',
    '- If the comment disputes a judgement rather than a fact, engage with the argument.',
    '  Changing position because the reader pushed back is fine when the argument is good',
    '  and is not fine when it is only forceful; say which is happening.',
    '',
    'Never mark a comment addressed yourself — that is a human step, and a comment stays',
    'open until it is done. Do not silently drop a comment you cannot answer: an open',
    'comment carried forward with a reason is the correct output. If there are no open',
    'comments, omit the section entirely rather than writing that there was nothing.',
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

// Writes the assembled prompt to a file instead of calling the API, so the same
// prompt can be run by hand — in Claude Code or anywhere else — at no metered
// cost. Useful for iterating on prompt wording, where paying per attempt is
// wasteful, and it keeps one source of truth for what the prompt actually is.
if (args.includes('--emit-prompt')) {
  const target = flag('emit-prompt')?.startsWith('--') ? undefined : flag('emit-prompt');
  const out = path.resolve(target ?? path.join(root, 'drafts', `${weekId}.prompt.md`));
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${system}\n\n---\n\n${userTurn}\n`, 'utf8');
  const shown = out.startsWith(root + path.sep) ? path.relative(root, out) : out;
  console.log(`Wrote ${shown}`);
  console.log(`  ${(system.length + userTurn.length).toLocaleString()} chars`);
  console.log(`  Run it by hand, save the result to drafts/${weekId}.md, then build as usual.`);
  process.exit(0);
}

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
