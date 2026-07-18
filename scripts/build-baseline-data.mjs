import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const dataDir = path.join(root, 'data');
await mkdir(dataDir, { recursive: true });

const csv = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const writeCsv = async (name, headers, rows) => {
  const body = [headers, ...rows].map((row) => row.map(csv).join(',')).join('\n') + '\n';
  await writeFile(path.join(dataDir, name), body, 'utf8');
  console.log(`- data/${name}: ${rows.length} rows`);
};

const assets = [
  ['gev', 'GEV', 'GE Vernova', 'equity', 'NYSE', 'United States', 'Industrials', 'Electrical equipment and power systems', 'USD', 'https://www.gevernova.com/investors', 'watchlist', '2026-07-18', '2026-07-18'],
  ['vrt', 'VRT', 'Vertiv Holdings', 'equity', 'NYSE', 'United States', 'Industrials', 'Critical digital infrastructure', 'USD', 'https://investors.vertiv.com/', 'watchlist', '2026-07-18', '2026-07-18'],
  ['crdo', 'CRDO', 'Credo Technology Group', 'equity', 'Nasdaq', 'Cayman Islands', 'Technology', 'Semiconductors and connectivity', 'USD', 'https://investors.credosemi.com/', 'researching', '2026-07-18', '2026-07-18'],
  ['rklb', 'RKLB', 'Rocket Lab', 'equity', 'Nasdaq', 'United States', 'Industrials', 'Aerospace and space systems', 'USD', 'https://investors.rocketlabcorp.com/', 'researching', '2026-07-18', '2026-07-18'],
  ['mp', 'MP', 'MP Materials', 'equity', 'NYSE', 'United States', 'Materials', 'Rare earth mining and magnetics', 'USD', 'https://investors.mpmaterials.com/', 'researching', '2026-07-18', '2026-07-18'],
];

const themes = [
  ['age-of-electricity', 'The Age of Electricity', 'Electricity demand is reaccelerating as compute, cooling, electrification and industrial investment expand load.', 'active', '10+ years', 'high', '2026-07-18', '2026-07-18'],
  ['ai-physical-infrastructure', 'AI Physical Infrastructure', 'Power generation, grids, transformers, switchgear, power management and cooling are becoming constraints on compute deployment.', 'active', '5-10+ years', 'high', '2026-07-18', '2026-07-18'],
  ['high-speed-connectivity', 'High-Speed Compute Connectivity', 'AI clusters require faster and more power-efficient connectivity across copper, optical and semiconductor interconnects.', 'active', '5-10 years', 'medium', '2026-07-18', '2026-07-18'],
  ['vertically-integrated-space', 'Vertically Integrated Space', 'Launch, spacecraft, spectrum and recurring services may consolidate into end-to-end space platforms.', 'active', '10+ years', 'medium', '2026-07-18', '2026-07-18'],
  ['critical-minerals-security', 'Critical Minerals Security', 'Concentrated refining and magnet production create strategic bottlenecks and policy-supported diversification.', 'active', '10+ years', 'high', '2026-07-18', '2026-07-18'],
  ['advanced-nuclear-enablers', 'Advanced Nuclear Enablers', 'Regulatory reform and electricity demand are reopening the reactor and nuclear-fuel-cycle opportunity, but commercial timing remains uncertain.', 'monitoring', '10-20 years', 'medium', '2026-07-18', '2026-07-18'],
];

const assetThemes = [
  ['gev', 'age-of-electricity', 'platform', 'high', 'Generation, grid equipment and installed-base services.', '2026-07-18'],
  ['gev', 'ai-physical-infrastructure', 'enabler', 'high', 'Gas turbines, transformers and electrification systems support new data-centre load.', '2026-07-18'],
  ['vrt', 'ai-physical-infrastructure', 'enabler', 'high', 'Power management, thermal management and deployment infrastructure inside data centres.', '2026-07-18'],
  ['crdo', 'high-speed-connectivity', 'enabler', 'high', 'High-speed, lower-power connectivity for scale-out AI networks.', '2026-07-18'],
  ['rklb', 'vertically-integrated-space', 'platform', 'high', 'Launch and space systems would combine with Iridium spectrum and recurring services if the transaction closes.', '2026-07-18'],
  ['mp', 'critical-minerals-security', 'platform', 'high', 'US mine-to-magnet rare-earth chain with government price and offtake support.', '2026-07-18'],
];

