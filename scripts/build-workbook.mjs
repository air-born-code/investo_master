import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const root = path.resolve(process.argv[2]);
const reportDir = path.join(root, 'reports', '2026', '2026-W29-issue-001');
const previewDir = path.join('/tmp', 'investo_issue001_work', 'workbook-previews');
await fs.mkdir(previewDir, { recursive: true });

const imports = [
  ['assets.csv', 'Candidates'],
  ['themes.csv', 'Themes'],
  ['asset_themes.csv', 'Asset Themes'],
  ['weekly_metrics.csv', 'Weekly Metrics'],
  ['scores.csv', 'Scores'],
  ['thesis_updates.csv', 'Thesis Updates'],
  ['sources.csv', 'Sources'],
  ['reports.csv', 'Reports'],
];

const [firstFile, firstSheetName] = imports[0];
const firstText = await fs.readFile(path.join(root, 'data', firstFile), 'utf8');
const workbook = await Workbook.fromCSV(firstText, { sheetName: firstSheetName });
for (const [file, sheetName] of imports.slice(1)) {
  const text = await fs.readFile(path.join(root, 'data', file), 'utf8');
  await workbook.fromCSV(text, { sheetName });
}
const cover = workbook.worksheets.add('Cover');
const checks = workbook.worksheets.add('Checks');

const navy = '#13263D';
const blue = '#527095';
const cream = '#F7F4EC';
const paleBlue = '#E8EEF5';
const paleGreen = '#E7EDE8';
const paleGold = '#F5EAD2';
const line = '#D9D7CF';
const text = '#263849';

cover.showGridLines = false;
cover.mergeCells('A1:H2');
cover.getRange('A1').values = [['Investo Master — Issue 001 Baseline']];
cover.getRange('A1:H2').format = { fill: navy, font: { bold: true, color: '#FFFFFF', size: 24 }, verticalAlignment: 'center', horizontalAlignment: 'left' };
cover.getRange('A3:H3').merge();
cover.getRange('A3').values = [['Wide week · Evidence cut-off 2026-07-18 23:00 CEST · Research record, not a trade instruction']];
cover.getRange('A3:H3').format = { fill: navy, font: { color: '#C9D3DF', size: 10 }, verticalAlignment: 'center' };
cover.getRange('A5:H5').merge();
cover.getRange('A5').values = [['Baseline dashboard']];
cover.getRange('A5:H5').format = { fill: blue, font: { bold: true, color: '#FFFFFF', size: 12 } };

cover.getRange('A6:B6').merge();
cover.getRange('A6').values = [['Action posture']];
cover.getRange('A7:B8').merge();
cover.getRange('A7').values = [['NO ACTION']];
cover.getRange('C6:D6').merge();
cover.getRange('C6').values = [['Candidates']];
cover.getRange('C7:D8').merge();
cover.getRange('C7').formulas = [["=COUNTA('Candidates'!A2:A6)"]];
cover.getRange('E6:F6').merge();
cover.getRange('E6').values = [['Researching']];
cover.getRange('E7:F8').merge();
cover.getRange('E7').formulas = [["=COUNTIF('Candidates'!K2:K6,\"researching\")"]];
cover.getRange('G6:H6').merge();
cover.getRange('G6').values = [['Average score']];
cover.getRange('G7:H8').merge();
cover.getRange('G7').formulas = [["=AVERAGE('Scores'!M2:M6)"]];
cover.getRange('A6:H6').format = { fill: '#E2E6E8', font: { bold: true, color: blue, size: 10 }, horizontalAlignment: 'center' };
cover.getRange('A7:B8').format = { fill: paleGreen, font: { bold: true, color: '#26533A', size: 18 }, horizontalAlignment: 'center', verticalAlignment: 'center' };
cover.getRange('C7:H8').format = { fill: '#FFFFFF', font: { bold: true, color: navy, size: 20 }, horizontalAlignment: 'center', verticalAlignment: 'center', numberFormat: '0' };
cover.getRange('A6:H8').format.borders = { preset: 'outside', style: 'thin', color: line };

cover.getRange('A10:H10').merge();
cover.getRange('A10').values = [['Week 1 conclusion']];
cover.getRange('A10:H10').format = { fill: blue, font: { bold: true, color: '#FFFFFF', size: 12 } };
cover.getRange('A11:H13').merge();
cover.getRange('A11').values = [['The structural changes are real, but the obvious public beneficiaries already carry demanding expectations. Rocket Lab, Credo and MP Materials deserve further research; none has passed complete underwriting or valuation gates.']];
cover.getRange('A11:H13').format = { fill: cream, font: { color: text, size: 12 }, wrapText: true, verticalAlignment: 'center' };
cover.getRange('A11:H13').format.borders = { preset: 'outside', style: 'thin', color: line };

