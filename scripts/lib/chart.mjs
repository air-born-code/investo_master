// Email-safe charts for the regime board.
//
// One implementation, used by the issue builder, the archival report and the site,
// so the three can never draw the same series differently.
//
// Constraint that shapes everything here: Gmail strips <svg>, external images,
// <canvas>, <style> blocks and CSS classes. What survives is a table with
// background colours and explicit pixel heights. So a column chart is built as one
// <td> per observation with valign and a coloured <div> of computed height. It is
// not elegant, but it renders in the client the reader actually uses, and it needs
// no build step, no asset hosting and no JavaScript.
//
// Scaling honesty: a ten-year window covering 2020 contains observations that are
// real but many multiples of everything else — US payrolls fell 20,469,000 in a
// single month, and plotting that to scale reduces the other 119 months to a flat
// line. Rather than silently truncate the window or quietly cap the axis, the plot
// range is set from a robust percentile band, columns outside it are drawn in a
// distinct colour, and every clipped observation is named in the caption. The
// reader is told what was cut and what its value was.

const DEFAULTS = {
  height: 64,
  fill: '#9fb4cc',
  accent: '#13263d',
  clipped: '#c08a3e',
  axis: '#7b8792',
  zero: '#c9c6bc',
  clipBand: 0.02,
  maxColumns: Infinity,
};

/**
 * Reduce a series to at most `maxColumns` by averaging contiguous buckets.
 *
 * This exists for a hard reason: Gmail clips a message at roughly 102KB, and one
 * <td> per month for five ten-year series does not fit. Averaging is used rather
 * than sampling because dropping months would let a spike disappear depending on
 * which month it landed in, whereas a mean always carries it.
 *
 * The most recent observation is always its own bucket, so the newest column is the
 * real latest figure and matches the headline number beside it.
 */
export const downsample = (series, maxColumns) => {
  if (!Number.isFinite(maxColumns) || series.length <= maxColumns || maxColumns < 2) {
    return { points: series, bucketSize: 1 };
  }
  const head = series.slice(0, -1);
  const tail = series[series.length - 1];
  const buckets = maxColumns - 1;
  const size = Math.ceil(head.length / buckets);
  const points = [];
  for (let i = 0; i < head.length; i += size) {
    const slice = head.slice(i, i + size);
    points.push({
      date: slice[slice.length - 1].date,
      from: slice[0].date,
      value: slice.reduce((sum, p) => sum + p.value, 0) / slice.length,
    });
  }
  points.push(tail);
  return { points, bucketSize: size };
};

// Applied to every plot cell. Short on purpose — it is repeated once per column.
//
// vertical-align has to be set in the style attribute and not left to valign="…":
// a CSS rule such as the site's `td { vertical-align: top }` beats the presentational
// attribute, which silently hangs every bar from the top and renders the chart upside
// down. The attribute is still emitted for the email clients that only honour it.
const CELL = 'padding:0;border:0';
const cellStyle = (align) => `${CELL};vertical-align:${align}`;

// The chart has to look the same wherever it is pasted, including inside a page
// whose stylesheet gives every table a border, a background and a radius. Resetting
// here rather than adding an override rule to each host keeps the module portable.
const TABLE_RESET = 'border:0;background:none;border-radius:0;border-collapse:collapse';

const quantile = (sorted, p) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

const round = (n, dp = 1) => Number(n.toFixed(dp));

/**
 * Derive everything the renderers need from a series, including which observations
 * fall outside the plotted band. Exported so the plain-text edition and the caption
 * are computed from the same numbers as the graphic.
 *
 * @param {{observation_date: string, value: number|string}[]} points  oldest first
 */
