import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());
const reportDir = path.join(root, 'reports', '2026', '2026-W29-issue-001');
const meta = JSON.parse(await readFile(path.join(reportDir, 'report.json'), 'utf8'));

const e = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const pill = (text, bg = '#e7ede8', color = '#26533a') => `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${bg};color:${color};font-size:10px;line-height:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${e(text)}</span>`;
const label = (text) => `<div style="color:#527095;font-size:10px;line-height:15px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin-bottom:11px;">${e(text)}</div>`;
const rule = '<div style="height:1px;background:#d9d7cf;margin:30px 0;"></div>';
const source = (text, url) => `<a href="${e(url)}" style="color:#2e5f8f;text-decoration:underline;">${e(text)}</a>`;

const signals = [
  ['01', 'Electricity has changed regime', 'The IEA forecasts 3.6% annual global demand growth through 2030; data centres drive roughly half of the expected US increase.'],
  ['02', 'Orders prove the physical bottleneck', 'GE Vernova booked $2.4B of Q1 data-centre electrification orders; Vertiv expects 29%–31% organic growth in 2026.'],
  ['03', 'Recognition is the problem', 'The obvious winners already carry market values of roughly $284B for GE Vernova and $113B for Vertiv.'],
  ['04', 'Space underwriting has changed', 'Rocket Lab’s proposed Iridium acquisition adds scarce spectrum and recurring services—and material financing and integration risk.'],
  ['05', 'Rare-earth economics are policy-linked', 'MP Materials is scaling a US mine-to-magnet chain, but Q1 included $42.3M of government price-protection income.'],
];

const candidates = [
  ['GEV', 'GE Vernova', 'Watchlist', 78, 'Scarce generation, grid-equipment and service platform.', '$18.3B Q1 orders · $163B backlog · 100 GW gas backlog and reservations.', 'Wind losses and a roughly $284B market value leave little room for ordinary execution.', 'Q2 backlog margin and data-centre order composition.'],
  ['VRT', 'Vertiv', 'Watchlist', 78, 'Direct supplier of power and thermal infrastructure inside dense data centres.', 'Q1 sales +30% · adjusted margin 20.8% · 2026 organic guide +29%–31%.', 'Approximately 51× the 2026 free-cash-flow midpoint; cancellation and capacity risks matter.', 'Book-to-bill, cancellations, backlog and capacity-ramp evidence.'],
  ['CRDO', 'Credo', 'Researching', 73, 'Efficient, high-speed connectivity is a real constraint in scale-out AI.', 'FY26 revenue $1.335B, up ~206% · Q4 gross margin 68.2% · operating cash flow $464M.', 'Two customers were 81% of revenue; SBC was $182.6M; valuation was near 29× sales.', 'Customer and product diversification before leading deployments normalise.'],
  ['RKLB', 'Rocket Lab', 'Researching', 72, 'Iridium could turn launch and manufacturing into an end-to-end space platform.', 'Q1 revenue +63.5% · $2.2B backlog · Iridium adds 2.55M subscribers and L-band spectrum.', '$3.6B bridge commitment, stock issuance, integration, approvals and unproven Neutron.', 'Form S-4, permanent financing, pro-forma share count and Neutron milestones.'],
  ['MP', 'MP Materials', 'Researching', 72, 'One of few scaled mine-to-magnet rare-earth chains outside China.', 'NdPr production +63% · sales +117% · magnetics revenue $21.1M · $1.74B liquidity.', 'Price-protection income was nearly half reported revenue; magnet scale-up remains unproven.', '10X returns, Independence yields, qualification and ex-support economics.'],
];

const card = ([ticker, name, stage, score, thesis, proof, risk, next]) => `
  <div style="background:#fff;border:1px solid #dedbd2;border-radius:13px;padding:19px;margin:0 0 13px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
      <td valign="top"><div style="color:#13263d;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:27px;">${e(name)} <span style="font-family:Arial,sans-serif;color:#73879a;font-size:11px;font-weight:800;letter-spacing:.08em;">${e(ticker)}</span></div><div style="margin-top:7px;">${pill(stage, stage === 'Watchlist' ? '#e8eef5' : '#f5ead2', stage === 'Watchlist' ? '#355d82' : '#6a4a0e')}</div></td>
      <td width="62" align="right" valign="top"><div style="color:${score >= 75 ? '#2f6f54' : '#9a6b18'};font-size:25px;font-weight:800;">${score}</div><div style="color:#82909d;font-size:9px;letter-spacing:.1em;text-transform:uppercase;">score</div></td>
    </tr></table>
    <p style="margin:14px 0 10px;color:#263849;font-size:14px;line-height:23px;"><strong>Why it matters:</strong> ${e(thesis)}</p>
    <p style="margin:0 0 7px;color:#52606d;font-size:12px;line-height:20px;"><strong style="color:#2f6f54;">Evidence:</strong> ${e(proof)}</p>
    <p style="margin:0 0 7px;color:#52606d;font-size:12px;line-height:20px;"><strong style="color:#9a413b;">Counterevidence:</strong> ${e(risk)}</p>
    <p style="margin:0;color:#52606d;font-size:12px;line-height:20px;"><strong style="color:#355d82;">Next test:</strong> ${e(next)}</p>
  </div>`;