const weeklyMetrics = [
  ['2026-W29', '2026-07-18', 'gev', 1057.84, 'USD', 284270000000, '', '', 0.16, '', '', '', '', 'market_cap_usd', 284270000000, 'mixed: price and market cap are third-party snapshots; operating data are issuer-reported'],
  ['2026-W29', '2026-07-18', 'vrt', 289.56, 'USD', 112970000000, '', '', 0.30, '', 0.166, '', '', 'market_cap_usd', 112970000000, 'mixed: price and market cap are third-party snapshots; operating data are issuer-reported'],
  ['2026-W29', '2026-07-18', 'crdo', 206.00, 'USD', 38410000000, '', 1335116000, 2.057, '', '', '', 1400000000, 'market_cap_usd', 38410000000, 'mixed: 2026-07-16 market snapshot; FY2026 financial data are SEC-filed'],
  ['2026-W29', '2026-07-18', 'rklb', 67.62, 'USD', 42000000000, '', '', 0.635, 0.382, '', '', 1333351000, 'market_cap_usd', 42000000000, 'mixed: market cap is an approximate third-party snapshot; financial data are SEC-filed'],
  ['2026-W29', '2026-07-18', 'mp', 57.55, 'USD', 8090000000, '', '', 0.49, '', '', '', 1738335000, 'market_cap_usd', 8090000000, 'mixed: price and market cap are third-party snapshots; financial data are SEC-filed'],
];

const scores = [
  ['2026-W29', '2026-07-18', 'gev', 15, 13, 9, 8, 12, 9, 7, 1, 4, 78, 'high', 'medium', 'How much of the extraordinary order strength becomes durable high-margin cash flow?', 'Q2 2026 segment orders, backlog margin and data-centre order composition'],
  ['2026-W29', '2026-07-18', 'vrt', 14, 12, 9, 8, 14, 9, 7, 1, 4, 78, 'high', 'medium', 'Can capacity expansion preserve margins and service quality as demand scales?', 'Q2 2026 organic orders, book-to-bill, backlog and cancellation commentary'],
  ['2026-W29', '2026-07-18', 'crdo', 13, 10, 8, 7, 14, 9, 8, 1, 3, 73, 'high', 'low', 'Can customer concentration fall without a material growth or margin reset?', 'Fiscal Q1 2027 customer mix, AEC diversification and share-based compensation'],
  ['2026-W29', '2026-07-18', 'rklb', 15, 10, 8, 9, 9, 7, 10, 1, 3, 72, 'high', 'low', 'Does the Iridium transaction create more per-share value than financing and integration consume?', 'Form S-4, permanent financing plan, Neutron milestones and transaction approvals'],
  ['2026-W29', '2026-07-18', 'mp', 12, 11, 8, 8, 8, 9, 8, 4, 4, 72, 'high', 'medium', 'Can magnetics earn attractive returns beyond government guarantees and price protection?', '10X construction budget, Independence yields, customer qualification and ex-support economics'],
];