cover.getRange('A15:B20').values = [
  ['Candidate', 'Score'], ['GE Vernova', 78], ['Vertiv', 78], ['Credo', 73], ['Rocket Lab', 72], ['MP Materials', 72],
];
cover.getRange('A15:B15').format = { fill: navy, font: { bold: true, color: '#FFFFFF' } };
cover.getRange('B16:B20').format.numberFormat = '0';
const chart = cover.charts.add('bar', cover.getRange('A15:B20'));
chart.title = 'Research-priority scores';
chart.hasLegend = false;
chart.xAxis = { axisType: 'textAxis', textStyle: { fontSize: 9 } };
chart.yAxis = { numberFormatCode: '0', min: 0, max: 100 };
chart.setPosition('D15', 'H29');
cover.getRange('A22:C22').values = [['Research queue', 'Priority', 'Status']];
cover.getRange('A23:C27').values = [
  ['Rocket Lab / Iridium financing bridge', 1, 'next'],
  ['AI power value-chain map', 2, 'next'],
  ['Credo customer diversification', 3, 'queued'],
  ['MP support-adjusted economics', 4, 'queued'],
  ['Advanced nuclear fuel-cycle map', 5, 'queued'],
];
cover.getRange('A22:C22').format = { fill: navy, font: { bold: true, color: '#FFFFFF' } };
cover.getRange('A23:C27').format = { fill: '#FFFFFF', font: { color: text }, borders: { preset: 'inside', style: 'thin', color: line } };
cover.getRange('A1:H29').format.rowHeight = 22;
cover.getRange('A1:H2').format.rowHeight = 34;
cover.getRange('A11:H13').format.rowHeight = 32;
cover.getRange('A:A').format.columnWidth = 32;
cover.getRange('B:B').format.columnWidth = 13;
cover.getRange('C:H').format.columnWidth = 15;
cover.freezePanes.freezeRows(3);

const sheetConfigs = {
  Candidates: { widths: [15, 10, 24, 12, 12, 18, 16, 30, 10, 42, 15, 14, 18] },
  Themes: { widths: [26, 30, 64, 14, 16, 13, 14, 18] },
  'Asset Themes': { widths: [14, 28, 16, 14, 70, 18] },
  'Weekly Metrics': { widths: [14, 14, 14, 12, 10, 18, 18, 18, 18, 15, 16, 18, 18, 22, 18, 66] },
  Scores: { widths: [14, 14, 14, 14, 10, 16, 14, 18, 18, 14, 18, 18, 13, 18, 18, 58, 68] },
  'Thesis Updates': { widths: [28, 14, 14, 14, 15, 18, 64, 64, 64, 20, 64, 18] },
  Sources: { widths: [30, 14, 14, 28, 22, 54, 28, 16, 16, 64, 13, 14, 70, 14] },
  Reports: { widths: [18, 14, 16, 16, 29, 14, 29, 29, 16, 52, 42] },
};

for (const [sheetName, config] of Object.entries(sheetConfigs)) {
  const sheet = workbook.worksheets.getItem(sheetName);
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  const used = sheet.getUsedRange();
  used.format = { font: { color: text, size: 9 }, verticalAlignment: 'top' };
  used.format.wrapText = true;
  const cols = config.widths;
  for (let i = 0; i < cols.length; i += 1) sheet.getRangeByIndexes(0, i, used.rowCount, 1).format.columnWidth = cols[i];
  sheet.getRangeByIndexes(0, 0, 1, used.columnCount).format = { fill: navy, font: { bold: true, color: '#FFFFFF', size: 9 }, verticalAlignment: 'center', wrapText: true, borders: { preset: 'outside', style: 'thin', color: navy } };
  sheet.getRangeByIndexes(0, 0, 1, used.columnCount).format.rowHeight = 34;
  if (used.rowCount > 1) sheet.getRangeByIndexes(1, 0, used.rowCount - 1, used.columnCount).format.rowHeight = sheetName === 'Sources' || sheetName === 'Thesis Updates' ? 44 : 30;
}

const scoresSheet = workbook.worksheets.getItem('Scores');
scoresSheet.getRange('M2').formulas = [['=VALUE(D2)+VALUE(E2)+VALUE(F2)+VALUE(G2)+VALUE(H2)+VALUE(I2)+VALUE(J2)+VALUE(K2)+VALUE(L2)']];
scoresSheet.getRange('M2:M6').fillDown();
scoresSheet.getRange('D2:M6').format.numberFormat = '0';
scoresSheet.getRange('M2:M6').format = { fill: paleGreen, font: { bold: true, color: '#26533A' }, numberFormat: '0' };
scoresSheet.getRange('K2:K6').format = { fill: paleGold, font: { bold: true, color: '#6A4A0E' }, numberFormat: '0' };

