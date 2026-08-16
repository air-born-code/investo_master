// What an edition cost to produce, recorded per model call.
//
// An edition is not one API call. It is a draft, a committee panel of three or four
// seats, and whatever midweek deep dives ran that week — so the only honest total is
// a sum over a ledger, and the only way to know which part is expensive is to record
// the stage alongside the money.
//
// The figure is METERED, never derived. OpenRouter returns the actual charge for a
// call in `usage.cost` when the request asks for it, and that is the only number
// written here. Multiplying tokens by a price from a rate card would produce a
// number that looks the same and quietly drifts whenever a price changes, a request
// is cached, or a provider is swapped underneath the slug. When a call comes back
// with no cost, the row is written with an empty cost and `unpriced`, and the issue
// says so — the same discipline the crypto ingestion uses when an API is unreachable:
// leave the gap visible rather than filling it with an estimate.
//
// This ledger is operational telemetry, not research memory. No prompt reads it, it
// is absent from every consumer's file list, and nothing in it may be cited as
// evidence in an issue.

import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';

export const COST_HEADER = [
  'week_id', 'stage', 'model', 'prompt_tokens', 'completion_tokens',
  'reasoning_tokens', 'cost_usd', 'pricing', 'recorded_at',
];

const cell = (v) => (/[",\n\r]/.test(String(v ?? ''))
  ? `"${String(v).replaceAll('"', '""')}"`
  : String(v ?? ''));

export const costPath = (root) => path.join(root, 'data', 'model_costs.csv');

// Midweek runs have no week of their own to declare, but their spend still belongs
// to an edition — the one being prepared. Attributing by the calendar week the call
// was made keeps every row assignable without asking each script to reason about it.
export const currentWeekId = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

// OpenRouter nests reasoning tokens under completion_tokens_details on some models
// and omits the block entirely on others. Reported separately because reasoning is
// billed as completion and is the single largest lever on what a run costs: an
// effort setting that doubles the thinking doubles most of the bill.
const reasoningTokens = (usage) =>
  usage?.completion_tokens_details?.reasoning_tokens ?? '';

export const recordCost = async ({ root, weekId, stage, model, usage }) => {
  const priced = typeof usage?.cost === 'number';
  const row = {
    week_id: weekId,
    stage,
    model,
    prompt_tokens: usage?.prompt_tokens ?? '',
    completion_tokens: usage?.completion_tokens ?? '',
    reasoning_tokens: reasoningTokens(usage),
    cost_usd: priced ? usage.cost : '',
    pricing: priced ? 'metered' : 'unpriced',
    recorded_at: new Date().toISOString(),
  };

  let existing = '';
  try {
    existing = await readFile(costPath(root), 'utf8');
  } catch { /* first call of the project writes the header below */ }

  const line = `${COST_HEADER.map((h) => cell(row[h])).join(',')}\n`;
  await appendFile(costPath(root), existing ? line : `${COST_HEADER.join(',')}\n${line}`, 'utf8');
  return row;
};

// Parsed rows in, one week's picture out. Pure, so the issue builder and any later
// consumer cannot disagree about what a week cost.
export const summariseWeek = (rows, weekId) => {
  const week = rows.filter((r) => r.week_id === weekId);
  const priced = week.filter((r) => r.pricing === 'metered');

  const byStage = new Map();
  for (const r of week) {
    // Every seat of a panel is its own call; they are summed under one label so the
    // reader sees "committee review" as a line item rather than four of them.
    const label = r.stage.includes(':') ? r.stage.split(':')[0] : r.stage;
    const held = byStage.get(label) ?? { calls: 0, cost: 0, unpriced: 0 };
    held.calls += 1;
    if (r.pricing === 'metered') held.cost += Number(r.cost_usd);
    else held.unpriced += 1;
    byStage.set(label, held);
  }

  return {
    weekId,
    calls: week.length,
    unpriced: week.length - priced.length,
    total: priced.reduce((sum, r) => sum + Number(r.cost_usd), 0),
    models: [...new Set(week.map((r) => r.model))].sort(),
    byStage: [...byStage.entries()]
      .map(([stage, v]) => ({ stage, ...v }))
      .sort((a, b) => b.cost - a.cost),
  };
};

// Sub-cent totals are normal on a cheap model, and rounding them to "$0.00" would
// read as "this was free" rather than "this was very cheap".
export const formatUsd = (n) => {
  if (!Number.isFinite(n)) return 'n/a';
  if (n === 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
};

// One line for the top of an issue. Returns null when the week has no rows at all,
// so an edition built before this ledger existed prints nothing rather than "$0.00",
// which would be a false claim about a week that genuinely cost money.
export const describeCost = (summary) => {
  if (!summary.calls) return null;
  const parts = summary.byStage
    .filter((s) => s.cost > 0)
    .map((s) => `${s.stage} ${formatUsd(s.cost)}`);
  const gap = summary.unpriced
    ? ` ${summary.unpriced} of ${summary.calls} calls returned no cost and are excluded.`
    : '';
  return `${formatUsd(summary.total)} across ${summary.calls} model call`
    + `${summary.calls === 1 ? '' : 's'}`
    + `${parts.length ? ` — ${parts.join(', ')}` : ''}.${gap}`;
};