const thesisUpdates = [
  ['tu-2026-w29-gev-baseline', '2026-07-18', '2026-W29', 'gev', 'baseline', 'watchlist', 'Power and electrification demand is strongly confirmed; valuation leaves little room for ordinary execution.', 'Q1 orders rose 71% organically and backlog reached $163B.', 'Wind is expected to lose about $400M of segment EBITDA in 2026 and the market cap is roughly $284B.', 'not_tested', 'What portion of data-centre orders is repeatable and what margins are embedded in backlog?', 'Investo Master'],
  ['tu-2026-w29-vrt-baseline', '2026-07-18', '2026-W29', 'vrt', 'baseline', 'watchlist', 'Vertiv is a direct AI infrastructure beneficiary with accelerating sales and cash flow; the present valuation is demanding.', 'Q1 sales rose 30%; full-year organic growth guidance is 29%-31%.', 'Order cancellation, capacity execution and a roughly $113B market value reduce asymmetry.', 'not_tested', 'How durable is the present book-to-bill after customer build plans normalise?', 'Investo Master'],
  ['tu-2026-w29-crdo-baseline', '2026-07-18', '2026-W29', 'crdo', 'baseline', 'researching', 'Credo has outstanding growth and attractive connectivity economics, but its revenue base is unusually concentrated.', 'FY2026 revenue rose to $1.335B and operating cash flow reached $464M.', 'Two customers represented 81% of revenue; share-based compensation was $183M.', 'not_tested', 'Which products and customers can make the growth base genuinely diversified?', 'Investo Master'],
  ['tu-2026-w29-rklb-baseline', '2026-07-18', '2026-W29', 'rklb', 'baseline', 'researching', 'Rocket Lab could become an end-to-end space platform, but the Iridium transaction changes the underwriting problem.', 'Q1 revenue grew 63.5%, backlog exceeded $2.2B, and Iridium adds spectrum and 2.55M subscribers.', 'Rocket Lab remains loss-making; the deal uses cash, stock and a $3.6B bridge facility while Neutron is unproven.', 'not_tested', 'What is the fully financed per-share return distribution after the Iridium transaction?', 'Investo Master'],
  ['tu-2026-w29-mp-baseline', '2026-07-18', '2026-W29', 'mp', 'baseline', 'researching', 'MP is a strategically scarce mine-to-magnet platform with improving production, but economics are intertwined with policy support.', 'NdPr production rose 63% and sales volume 117%; 10X has long-term government support.', 'Q1 included $42.3M of price-protection income and the company still reported a net loss.', 'not_tested', 'What returns can the magnet chain earn without the price floor and EBITDA guarantee?', 'Investo Master'],
];