const body = `
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Strong structural signals, five research candidates, and no action.</div>
<div style="background:#13263d;padding:38px 34px 34px;border-radius:18px 18px 0 0;">
  <div style="color:#8fc3ff;font-size:11px;font-weight:800;letter-spacing:.17em;text-transform:uppercase;margin-bottom:18px;">Investo Master · Weekly Overview</div>
  <h1 style="margin:0 0 12px;color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:42px;font-weight:500;">Issue ${e(meta.issue)}: ${e(meta.edition)}</h1>
  <p style="margin:0;color:#c9d3df;font-size:13px;line-height:22px;">Week ${e(meta.week_id)} · 18 July 2026 · Wide scan · Cut-off 23:00 CEST</p>
</div>
<div style="padding:32px 34px;background:#f7f4ec;">
  <div style="margin-bottom:16px;">${pill(meta.action_posture)}</div>
  <h2 style="margin:0 0 12px;color:#13263d;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:34px;font-weight:500;">The structural changes are real. The obvious prices already know.</h2>
  <p style="margin:0;color:#354252;font-size:16px;line-height:27px;">Week 1 finds measurable acceleration in electricity infrastructure, AI connectivity, space consolidation and rare-earth diversification. Five companies merit continued research. None has earned a purchase decision.</p>
  ${rule}${label('Executive signal')}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${signals.map(([n, title, text]) => `<tr><td width="38" valign="top" style="padding:14px 0;border-top:1px solid #d9d7cf;color:#527095;font-size:12px;font-weight:800;">${n}</td><td style="padding:14px 0;border-top:1px solid #d9d7cf;"><div style="color:#13263d;font-size:14px;line-height:21px;font-weight:800;">${e(title)}</div><div style="color:#596675;font-size:12px;line-height:20px;margin-top:3px;">${e(text)}</div></td></tr>`).join('')}</table>
  ${rule}${label('Regime board')}
  <h2 style="margin:0 0 16px;color:#13263d;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;">Growth inside a non-zero cost of capital</h2>
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #dedbd2;border-radius:12px;overflow:hidden;">${[
    ['Fed funds', '3.50%–3.75%', 'Capital is not free'], ['US headline / core CPI', '3.5% / 2.6%', 'Inflation is cooler, not gone'], ['Unemployment / June payrolls', '4.2% / +57k', 'Labour is softer'], ['Global electricity demand', '+3.6% p.a.', 'IEA 2026–2030'], ['US electricity demand', 'Nearly +2% p.a.', 'About half from data centres'],
  ].map(([name, value, note], i) => `<tr><td style="padding:12px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#52606d;font-size:11px;">${e(name)}</td><td align="right" style="padding:12px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#13263d;font-size:13px;font-weight:800;">${e(value)}</td><td align="right" style="padding:12px;${i ? 'border-top:1px solid #e5e1d8;' : ''}color:#7b8792;font-size:10px;">${e(note)}</td></tr>`).join('')}</table>
  ${rule}${label('Conviction board')}
  <h2 style="margin:0 0 7px;color:#13263d;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;">Five candidates. Zero purchases.</h2>
  <p style="margin:0 0 18px;color:#596675;font-size:13px;line-height:22px;">Scores prioritise research. They cannot override valuation, incomplete evidence or a fatal flaw.</p>
${candidates.map(card).join('')}
  ${rule}${label('What changed our mind')}
  <div style="background:#e8eef5;border-left:4px solid #527095;padding:19px;border-radius:0 10px 10px 0;margin-bottom:13px;"><div style="color:#203a58;font-size:14px;font-weight:800;margin-bottom:6px;">Rocket Lab is no longer a launch-company thesis.</div><p style="margin:0;color:#35506b;font-size:12px;line-height:21px;">Iridium adds spectrum, subscribers and recurring services. Financing and per-share value now matter more than the strategic headline.</p></div>
  <div style="background:#f2eadb;border-left:4px solid #ad7a25;padding:19px;border-radius:0 10px 10px 0;"><div style="color:#604716;font-size:14px;font-weight:800;margin-bottom:6px;">MP Materials is a public-private economic system.</div><p style="margin:0;color:#675735;font-size:12px;line-height:21px;">Government support reduces commodity downside and enables capacity, but commercial economics must be separated from support payments.</p></div>
  ${rule}${label('Research queue')}
  <ol style="margin:0;padding-left:20px;color:#354252;font-size:13px;line-height:23px;"><li style="margin-bottom:7px;">Build the Rocket Lab / Iridium per-share financing bridge from the Form S-4.</li><li style="margin-bottom:7px;">Map the AI power chain and find less-recognised bottleneck owners.</li><li style="margin-bottom:7px;">Test whether Credo can diversify its customer base.</li><li style="margin-bottom:7px;">Reconstruct MP’s economics with and without government support.</li><li>Map nuclear fuel conversion, enrichment and qualified components.</li></ol>
  ${rule}${label('Decision')}
  <h2 style="margin:0 0 9px;color:#13263d;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;">No action is the evidence-based result.</h2>
  <p style="margin:0 0 13px;color:#354252;font-size:14px;line-height:24px;">The obvious beneficiaries carry demanding expectations. The less-settled candidates still have material unanswered questions involving concentration, financing, integration, policy support or production scale.</p>
  <p style="margin:0;color:#596675;font-size:11px;line-height:19px;">Primary sources: ${source('IEA Electricity 2026', 'https://www.iea.org/reports/electricity-2026/executive-summary')}, ${source('GE Vernova Q1', 'https://www.gevernova.com/news/press-releases/ge-vernova-reports-first-quarter-2026-financial')}, ${source('Vertiv Q1', 'https://investors.vertiv.com/news/news-details/2026/Vertiv-Reports-Strong-First-Quarter-with-Diluted-EPS-Growth-of-136-Adjusted-Diluted-EPS-Growth-of-83-Raises-Full-Year-Guidance/default.aspx')}, ${source('Credo 10-K', 'https://www.sec.gov/Archives/edgar/data/1807794/000162828026043303/crdo-20260502.htm')}, ${source('Rocket Lab / Iridium 8-K', 'https://www.sec.gov/Archives/edgar/data/1819994/000175392626001085/g085783_8k.htm')}, ${source('MP 10-Q', 'https://www.sec.gov/Archives/edgar/data/1801368/000180136826000029/mp-20260331.htm')}.</p>
</div>
<div style="padding:24px 34px 30px;background:#ede9df;border-radius:0 0 18px 18px;"><p style="margin:0 0 7px;color:#687382;font-size:11px;line-height:18px;">Research and decision support only. No trades, promised returns, or personalised financial, tax or legal advice.</p><p style="margin:0;color:#7a8490;font-size:10px;line-height:17px;">Report ID: ${e(meta.report_id)} · Full claim registry: data/sources.csv</p></div>`;