const metrics = workbook.worksheets.getItem('Weekly Metrics');
metrics.getRange('D2:D6').format.numberFormat = '$0.00';
metrics.getRange('F2:H6').format.numberFormat = '$#,##0;[Red]($#,##0);-';
metrics.getRange('I2:L6').format.numberFormat = '0.0%;[Red](0.0%);-';
metrics.getRange('M2:M6').format.numberFormat = '$#,##0;[Red]($#,##0);-';
metrics.getRange('O2:O6').format.numberFormat = '$#,##0;[Red]($#,##0);-';

const reportsSheet = workbook.worksheets.getItem('Reports');
reportsSheet.getRange('E2:E2').format.numberFormat = 'yyyy-mm-dd hh:mm "UTC"';
reportsSheet.getRange('G2:H2').format.numberFormat = 'yyyy-mm-dd hh:mm "UTC"';

checks.showGridLines = false;
checks.getRange('A1:F2').merge();
checks.getRange('A1').values = [['Baseline workbook checks']];
checks.getRange('A1:F2').format = { fill: navy, font: { bold: true, color: '#FFFFFF', size: 20 }, verticalAlignment: 'center' };
checks.getRange('A4:E4').values = [['Check', 'Actual', 'Expected', 'Difference', 'Status']];
checks.getRange('A5:A9').values = [['Candidate rows'], ['Source rows'], ['Minimum score'], ['Maximum score'], ['Populated totals']];
checks.getRange('B5:B9').formulas = [["=COUNTA('Candidates'!A2:A6)"], ["=COUNTA('Sources'!A2:A26)"], ["=MIN('Scores'!M2:M6)"], ["=MAX('Scores'!M2:M6)"], ["=COUNT('Scores'!M2:M6)"]];
checks.getRange('C5:C9').values = [[5], [25], [0], [100], [5]];
checks.getRange('D5:D9').formulas = [['=B5-C5'], ['=B6-C6'], ['=B7-C7'], ['=B8-C8'], ['=B9-C9']];
checks.getRange('E5:E9').formulas = [['=IF(D5=0,"OK","FAIL")'], ['=IF(D6=0,"OK","FAIL")'], ['=IF(B7>=C7,"OK","FAIL")'], ['=IF(B8<=C8,"OK","FAIL")'], ['=IF(D9=0,"OK","FAIL")']];
checks.getRange('A11:E11').merge();
checks.getRange('A11').values = [['Model status']];
checks.getRange('A12:E13').merge();
checks.getRange('A12').formulas = [['=IF(COUNTIF(E5:E9,"FAIL")=0,"OK — BASELINE DATA PASSED","FAIL — REVIEW CHECKS")']];
checks.getRange('A4:E4').format = { fill: blue, font: { bold: true, color: '#FFFFFF' } };
checks.getRange('A5:E9').format = { fill: '#FFFFFF', font: { color: text }, borders: { preset: 'inside', style: 'thin', color: line } };
checks.getRange('B5:D9').format.numberFormat = '0';
checks.getRange('E5:E9').format = { fill: paleGreen, font: { bold: true, color: '#26533A' }, horizontalAlignment: 'center' };
checks.getRange('A11:E11').format = { fill: blue, font: { bold: true, color: '#FFFFFF' } };
checks.getRange('A12:E13').format = { fill: paleGreen, font: { bold: true, color: '#26533A', size: 16 }, horizontalAlignment: 'center', verticalAlignment: 'center', borders: { preset: 'outside', style: 'thin', color: line } };
checks.getRange('A:A').format.columnWidth = 30;
checks.getRange('B:E').format.columnWidth = 17;
checks.freezePanes.freezeRows(4);

const inspection = await workbook.inspect({ kind: 'table', range: 'Checks!A4:E13', include: 'values,formulas', tableMaxRows: 15, tableMaxCols: 8 });
console.log(inspection.ndjson);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 100 }, summary: 'final formula error scan' });
console.log(errors.ndjson);

for (const sheetName of ['Cover', ...imports.map(([, name]) => name), 'Checks']) {
  const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' });
  await fs.writeFile(path.join(previewDir, `${sheetName.toLowerCase().replaceAll(' ', '-')}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(reportDir, 'baseline-research.xlsx'));
console.log(`Workbook saved: ${path.join(reportDir, 'baseline-research.xlsx')}`);
