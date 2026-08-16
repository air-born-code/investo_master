// Chooses which committee seats challenge a given week's draft, and renders them
// into the drafting prompt.
//
// data/committee.csv holds review seats distilled from practitioners: the method a
// seat applies, the questions that method asks, what it reliably catches, what does
// not transfer to this file's 5-10 year horizon, and the seat's own blind spot.
//
// Why a panel rather than the whole roster: nineteen seats supply close to sixty
// questions, and a draft that answers sixty questions is a checklist rather than an
// argument. A small panel gets read. The whole file gets skimmed.
//
// Why selection is stateless: draft-issue.mjs never writes to data/*.csv, so there
// is no ledger to record a rotation in — the oldest-first machinery in rotation.mjs
// is not available here. Ordering by member_id and walking a window by absolute
// week number gives every seat a turn on a fixed cycle, reproduces exactly when a
// week is redrafted, and varies the pairings whenever the panel size does not
// divide the roster evenly.
//
// Nothing in this module reads or writes files. It takes parsed rows and returns a
// plan, the same shape as rotation.mjs, so the prompt and any later consumer cannot
// disagree about who sat.

import { isoWeekStart } from './rotation.mjs';

export const DEFAULT_PANEL_SIZE = 4;

// The store separates repeated values inside one cell with a semicolon.
const listOf = (value) => String(value ?? '').split(';').map((s) => s.trim()).filter(Boolean);

// Weeks since the epoch. isoWeekStart returns a UTC Monday, so this increments by
// exactly one per week and keeps counting across a year boundary — which a bare
// week number does not.
const weekIndex = (weekId) => Math.floor(isoWeekStart(weekId).getTime() / (7 * 86_400_000));

// `members` is every row of committee.csv as an object. Seats whose status is not
// `active` are excluded rather than filtered by the caller, so retiring a seat is a
// one-cell edit in the store and needs no code change.
export const selectPanel = ({ members, weekId, size = DEFAULT_PANEL_SIZE, only = [] }) => {
  const active = members.filter((m) => (m.status ?? '').trim() === 'active');

  if (only.length) {
    const wanted = new Set(only);
    const found = active.filter((m) => wanted.has(m.member_id));
    const missing = only.filter((id) => !found.some((m) => m.member_id === id));
    return { seats: found, missing, pinned: true, cycleWeeks: 0 };
  }

  if (!active.length) return { seats: [], missing: [], pinned: false, cycleWeeks: 0 };

  // member_id, not name or added_date: the ids are stable, whereas the whole roster
  // was added on one day and a name change would silently reshuffle the rotation.
  const ordered = [...active].sort((a, b) => a.member_id.localeCompare(b.member_id));
  const panelSize = Math.max(1, Math.min(size, ordered.length));

  const offset = ((weekIndex(weekId) * panelSize) % ordered.length + ordered.length) % ordered.length;
  const seats = Array.from({ length: panelSize }, (_, i) => ordered[(offset + i) % ordered.length]);

  return {
    seats,
    missing: [],
    pinned: false,
    cycleWeeks: Math.ceil(ordered.length / panelSize),
  };
};

// One seat, rendered as instruction. Every field of the row is used: a seat that
// arrives without its blind spot and its non-transferable mechanics is an authority
// to defer to rather than a question to answer, which is the opposite of the point.
const renderSeat = (seat) => {
  const questions = listOf(seat.review_questions);
  const sections = listOf(seat.priority_sections);

  return [
    `**${seat.name} — ${seat.seat}** (\`${seat.member_id}\`, ${seat.discipline})`,
    '',
    `Method: ${seat.method}`,
    '',
    'Asks:',
    ...questions.map((q) => `- ${q}`),
    '',
    `Catches: ${seat.catches}`,
    `Does not transfer: ${seat.does_not_transfer}`,
    `Own blind spot: ${seat.blind_spot}`,
    sections.length ? `Bears on: ${sections.join(', ')}` : 'Bears on: the issue as a whole',
  ].join('\n');
};

// The prompt block. Kept in this module rather than inlined in draft-issue.mjs so
// the wording that governs how a seat is used travels with the selection that put
// it there.
export const renderPanel = ({ seats, weekId, cycleWeeks, pinned }) => {
  if (!seats.length) return null;

  const roll = seats.map((s) => `${s.name} (${s.seat})`).join('; ');

  return [
    `## Committee review — ${weekId}`,
    '',
    'A review committee sits on this issue. These seats are distilled from practitioners',
    'whose reasoning is worth borrowing, and they are here to attack the draft before a',
    'reader does.',
    '',
    pinned
      ? `Seats this week (named explicitly for this issue): ${roll}.`
      : `Seats this week: ${roll}. The panel rotates, so every seat on the roster is heard `
        + `roughly every ${cycleWeeks} weeks. Seats not listed here are not sitting and their `
        + 'questions are not yours to answer this week.',
    '',
    'How a seat is used, and these limits override the seat itself:',
    '',
    '- A seat supplies QUESTIONS, never conclusions. Do not adopt a practitioner\'s',
    '  positions, do not repeat their public views as findings, and never write that a',
    '  seat would approve or reject something.',
    '- Answer the questions inside the numbered sections where they bear, not in a',
    '  separate block of Q&A. A seat that changes a sentence has done its job; a seat',
    '  quoted and then ignored has not.',
    '- Respect "Does not transfer". Those mechanics depend on being a different kind of',
    '  investor — a different horizon, cost of capital, or liquidity — and this file has',
    '  a 5-10 year horizon and no ability to trade around a position.',
    '- Every seat is listed with its own blind spot because a seat is a fallible way of',
    '  looking, not an authority. Where a seat\'s blind spot bears on what it is asking',
    '  this week, say so rather than following the question off a cliff.',
    '- A seat cannot force an action. The evidence rules and the conviction policy',
    '  outrank every question here: if a seat\'s question cannot be answered from the',
    '  store, that is a data gap, not a licence to reason from memory.',
    '- Attribute in the text anything you concluded through a seat, by name.',
    '',
    ...seats.map(renderSeat).flatMap((block) => [block, '']),
    'In section 11 record, briefly: which seats sat, what each one actually changed in',
    'this draft, and any question you could not answer from the store — with that',
    'question repeated in the Research Queue. "This seat changed nothing this week" is a',
    'legitimate and useful entry. Inventing a change so the seat looks productive is not.',
  ].join('\n');
};
