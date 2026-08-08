// Decides which assets appear in an issue, and records what appeared.
//
// The problem this solves: the conviction board renders every scored row, and only
// five assets were ever scored. Every issue since 2026-W29 therefore showed the same
// five names with identical numbers, while 49 universe-tier assets — most never
// examined — appeared nowhere a reader could see them.
//
// Selection here is deterministic and oldest-first, the same principle as
// research-rotation.mjs: an asset cannot be forgotten, and a busy week cannot push
// one permanently to the back. Two runs of the same week pick the same names.
//
// Nothing in this module reads or writes files. It takes parsed rows and returns a
// plan, so the issue builder and the site builder cannot disagree about what a week
// covered.

// --- ISO week arithmetic ------------------------------------------------------
// Jan 4 is always in ISO week 1, so the Monday of week 1 is the Monday of the week
// containing Jan 4. Everything else is a multiple of seven days from there.
export const isoWeekStart = (weekId) => {
  const [year, week] = weekId.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dow + 1 + (week - 1) * 7);
  return monday;
};

export const isoWeekRange = (weekId) => {
  const start = isoWeekStart(weekId);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
};

// Signed, in weeks. Used for staleness, so a wrong sign would understate age.
export const weeksBetween = (fromWeek, toWeek) =>
  Math.round((isoWeekStart(toWeek) - isoWeekStart(fromWeek)) / (7 * 86_400_000));

// --- slots --------------------------------------------------------------------
// core     the candidate tier. Always present, compressed to one line each.
// rotation universe-tier names given real prose this week, oldest-covered first.
// entered  added to the store during this week.
// dropped  stage moved to a terminal value since the last issue.
export const SLOTS = ['core', 'rotation', 'entered', 'dropped'];

const TERMINAL_STAGES = new Set(['dropped', 'exited', 'removed', 'rejected']);

export const DEFAULT_ROTATION_SLOTS = 3;

// Above this many entries in one week, treat the arrival as a bulk screen import
// rather than a set of individual discoveries worth naming one by one.
export const BATCH_ENTRY_THRESHOLD = 8;

// --- selection ----------------------------------------------------------------
// `coverage` is every prior ledger row, including rows for weeks after `weekId`
// when an older week is rebuilt. Rows at or after the target week are ignored so a
// rebuild reproduces what that week actually saw rather than what came later.
export const selectCoverage = ({
  assets,
  scores = [],
  coverage = [],
  weekId,
  rotationSlots = DEFAULT_ROTATION_SLOTS,
  // { asset_id: number } — reviewed source rows per asset, from reviewedEvidence()
  // below. Used only to order names that are otherwise tied; absent, ordering falls
  // back to asset_id and everything else behaves identically.
  evidenceCount = {},
}) => {
  const priorCoverage = coverage.filter((c) => c.week_id < weekId);

  // Latest score per asset, whatever week it was struck in. Carrying a stale score
  // forward is fine as long as the issue says how stale it is, which is why
  // score_week travels with it everywhere below.
  const latestScore = new Map();
  for (const s of scores) {
    const held = latestScore.get(s.asset_id);
    if (!held || s.week_id > held.week_id) latestScore.set(s.asset_id, s);
  }

  // Most recent prior appearance per asset, and the score it carried then. The
  // delta between that and today is the week-on-week movement a reader wants; when
  // it is zero for several weeks running, that is itself the finding.
  //
  // Only core and rotation count as coverage. Entering the store is a database
  // event, not editorial attention — counting it would let a bulk screen import
  // mark fifty names as covered in one week and starve the rotation for months.
  const lastSeen = new Map();
  for (const row of priorCoverage) {
    if (row.slot !== 'core' && row.slot !== 'rotation') continue;
    const held = lastSeen.get(row.asset_id);
    if (!held || row.week_id > held.week_id) lastSeen.set(row.asset_id, row);
  }

  const decorate = (asset) => {
    const score = latestScore.get(asset.asset_id);
    const prior = lastSeen.get(asset.asset_id);
    const priorScore = prior && prior.score !== '' ? Number(prior.score) : undefined;
    const total = score ? Number(score.total_score) : undefined;
    return {
      asset,
      assetId: asset.asset_id,
      symbol: asset.symbol || asset.asset_id.toUpperCase(),
      name: asset.name || asset.asset_id,
      stage: asset.stage || '',
      tier: asset.tier || 'candidate',
      score: total,
      scoreWeek: score?.week_id,
      scoreAgeWeeks: score ? weeksBetween(score.week_id, weekId) : undefined,
      asymmetry: score?.valuation_asymmetry,
      confidence: score?.thesis_confidence,
      uncertainty: score?.most_important_uncertainty,
      checkpoint: score?.next_checkpoint,
      lastCoveredWeek: prior?.week_id,
      weeksSinceCovered: prior ? weeksBetween(prior.week_id, weekId) : undefined,
      delta: total !== undefined && priorScore !== undefined && Number.isFinite(priorScore)
        ? total - priorScore
        : undefined,
      timesCovered: priorCoverage.filter((c) =>
        c.asset_id === asset.asset_id && (c.slot === 'core' || c.slot === 'rotation')).length,
    };
  };

  const core = assets
    .filter((a) => (a.tier || 'candidate') !== 'universe' && !TERMINAL_STAGES.has(a.stage))
    .map(decorate)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.symbol.localeCompare(b.symbol));

  const { start, end } = isoWeekRange(weekId);
  const entered = assets
    .filter((a) => a.added_date >= start && a.added_date <= end)
    .map(decorate)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  // A screen can add fifty names at once. Listing them individually would bury the
  // week's actual research under a directory dump, so past this threshold the issue
  // reports the batch as a batch and the names stay in the rotation queue where
  // they will each get a proper turn.
  const enteredIsBatch = entered.length > BATCH_ENTRY_THRESHOLD;
  const enteredIds = new Set(enteredIsBatch ? [] : entered.map((r) => r.assetId));

  const dropped = assets
    .filter((a) => TERMINAL_STAGES.has(a.stage))
    .map(decorate)
    .filter((r) => !priorCoverage.some((c) => c.asset_id === r.assetId && c.slot === 'dropped'))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  // Rotation queue: never-covered first, then longest-waiting. A name that just
  // entered is already getting its own mention this week, so it does not also take
  // a rotation slot — that would spend two slots on one asset.
  //
  // Within a tie, the name the store knows most about goes first. Without this the
  // queue is alphabetical, and the first months of rotation are spent on whichever
  // names happen to start with A.
  //
  // This must count reviewed evidence, not rows. Ingestion writes one stub per
  // EDGAR filing with the claim left as "contents not yet reviewed", and a company
  // in the middle of a merger files dozens of near-identical 425s in a fortnight.
  // Ranking on raw rows put Dominion first on 54 stubs and no read claim, which is
  // filing volume masquerading as research depth. Callers pass the reviewed count;
  // asset_id still breaks exact ties so the order stays reproducible.
  const queue = assets
    .filter((a) => (a.tier || 'candidate') === 'universe')
    .filter((a) => !TERMINAL_STAGES.has(a.stage))
    .filter((a) => !enteredIds.has(a.asset_id))
    .map(decorate)
    .sort((a, b) =>
      (a.lastCoveredWeek ?? '').localeCompare(b.lastCoveredWeek ?? '')
      || (evidenceCount[b.assetId] ?? 0) - (evidenceCount[a.assetId] ?? 0)
      || a.assetId.localeCompare(b.assetId));

  return {
    core,
    rotation: queue.slice(0, rotationSlots),
    upNext: queue.slice(rotationSlots, rotationSlots + 5),
    entered,
    enteredIsBatch,
    dropped,
    queueDepth: queue.length,
    // How long a full pass through the universe takes at this cadence. If this
    // number climbs, the universe is growing faster than the issue can read it.
    cycleWeeks: rotationSlots > 0 ? Math.ceil(queue.length / rotationSlots) : 0,
  };
};