export const describeSeries = (points, options = {}) => {
  const { clipBand } = { ...DEFAULTS, ...options };
  const series = points
    .map((p) => ({ date: p.observation_date, value: Number(p.value) }))
    .filter((p) => Number.isFinite(p.value));

  if (!series.length) return undefined;

  const sorted = series.map((p) => p.value).sort((a, b) => a - b);
  const trueMin = sorted[0];
  const trueMax = sorted[sorted.length - 1];
  const latest = series[series.length - 1];

  // The band is robust to outliers, but the most recent observation is never
  // allowed to be the thing that gets clipped — it is the headline number.
  let lo = Math.min(quantile(sorted, clipBand), latest.value);
  let hi = Math.max(quantile(sorted, 1 - clipBand), latest.value);

  // A series that never goes negative is plotted from zero, so the eye reads the
  // level rather than a magnified slice of it. A series that does cross zero keeps
  // its own floor, because for a change series the sign is the whole point.
  if (lo > 0 && trueMin >= 0) lo = 0;
  if (hi < 0 && trueMax <= 0) hi = 0;
  if (hi === lo) hi = lo + 1;

  const clipped = series.filter((p) => p.value < lo || p.value > hi);

  const extremes = {
    min: series.find((p) => p.value === trueMin),
    max: series.find((p) => p.value === trueMax),
  };

  return {
    series,
    latest,
    first: series[0],
    plotMin: round(lo, 2),
    plotMax: round(hi, 2),
    trueMin,
    trueMax,
    extremes,
    clipped,
    hasNegative: lo < 0,
  };
};

// --- formatting ---------------------------------------------------------------
export const formatValue = (value, unit) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  // A thousands-count is never meaningfully fractional, and an axis bound derived
  // from a percentile otherwise reads as "−173.98k", which implies a precision the
  // figure does not have.
  if (unit === 'thousands_change') {
    return `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n)).toLocaleString()}k`;
  }
  if (unit === 'percent' || unit === 'percent_yoy') return `${n}%`;
  return String(n);
};

const yearOf = (iso) => iso.slice(0, 4);

const monthLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
  month: 'short', year: 'numeric', timeZone: 'UTC',
});

// --- HTML ---------------------------------------------------------------------
/**
 * A column chart that survives Gmail. Returns an HTML string, or '' when there is
 * nothing plottable — an empty string is preferable to a chart frame with no data,
 * which would imply the series was flat rather than absent.
 */
export const columnChart = (points, options = {}) => {
  const opts = { ...DEFAULTS, ...options };
  const full = describeSeries(points, opts);
  if (!full || full.series.length < 2) return '';

  // The vertical band is always derived from the full monthly series, never from the
  // downsampled one. Two reasons. A percentile band over 30 aggregated columns barely
  // clips anything, so the 2020 outliers would swallow the scale again in exactly the
  // edition that needed protecting. And deriving it from the full series keeps the
  // email and the archive on an identical y-axis, so the same series cannot appear to
  // have a different shape in the two places it is published.
  const { plotMin, plotMax, hasNegative, latest, clipped } = full;
  const { points: series, bucketSize } = downsample(full.series, opts.maxColumns);
  const span = plotMax - plotMin;

  // Split the pixel budget between the positive and negative halves in proportion
  // to how far the plotted range extends either side of zero.
  const posShare = hasNegative ? Math.max(0, plotMax) / span : 1;
  const posHeight = Math.round(opts.height * posShare);
  const negHeight = opts.height - posHeight;

  // Kept deliberately terse. Every character here is multiplied by the column count
  // and then by the series count, and the total has to stay under Gmail's clip limit.
  const bar = (px, colour) =>
    `<div style="height:${Math.max(px, 0)}px;background:${colour}"></div>`;

  const cellsFor = (half) => series.map((p, i) => {
    const isLast = i === series.length - 1;
    const clippedHigh = p.value > plotMax;
    const clippedLow = p.value < plotMin;
    const colour = clippedHigh || clippedLow
      ? opts.clipped
      : (isLast ? opts.accent : opts.fill);

    const value = Math.min(Math.max(p.value, plotMin), plotMax);
    let px = 0;
    if (half === 'positive') {
      px = value > 0 ? Math.round((Math.min(value, plotMax) / Math.max(plotMax, 1e-9)) * posHeight) : 0;
      // Keep a hairline for a genuinely tiny positive reading, so "almost zero"
      // and "no data" do not look the same.
      if (value > 0 && px < 1) px = 1;
    } else {
      px = value < 0 ? Math.round((Math.abs(Math.max(value, plotMin)) / Math.abs(Math.min(plotMin, -1e-9))) * negHeight) : 0;
      if (value < 0 && px < 1) px = 1;
    }
    const align = half === 'positive' ? 'bottom' : 'top';
    // padding and border are reset inline on every cell, not left to cellpadding="0".
    // A host stylesheet with a global `td { padding: … }` rule — the site has one —
    // otherwise eats the entire width of a 2px column and the chart renders blank.
    return `<td valign="${align}" style="${cellStyle(align)}">${px ? bar(px, colour) : ''}</td>`;
  }).join('');

  // font-size and line-height are zeroed once on the table and inherited, so an
  // empty cell cannot collapse and inter-cell whitespace cannot add stray pixels.
  const plot =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;width:100%;font-size:0;line-height:0;${TABLE_RESET}">` +
    `<tr style="height:${posHeight}px;">${cellsFor('positive')}</tr>` +
    (hasNegative
      ? `<tr><td colspan="${series.length}" style="${CELL}">` +
        `<div style="height:1px;background:${opts.zero}"></div></td></tr>` +
        `<tr style="height:${negHeight}px;">${cellsFor('negative')}</tr>`
      : '') +
    `</table>`;

  // Axis: first year, last year, and the plotted band. Deliberately sparse — a
  // dense axis inside a 660px email column becomes unreadable before it becomes
  // informative.
  const resolution = bucketSize > 1 ? `${bucketSize}-month means` : 'monthly';
  const cell = `${CELL};color:${opts.axis};font-size:9px;line-height:12px;`;
  const axis =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:5px;${TABLE_RESET}">` +
    `<tr>` +
    `<td style="${cell}">${yearOf(full.first.date)}</td>` +
    `<td align="center" style="${cell}">` +
    `${formatValue(plotMin, opts.unit)} – ${formatValue(plotMax, opts.unit)} plotted · ${resolution}</td>` +
    `<td align="right" style="${cell}">${monthLabel(latest.date)}</td>` +
    `</tr></table>`;

  return `<div>${plot}${axis}${clipNote({ clipped }, opts.unit, opts)}</div>`;
};