const sources = [
  ['src-2026-w29-fed', '2026-07-18', '', 'age-of-electricity', 'central_bank', 'Federal Reserve issues FOMC statement', 'Federal Reserve', '2026-06-17', '2026-07-18', 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm', true, 'context', 'The target federal-funds range remained 3.50%-3.75%.', 'high'],
  ['src-2026-w29-cpi', '2026-07-18', '', 'age-of-electricity', 'government_data', 'Consumer Price Index — June 2026', 'US Bureau of Labor Statistics', '2026-07-14', '2026-07-18', 'https://www.bls.gov/news.release/archives/cpi_07142026.htm', true, 'context', 'Headline CPI was 3.5% year over year and core CPI 2.6%.', 'high'],
  ['src-2026-w29-jobs', '2026-07-18', '', 'age-of-electricity', 'government_data', 'Employment Situation — June 2026', 'US Bureau of Labor Statistics', '2026-07-02', '2026-07-18', 'https://www.bls.gov/news.release/archives/empsit_07022026.htm', true, 'context', 'Payrolls rose 57,000 and unemployment was 4.2%.', 'high'],
  ['src-2026-w29-iea-electricity', '2026-07-18', '', 'age-of-electricity', 'official_research', 'Electricity 2026 — Executive Summary', 'International Energy Agency', '2026-01-01', '2026-07-18', 'https://www.iea.org/reports/electricity-2026/executive-summary', true, 'supports', 'Global electricity demand is forecast to grow 3.6% annually through 2030; data centres drive roughly half of US demand growth.', 'high'],
  ['src-2026-w29-eia-aeo', '2026-07-18', '', 'ai-physical-infrastructure', 'government_forecast', 'Annual Energy Outlook 2026', 'US Energy Information Administration', '2026-04-01', '2026-07-18', 'https://www.eia.gov/outlooks/aeo/pdf/AEO_Narrative.pdf', true, 'supports', 'Data-centre server energy use is an important driver of US electricity-demand growth.', 'high'],
  ['src-2026-w29-gev-q1', '2026-07-18', 'gev', 'ai-physical-infrastructure', 'issuer_results', 'GE Vernova reports first-quarter 2026 results', 'GE Vernova', '2026-04-22', '2026-07-18', 'https://www.gevernova.com/news/press-releases/ge-vernova-reports-first-quarter-2026-financial', true, 'supports', 'Orders were $18.3B, backlog $163B and data-centre electrification equipment orders $2.4B.', 'high'],
  ['src-2026-w29-gev-10q', '2026-07-18', 'gev', 'age-of-electricity', 'regulatory_filing', 'GE Vernova Form 10-Q for March 2026', 'US SEC', '2026-04-22', '2026-07-18', 'https://www.sec.gov/Archives/edgar/data/1996810/000199681026000064/gev-20260331.htm', true, 'context', 'The filing confirms segment performance and the continuing losses in Wind.', 'high'],
  ['src-2026-w29-vrt-q1', '2026-07-18', 'vrt', 'ai-physical-infrastructure', 'issuer_results', 'Vertiv reports first-quarter 2026 results', 'Vertiv', '2026-04-22', '2026-07-18', 'https://investors.vertiv.com/news/news-details/2026/Vertiv-Reports-Strong-First-Quarter-with-Diluted-EPS-Growth-of-136-Adjusted-Diluted-EPS-Growth-of-83-Raises-Full-Year-Guidance/default.aspx', true, 'supports', 'Q1 sales rose 30%; full-year organic sales growth guidance was raised to 29%-31%.', 'high'],
  ['src-2026-w29-vrt-10q', '2026-07-18', 'vrt', 'ai-physical-infrastructure', 'regulatory_filing', 'Vertiv Form 10-Q for March 2026', 'US SEC', '2026-04-24', '2026-07-18', 'https://www.sec.gov/Archives/edgar/data/1674101/000162828026026556/vrt-20260331.htm', true, 'challenges', 'The filing identifies cancellation, fixed-price, capacity and customer-spending risks.', 'high'],
  ['src-2026-w29-crdo-results', '2026-07-18', 'crdo', 'high-speed-connectivity', 'issuer_results', 'Credo reports fourth-quarter and fiscal 2026 results', 'Credo Technology', '2026-06-01', '2026-07-18', 'https://investors.credosemi.com/news-events/news/news-details/2026/Credo-Technology-Group-Holding-Ltd-Reports-Fourth-Quarter-and-Fiscal-Year-2026-Financial-Results/default.aspx', true, 'supports', 'Q4 revenue grew 157% year over year with a 68.2% GAAP gross margin.', 'high'],
  ['src-2026-w29-crdo-10k', '2026-07-18', 'crdo', 'high-speed-connectivity', 'regulatory_filing', 'Credo Form 10-K for fiscal 2026', 'US SEC', '2026-06-16', '2026-07-18', 'https://www.sec.gov/Archives/edgar/data/1807794/000162828026043303/crdo-20260502.htm', true, 'challenges', 'Two customers represented 49% and 32% of FY2026 revenue; share-based compensation was $182.6M.', 'high'],
  ['src-2026-w29-rklb-q1', '2026-07-18', 'rklb', 'vertically-integrated-space', 'issuer_results', 'Rocket Lab reports first-quarter 2026 results', 'Rocket Lab', '2026-05-07', '2026-07-18', 'https://investors.rocketlabcorp.com/news-releases/news-release-details/rocket-lab-announces-first-quarter-2026-financial-results', true, 'supports', 'Q1 revenue was $200.3M and backlog exceeded $2.2B.', 'high'],
  ['src-2026-w29-rklb-10q', '2026-07-18', 'rklb', 'vertically-integrated-space', 'regulatory_filing', 'Rocket Lab Form 10-Q for March 2026', 'US SEC', '2026-05-07', '2026-07-18', 'https://www.sec.gov/Archives/edgar/data/1819994/000181999426000028/rklb-20260331.htm', true, 'challenges', 'Q1 net loss was $45.0M, operating cash outflow $50.3M and ATM proceeds $445.6M.', 'high'],
  ['src-2026-w29-rklb-iridium', '2026-07-18', 'rklb', 'vertically-integrated-space', 'regulatory_filing', 'Rocket Lab Form 8-K — Iridium merger agreement', 'US SEC', '2026-06-29', '2026-07-18', 'https://www.sec.gov/Archives/edgar/data/1819994/000175392626001085/g085783_8k.htm', true, 'context', 'Rocket Lab agreed to acquire Iridium for cash and stock and obtained a $3.6B bridge commitment.', 'high'],
  ['src-2026-w29-rklb-iridium-release', '2026-07-18', 'rklb', 'vertically-integrated-space', 'issuer_release', 'Rocket Lab to acquire Iridium', 'Rocket Lab and Iridium', '2026-06-29', '2026-07-18', 'https://www.sec.gov/Archives/edgar/data/1819994/000175392626001085/g085783_ex99-1.htm', true, 'supports', 'Iridium adds 2.55M subscribers, L-band spectrum and an existing service network.', 'high'],
  ['src-2026-w29-mp-q1', '2026-07-18', 'mp', 'critical-minerals-security', 'issuer_results', 'MP Materials reports first-quarter 2026 results', 'MP Materials', '2026-05-07', '2026-07-18', 'https://investors.mpmaterials.com/investor-news/news-details/2026/MP-Materials-Reports-First-Quarter-2026-Results/default.aspx', true, 'supports', 'NdPr production rose 63%, sales volume 117% and magnetics revenue reached $21.1M.', 'high'],
  ['src-2026-w29-mp-10q', '2026-07-18', 'mp', 'critical-minerals-security', 'regulatory_filing', 'MP Materials Form 10-Q for March 2026', 'US SEC', '2026-05-08', '2026-07-18', 'https://www.sec.gov/Archives/edgar/data/1801368/000180136826000029/mp-20260331.htm', true, 'challenges', 'Q1 included $42.3M of price-protection income under the $110/kg government price floor.', 'high'],
  ['src-2026-w29-iea-minerals', '2026-07-18', '', 'critical-minerals-security', 'official_research', 'Global Critical Minerals Outlook 2026', 'International Energy Agency', '2026-07-16', '2026-07-18', 'https://www.iea.org/reports/global-critical-minerals-outlook-2026/executive-summary', true, 'supports', 'Supply concentration and export controls have made diversification a strategic priority.', 'high'],
  ['src-2026-w29-iea-rare-earths', '2026-07-18', '', 'critical-minerals-security', 'official_research', 'Rare Earth Elements — Executive Summary', 'International Energy Agency', '2026-01-01', '2026-07-18', 'https://www.iea.org/reports/rare-earth-elements/executive-summary', true, 'supports', 'China held 91% of refining and 94% of sintered permanent-magnet production in 2024.', 'high'],
  ['src-2026-w29-nrc', '2026-07-18', '', 'advanced-nuclear-enablers', 'regulator_update', 'Advanced Reactor Highlights 2026', 'US Nuclear Regulatory Commission', '2026-04-15', '2026-07-18', 'https://www.nrc.gov/reactors/new-reactors/advanced/highlights/2026', true, 'context', 'The NRC issued a new Part 53 pathway and approved TerraPower construction activity.', 'high'],
  ['src-2026-w29-gev-market', '2026-07-18', 'gev', 'age-of-electricity', 'market_data', 'GEV market snapshot', 'ChartExchange', '2026-07-17', '2026-07-18', 'https://chartexchange.com/symbol/nyse-gev/', false, 'context', 'Market capitalisation was approximately $284.3B.', 'medium'],
  ['src-2026-w29-vrt-market', '2026-07-18', 'vrt', 'ai-physical-infrastructure', 'market_data', 'Vertiv stock-price history', 'Macrotrends', '2026-07-17', '2026-07-18', 'https://www.macrotrends.net/stocks/charts/VRT/vertiv-holdings/stock-price-history', false, 'context', 'Closing price was $289.56 and market capitalisation approximately $113.0B.', 'medium'],
  ['src-2026-w29-crdo-market', '2026-07-18', 'crdo', 'high-speed-connectivity', 'market_data', 'CRDO market snapshot', 'ChartExchange', '2026-07-16', '2026-07-18', 'https://chartexchange.com/symbol/nasdaq-crdo/', false, 'context', 'Market capitalisation was approximately $38.4B.', 'medium'],
  ['src-2026-w29-rklb-market', '2026-07-18', 'rklb', 'vertically-integrated-space', 'market_data', 'RKLB closing-price snapshot', 'MarketBeat', '2026-07-17', '2026-07-18', 'https://www.marketbeat.com/stocks/NASDAQ/RKLB/', false, 'context', 'Closing price was $67.62 and approximate market capitalisation was $42B.', 'medium'],
  ['src-2026-w29-mp-market', '2026-07-18', 'mp', 'critical-minerals-security', 'market_data', 'MP market snapshot', 'Fox Business', '2026-07-17', '2026-07-18', 'https://www.foxbusiness.com/quote?stockTicker=MP', false, 'context', 'Market capitalisation was approximately $8.1B.', 'medium'],
];

const reports = [
  ['2026-W29-001', '2026-W29', '2026-07-14', '2026-07-18', '2026-07-18T23:00:00+02:00', 'approved', '2026-07-18T23:00:00+02:00', '2026-07-18T23:00:00+02:00', 'owner', 'Investo Master — Issue 001: Baseline / Wide Week', 'reports/2026/2026-W29-issue-001'],
];

console.log('Writing Investo Master baseline CSV store');
await writeCsv('assets.csv', ['asset_id', 'symbol', 'name', 'asset_type', 'exchange', 'country', 'sector', 'industry', 'currency', 'website', 'stage', 'added_date', 'last_reviewed_date'], assets);
await writeCsv('themes.csv', ['theme_id', 'name', 'summary', 'status', 'time_horizon', 'confidence', 'created_date', 'last_updated_date'], themes);
await writeCsv('asset_themes.csv', ['asset_id', 'theme_id', 'role', 'relevance', 'notes', 'last_updated_date'], assetThemes);
await writeCsv('weekly_metrics.csv', ['week_id', 'as_of_date', 'asset_id', 'price', 'currency', 'market_cap', 'enterprise_value', 'revenue_ttm', 'revenue_growth_yoy', 'gross_margin', 'operating_margin', 'free_cash_flow_margin', 'net_cash', 'valuation_metric', 'valuation_value', 'data_quality'], weeklyMetrics);
await writeCsv('scores.csv', ['week_id', 'as_of_date', 'asset_id', 'market_runway', 'moat', 'product_evidence', 'management', 'growth_economics', 'financial_strength', 'optionality', 'valuation_asymmetry', 'risk_falsifiability', 'total_score', 'evidence_quality', 'thesis_confidence', 'most_important_uncertainty', 'next_checkpoint'], scores);
await writeCsv('thesis_updates.csv', ['update_id', 'as_of_date', 'week_id', 'asset_id', 'change_type', 'thesis_status', 'summary', 'evidence_for', 'evidence_against', 'kill_criterion_status', 'next_question', 'author'], thesisUpdates);
await writeCsv('sources.csv', ['source_id', 'as_of_date', 'asset_id', 'theme_id', 'source_type', 'title', 'publisher', 'published_at', 'accessed_at', 'url', 'is_primary', 'stance', 'claim', 'reliability'], sources);
await writeCsv('reports.csv', ['report_id', 'week_id', 'period_start', 'period_end', 'data_cutoff', 'status', 'generated_at', 'approved_at', 'approved_by', 'subject', 'archive_path'], reports);
console.log('Baseline CSV build complete.');