// --- ledger -------------------------------------------------------------------
export const COVERAGE_HEADER = [
  'week_id', 'report_id', 'asset_id', 'slot', 'score', 'score_week',
  'weeks_since_covered', 'note', 'recorded_at',
];

// One row per asset per slot per week. Rebuilding a week replaces that week's rows
// rather than appending duplicates, so the ledger stays idempotent in the same way
// the issue builder is.
export const coverageRowsFor = ({ plan, weekId, reportId, recordedAt, notes = {} }) => {
  const rows = [];
  const push = (entry, slot) => rows.push({
    week_id: weekId,
    report_id: reportId,
    asset_id: entry.assetId,
    slot,
    score: entry.score ?? '',
    score_week: entry.scoreWeek ?? '',
    weeks_since_covered: entry.weeksSinceCovered ?? '',
    note: notes[entry.assetId] ?? '',
    recorded_at: recordedAt,
  });
  for (const entry of plan.core) push(entry, 'core');
  for (const entry of plan.rotation) push(entry, 'rotation');
  for (const entry of plan.entered) push(entry, 'entered');
  for (const entry of plan.dropped) push(entry, 'dropped');
  return rows;
};

export const mergeCoverage = (existing, fresh, weekId) => [
  ...existing.filter((r) => r.week_id !== weekId),
  ...fresh,
].sort((a, b) =>
  a.week_id.localeCompare(b.week_id)
  || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)
  || a.asset_id.localeCompare(b.asset_id));

// --- evidence -----------------------------------------------------------------
// Ingestion records every filing it discovers, leaving the claim as a placeholder
// until someone reads the document. Those stubs are a worklist, not evidence: they
// say a document exists, not what it says. Anything ranking or describing how much
// the store knows about an asset has to exclude them or it is counting paperwork.
const UNREVIEWED = /not yet reviewed/i;

export const isReviewed = (row) => Boolean(row.claim) && !UNREVIEWED.test(row.claim);

export const reviewedEvidence = (sources) => {
  const counts = {};
  // De-duplicate on URL first. A single filing is occasionally ingested more than
  // once, and a name should not climb the queue because ingestion ran twice.
  const seen = new Set();
  for (const row of sources) {
    if (!isReviewed(row)) continue;
    const key = `${row.asset_id}|${row.url || row.source_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[row.asset_id] = (counts[row.asset_id] ?? 0) + 1;
  }
  return counts;
};

// --- presentation helpers -----------------------------------------------------
export const describeDelta = (delta) => {
  if (delta === undefined) return 'first appearance';
  if (delta === 0) return 'unchanged';
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`;
};

export const describeGap = (entry) => {
  if (entry.weeksSinceCovered === undefined) return 'never covered before';
  if (entry.weeksSinceCovered === 0) return 'covered this week';
  if (entry.weeksSinceCovered === 1) return 'last covered last week';
  return `last covered ${entry.weeksSinceCovered} weeks ago`;
};

// A score struck weeks ago is not a current view. Saying so is the whole point:
// the alternative is a board that looks freshly assessed when it is not.
export const describeStaleness = (entry) => {
  if (entry.score === undefined) return 'not yet scored';
  if (!entry.scoreAgeWeeks) return 'scored this week';
  return `scored ${entry.scoreWeek} · ${entry.scoreAgeWeeks} week${entry.scoreAgeWeeks === 1 ? '' : 's'} old`;
};