/**
 * Names every observation the plot could not show to scale. Returns '' when the
 * whole series fits, which is the common case.
 */
export const clipNote = (described, unit, options = {}) => {
  const opts = { ...DEFAULTS, ...options };
  if (!described?.clipped.length) return '';
  const listed = described.clipped
    .map((p) => `${monthLabel(p.date)} ${formatValue(p.value, unit)}`)
    .join(', ');
  return `<div style="color:${opts.clipped};font-size:9px;line-height:13px;margin-top:3px;">` +
    `Clipped to keep the rest of the decade readable: ${listed}.</div>`;
};

// --- plain text ---------------------------------------------------------------
const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * A sparkline for the text/plain edition. Downsampled by averaging rather than by
 * dropping observations, so a spike cannot vanish because it landed on an odd month.
 */
export const sparkline = (points, width = 60, options = {}) => {
  const described = describeSeries(points, options);
  if (!described || described.series.length < 2) return '';
  const { series, plotMin, plotMax } = described;

  const buckets = [];
  for (let i = 0; i < width; i += 1) {
    const from = Math.floor((i * series.length) / width);
    const to = Math.max(from + 1, Math.floor(((i + 1) * series.length) / width));
    const slice = series.slice(from, to);
    buckets.push(slice.reduce((sum, p) => sum + p.value, 0) / slice.length);
  }

  const span = plotMax - plotMin || 1;
  return buckets.map((v) => {
    const clamped = Math.min(Math.max(v, plotMin), plotMax);
    const idx = Math.min(BLOCKS.length - 1, Math.max(0, Math.round(((clamped - plotMin) / span) * (BLOCKS.length - 1))));
    return BLOCKS[idx];
  }).join('');
};

/**
 * One line of context: the window and its extremes, with dates.
 *
 * Deliberately excludes the current reading. Every call site — the board row, the
 * markdown table, the text digest, the site card, the draft prompt summary — already
 * renders the latest value immediately adjacent, so including it here printed the
 * same figure twice in the same line of sight and made the issue look like it was
 * repeating itself. This is context for a number shown elsewhere, not a restatement
 * of it.
 */
export const rangeSummary = (points, unit, options = {}) => {
  const described = describeSeries(points, options);
  if (!described) return '';
  const { extremes, first, latest } = described;
  return [
    `${yearOf(first.date)}–${yearOf(latest.date)}`,
    `low ${formatValue(described.trueMin, unit)} (${monthLabel(extremes.min.date)})`,
    `high ${formatValue(described.trueMax, unit)} (${monthLabel(extremes.max.date)})`,
  ].join(' · ');
};

export { monthLabel };