const doc = (archive = false) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(meta.subject)}</title><style>body{margin:0;background:#e7e5df;-webkit-font-smoothing:antialiased}table{border-collapse:collapse}@media(max-width:680px){.shell{width:100%!important}.outer{padding:0!important}}</style></head><body><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e7e5df;"><tr><td class="outer" align="center" style="padding:${archive ? '42px 16px' : '24px 12px'};"><table class="shell" role="presentation" width="660" cellspacing="0" cellpadding="0" border="0" style="width:660px;max-width:100%;"><tr><td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${body}</td></tr></table></td></tr></table></body></html>`;

const text = `INVESTO MASTER — ISSUE ${meta.issue}: ${meta.edition}\nWeek ${meta.week_id} | 18 July 2026 | Wide scan\nAction: ${meta.action_posture}\n\nTHE STRUCTURAL CHANGES ARE REAL. THE OBVIOUS PRICES ALREADY KNOW.\n\nWeek 1 finds measurable acceleration in electricity infrastructure, AI connectivity, space consolidation and rare-earth diversification. Five companies merit continued research. None has earned a purchase decision.\n\nKEY SIGNALS\n1. IEA global electricity demand forecast: +3.6% annually through 2030.\n2. GE Vernova Q1 data-centre electrification orders: $2.4B.\n3. Vertiv 2026 organic growth guidance: +29%-31%.\n4. Rocket Lab / Iridium adds spectrum and services, plus material financing risk.\n5. MP Q1 included $42.3M of price-protection income.\n\nCONVICTION BOARD\n- GEV — Watchlist — 78\n- VRT — Watchlist — 78\n- CRDO — Researching — 73\n- RKLB — Researching — 72\n- MP — Researching — 72\n\nDECISION\nNo action. Strong themes do not compensate for demanding expectations or incomplete underwriting.\n\nNEXT RESEARCH\n1. Rocket Lab / Iridium financing and per-share bridge.\n2. AI power value-chain map.\n3. Credo customer diversification.\n4. MP support-adjusted economics.\n5. Nuclear fuel-cycle map.\n\nSAFETY BOUNDARY\nResearch only; not personalised advice. The human investor retains responsibility for every decision.\n\nReport ID: ${meta.report_id}\n`;

await Promise.all([
  writeFile(path.join(reportDir, 'email.html'), doc(false), 'utf8'),
  writeFile(path.join(reportDir, 'report.html'), doc(true), 'utf8'),
  writeFile(path.join(reportDir, 'email.txt'), text, 'utf8'),
]);
console.log(`Built ${meta.report_id}`);
