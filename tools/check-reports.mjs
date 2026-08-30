#!/usr/bin/env node
/**
 * Reports, analytics and export audit.
 *
 * TAB 19's acceptance criteria are that aggregate analytics are available
 * without exposing names by default, that every chart claim can be verified
 * from tabular data, and that exports show their applied filters and generation
 * metadata. Each is a modelling rule before it is a screen:
 *
 *   1. **Aggregate first** (`DL-104`). One report names people, it says why,
 *      and it sits behind a higher permission than reading a count.
 *   2. **An aggregate is not automatically anonymous** (`DL-105`). Counts of
 *      people below the threshold are withheld — never dropped, never rounded,
 *      never a zero — and there is no way to ask for the raw set.
 *   3. **The chart IS the table.** Every series carries a summary sentence and
 *      real rows, rendered through `ChartTable`. No second chart renderer, and
 *      no charting dependency that would draw a picture instead.
 *   4. **Exports carry their own conditions** (`DL-106`), inside the file, and
 *      are composed by the data layer rather than by a screen.
 *   5. **Staff workload is not a performance ranking** (`DL-107`). No score, no
 *      rate, no league table, and it is not sorted by volume.
 *   6. **The screen computes nothing.** The adapter applies the filter, the
 *      suppression and the arithmetic.
 *   7. **The adapter checks permission**, per report as well as overall.
 *
 * Exit 0 = clean, 1 = at least one violation.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const walk = (dir, exts) => {
  const out = [];
  if (!existsSync(join(root, dir))) return out;
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel, exts));
    else if (exts.has(extname(entry))) out.push(rel);
  }
  return out;
};

const domainFiles = walk('src/app/domain/reports', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);
const viewFiles = walk('src/app/features/reports', new Set(['.ts', '.html'])).filter(
  (file) => !file.includes('.spec.'),
);

if (domainFiles.length === 0) {
  problems.push('No report domain files found. The model has moved or been removed.');
}
if (viewFiles.length === 0) {
  problems.push('No report screens found. The feature has moved or been removed.');
}

const definition = read('src/app/domain/reports/report-definition.ts');
const disclosure = read('src/app/domain/reports/report-disclosure.ts');
const result = read('src/app/domain/reports/report-result.ts');
const adapter = read('src/app/data/mock/mock-report.repository.ts');
const port = read('src/app/domain/ports/repositories.ts');

/**
 * Joins adjacent string literals before searching prose.
 *
 * A sentence written as `'…not a productivity ' + 'measure…'` contains no
 * contiguous "not a productivity measure", so a plain search reports the
 * warning missing while it is sitting right there. Every prose assertion in
 * this file goes through here.
 */
const prose = (text) => text.replace(/'\s*\+\s*'/g, '');

/** The declaration a rule is about, so a match elsewhere in the file cannot pass it. */
const block = (text, pattern, what) => {
  const found = pattern.exec(text)?.[0] ?? '';
  if (found === '') problems.push(`${what} has gone.`);
  return found;
};

/* ── 1. Aggregate first ──────────────────────────────────────────────────── */

const catalogueBlock = block(
  definition,
  /export const REPORT_CATALOGUE:[\s\S]*?\n\];/,
  'REPORT_CATALOGUE',
);
const personLevelCount = [...catalogueBlock.matchAll(/grain: 'person-level'/g)].length;
const aggregateCount = [...catalogueBlock.matchAll(/grain: 'aggregate'/g)].length;

if (aggregateCount === 0) {
  problems.push('No aggregate reports remain. The catalogue is aggregate-first (DL-104).');
}
// A quiet drift from one person-level report to several is exactly the shape
// this rule exists to catch, so the count itself is asserted.
if (personLevelCount > 1) {
  problems.push(
    `${personLevelCount} reports now name people. Aggregate is the default and person-level is ` +
      'the exception that has to argue for itself — each one needs a stated reason and the ' +
      'export permission (DL-104).',
  );
}

const problemsBody = block(
  definition,
  /export function reportProblems[\s\S]*?\n\}/,
  'reportProblems',
);
for (const rule of [
  'person-level-without-justification',
  'person-level-without-export-permission',
]) {
  if (!problemsBody.includes(rule)) {
    problems.push(`reportProblems no longer rejects '${rule}' (DL-104).`);
  }
}

// Every definition has to actually satisfy its own rules.
if (!/personLevelJustification/.test(catalogueBlock)) {
  problems.push('The catalogue no longer records why a person-level report needs names.');
}
notes.push(
  `catalogue: ${aggregateCount} aggregate, ${personLevelCount} person-level with a stated reason`,
);

/* ── 2. An aggregate is not automatically anonymous ──────────────────────── */

if (!/export const SMALL_CELL_THRESHOLD/.test(disclosure)) {
  problems.push(
    'SMALL_CELL_THRESHOLD has gone. "Barangay San Juan: 1 VAWC survivor served" names somebody ' +
      'to anyone who knows who has been to the office (DL-105).',
  );
}

const isSmallBody = block(disclosure, /export function isSmallCell[\s\S]*?\n\}/, 'isSmallCell');
if (!/value > 0/.test(isSmallBody)) {
  problems.push(
    'isSmallCell now suppresses zero. Zero identifies nobody, and hiding it hides the absence of ' +
      'service — which is the finding a planning report most needs (DL-105).',
  );
}

const suppressBody = block(
  disclosure,
  /export function suppressSmallCells[\s\S]*?\n\}/,
  'suppressSmallCells',
);
if (!/isWithheld: true/.test(suppressBody)) {
  problems.push(
    'Suppression no longer marks the row. A dropped row reads as "none", which is a different ' +
      'and false claim (DL-105).',
  );
}
if (!/routerLink: undefined/.test(suppressBody)) {
  problems.push(
    'A withheld row keeps its drill-down. Withholding the figure and leaving a link to the four ' +
      'records behind it withholds nothing at all (DL-105).',
  );
}
// Rounding would put a number in a report that is not true.
if (/Math\s*\.\s*(round|max|ceil)\s*\(/.test(suppressBody)) {
  problems.push(
    'Suppression rounds a small count. Rounding 2 up to the threshold puts a figure in a report ' +
      'that is not true, and somebody will act on it (DL-105).',
  );
}

const totalBody = block(
  disclosure,
  /export function totalBeforeSuppression[\s\S]*?\n\}/,
  'totalBeforeSuppression',
);
if (!/reduce/.test(totalBody)) {
  problems.push('totalBeforeSuppression no longer sums the rows.');
}
if (!/does not add up/.test(prose(disclosure))) {
  problems.push(
    'The suppression notice no longer warns that the column will not add up. A reader who does ' +
      'not know figures are missing will total it and defend the answer.',
  );
}
// Scoped to the constant, not the file: the module doc comment above it says
// the same thing, and a file-wide search passes while the sentence an officer
// actually reads has become a claim of settled policy.
// Terminated on a semicolon at end of line, not the first semicolon anywhere:
// the sentence itself contains one ("…practice; the MSWDO…"), and a lazy match
// stopped inside the string literal — half a declaration, read as the whole.
const basisBlock = block(
  disclosure,
  /export const SMALL_CELL_BASIS[\s\S]*?;[ \t]*(?:\r?\n)/,
  'SMALL_CELL_BASIS',
);
if (!/has not yet confirmed/.test(prose(basisBlock))) {
  problems.push(
    'The threshold no longer admits it is an unconfirmed convention. A number that quietly ' +
      'becomes policy by age is what DL-68 exists to prevent.',
  );
}

// There must be no way to ask for the unsuppressed set.
const reportPortBlock = block(
  port,
  /export interface ReportRepository\s*\{[\s\S]*?\n\}/,
  'ReportRepository',
);
if (/suppress|raw|unmasked|includeSmall|threshold/i.test(reportPortBlock)) {
  problems.push(
    'ReportRepository exposes a way to bypass suppression. "Just this once" is how a threshold ' +
      'stops being one (DL-105).',
  );
}

// And every series about people has to go through it.
const aboutPeopleBody =
  /private aboutPeople\([\s\S]*?\n  \}/.exec(adapter)?.[0] ?? '';
if (aboutPeopleBody === '') {
  problems.push('MockReportRepository.aboutPeople has gone. Nothing applies suppression.');
} else {
  if (!/suppressSmallCells\(/.test(aboutPeopleBody)) {
    problems.push('A series counting people no longer passes through suppression (DL-105).');
  }
  if (!/totalBeforeSuppression\(/.test(aboutPeopleBody)) {
    problems.push(
      'The total is now taken after suppression. A reader would be shown a smaller number than ' +
        'the truth and told it was the total.',
    );
  }
}
notes.push('suppression: small cells withheld and marked, zero kept, total taken before');

/* ── 3. The chart IS the table ───────────────────────────────────────────── */

const seriesBlock = block(result, /export interface ReportSeries\s*\{[\s\S]*?\n\}/, 'ReportSeries');
if (!/readonly summary: string;/.test(seriesBlock)) {
  problems.push(
    'ReportSeries no longer requires a summary sentence. A visualisation with no plain-text ' +
      'equivalent is one a screen reader cannot convey and a reader cannot check.',
  );
}
if (/readonly summary\?:/.test(seriesBlock)) {
  problems.push('The series summary became optional. It is the accessible equivalent.');
}
if (!/readonly rows: readonly ReportRow\[\];/.test(seriesBlock)) {
  problems.push('ReportSeries no longer carries rows. The table is the chart.');
}

// Rendered through the one primitive that is already a real table.
const rendersChartTable = viewFiles.some(
  (file) => file.endsWith('.html') && /<app-chart-table/.test(read(file)),
);
if (!rendersChartTable) {
  problems.push(
    'No report screen renders through ChartTable. It is the primitive that already IS a table ' +
      'with a caption and a summary; a second renderer is two things that drift apart.',
  );
}
for (const file of viewFiles) {
  if (!file.endsWith('.html')) continue;
  const text = read(file);
  if (/<canvas|<svg[\s>]/.test(text)) {
    problems.push(
      `${file} draws a picture. Every chart claim must be verifiable from tabular data, and a ` +
        'canvas is not.',
    );
  }
  if (/\[summary\]/.test(text) === false && /<app-chart-table/.test(text)) {
    problems.push(`${file} renders a chart without binding its summary sentence.`);
  }
}

// And no charting dependency has been added to draw one.
const packageJson = JSON.parse(read('package.json'));
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const name of Object.keys(deps)) {
  if (/chart\.js|echarts|highcharts|plotly|d3(-|$)|apexcharts|ng2-charts|recharts/i.test(name)) {
    problems.push(
      `A charting dependency (${name}) was added. The house primitive is a real table, and a ` +
        'drawing library is how the accessible equivalent stops being maintained.',
    );
  }
}
notes.push('charts: rendered as real tables through ChartTable, each with a summary sentence');

/* ── 4. Exports carry their own conditions ───────────────────────────────── */

const manifestBlock = block(
  result,
  /export interface ExportManifest\s*\{[\s\S]*?\n\}/,
  'ExportManifest',
);
for (const required of [
  'reportTitle',
  'appliedFilterDescription',
  'generatedAt',
  'generatedBy',
  'includesPersonLevel',
  'handlingNotice',
]) {
  if (!new RegExp(`readonly ${required}[?]?:`).test(manifestBlock)) {
    problems.push(
      `ExportManifest no longer carries ${required}. A spreadsheet on somebody's desktop in six ` +
        'months has no screen around it (DL-106).',
    );
  }
  if (new RegExp(`readonly ${required}\\?:`).test(manifestBlock)) {
    problems.push(`ExportManifest.${required} became optional. Every export carries it (DL-106).`);
  }
}

const headerBody = block(
  result,
  /export function manifestHeaderLines[\s\S]*?\n\}/,
  'manifestHeaderLines',
);
for (const field of ['reportTitle', 'appliedFilterDescription', 'generatedBy', 'handlingNotice']) {
  if (!headerBody.includes(`manifest.${field}`)) {
    problems.push(`The export header no longer writes ${field} into the file (DL-106).`);
  }
}

const noticeBlock = /export const EXPORT_HANDLING_NOTICE\s*=[\s\S]*?;/.exec(result)?.[0] ?? '';
if (!/RA 10173/.test(prose(noticeBlock))) {
  problems.push('The export handling notice no longer cites RA 10173.');
}
const warningBlock = /export const PERSON_LEVEL_WARNING\s*=[\s\S]*?;/.exec(result)?.[0] ?? '';
if (!/recall/i.test(prose(warningBlock))) {
  problems.push(
    'The person-level warning no longer says the data cannot be recalled. That is the whole ' +
      'point of warning before the file exists rather than after.',
  );
}

// Composed by the data layer, never by a screen (`DL-92` restated).
for (const file of viewFiles) {
  const text = read(file);
  if (/manifestHeaderLines|csvCell|Blob\s*\(|URL\s*\.\s*createObjectURL/.test(text)) {
    problems.push(
      `${file} composes an export. The file comes from the data layer, which holds the disclosed ` +
        'record — a template is one binding away from writing a name into it (DL-106).',
    );
  }
  if (/from '@data\//.test(text)) {
    problems.push(`${file} imports from the data layer. Features depend on domain tokens only.`);
  }
}
if (!/export\s*\(/.test(reportPortBlock)) {
  problems.push('The port no longer composes an export. A screen would be forced to.');
}

// The warning has to reach the screen before the file is asked for.
const viewPage = 'src/app/features/reports/report-view-page.ts';
if (existsSync(join(root, viewPage))) {
  const text = read(viewPage);
  if (!/awaitingConfirmation/.test(text)) {
    problems.push(
      'A person-level export is no longer confirmed before it is produced. The warning has to ' +
        'come before the file, not after it is on somebody’s desktop.',
    );
  }
  if (!/grain === 'person-level'/.test(text)) {
    problems.push('The export flow no longer distinguishes a person-level report.');
  }
}
// The on-screen figures carry the same conditions as the file. Checked
// separately from ExportManifest because they are two declarations, and a plant
// that removed one from the other's interface would otherwise pass.
const resultBlock = block(result, /export interface ReportResult\s*\{[\s\S]*?\n\}/, 'ReportResult');
for (const required of ['appliedFilter', 'appliedFilterDescription', 'generatedAt', 'caution']) {
  if (!new RegExp(`readonly ${required}[?]?:`).test(resultBlock)) {
    problems.push(
      `ReportResult no longer carries ${required}. A figure and the conditions it was computed ` +
        'under must travel together, or a screen will show one beside a filter that produced ' +
        'the other.',
    );
  }
}
const rendersCoverage = viewFiles.some(
  (file) => file.endsWith('.html') && /appliedFilterDescription/.test(read(file)),
);
if (!rendersCoverage) {
  problems.push('No screen states what the report covers. The conditions must be on the page.');
}
notes.push('exports: composed by the data layer, carrying filter, time, author and handling rule');

/* ── 5. Staff workload is not a performance ranking ──────────────────────── */

// Matched as **identifiers**, not as prose. The caution that warns against
// ranking necessarily contains the word "productivity", and a checker that
// flags the warning as the thing it warns about is arguing with itself.
const RANKING =
  /\b(?:readonly\s+)?(productivityScore|productivityRate|efficiencyScore|efficiencyRate|performanceScore|performanceRating|performanceIndex|rankingScore|leagueTable|completionRate|throughput|targetMet|slaMet)\s*[:(=]/i;
const SCORE_FIELD = /readonly\s+\w*[Ss]core\b|\brank(?:ed)?By\s*[:(=]/;
for (const file of [...domainFiles, ...viewFiles, 'src/app/data/mock/mock-report.repository.ts']) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    if (RANKING.test(line) || SCORE_FIELD.test(line)) {
      problems.push(
        `${file}:${index + 1} introduces a performance measure. A heavy caseload is usually a ` +
          'hard caseload, and a count cannot tell an office who is doing well (DL-107).',
      );
    }
  }
}

const staffBody = /private staffWorkload\([\s\S]*?\n  \}/.exec(adapter)?.[0] ?? '';
if (staffBody === '') {
  problems.push('MockReportRepository.staffWorkload has gone.');
} else {
  if (!/localeCompare/.test(staffBody)) {
    problems.push(
      'Staff workload is no longer ordered alphabetically. Sorting by volume is what turns a ' +
        'workload table into a league table, whatever the heading says (DL-107).',
    );
  }
  if (/sortByValue(?!\s*=\s*false)/.test(staffBody) && !/false/.test(staffBody)) {
    problems.push('Staff workload is sorted by value.');
  }
}

const staffDefinition =
  /\{\s*id: 'staff-workload'[\s\S]*?\n  \},/.exec(catalogueBlock)?.[0] ?? '';
if (staffDefinition === '') {
  problems.push('The staff workload report has gone from the catalogue.');
} else if (!/not a productivity measure/.test(prose(staffDefinition))) {
  problems.push(
    'The staff workload caution no longer says it is not a productivity measure (DL-107).',
  );
}
notes.push('staff workload: counted to move work, ordered by name, cautioned on screen');

/* ── 6. The screen computes nothing ──────────────────────────────────────── */

for (const file of viewFiles) {
  if (!file.endsWith('.ts')) continue;
  const text = read(file);
  if (/\s*\.\s*reduce\s*\(|\s*\.\s*filter\s*\([^)]*\)\s*\.\s*length/.test(text.replace(/^\s*[/*].*$/gm, ''))) {
    // Filtering empty series for display is fine; arithmetic on figures is not.
    if (/reduce\(/.test(text)) {
      problems.push(
        `${file} computes a figure. The adapter applies the filter, the suppression and the ` +
          'arithmetic; a total worked out here is a second answer to the same question.',
      );
    }
  }
}
notes.push('screens: render what they are handed, computing nothing');

/* ── 7. The adapter checks permission ────────────────────────────────────── */

for (const method of ['catalogue', 'run', 'export']) {
  const body =
    new RegExp('\\n  ' + method + '\\(([\\s\\S]*?)\\n  \\}').exec(adapter)?.[1] ?? '';
  if (body === '') {
    problems.push(`MockReportRepository.${method} has gone.`);
    continue;
  }
  if (!/denyUnless|userHasPermission/.test(body)) {
    problems.push(`MockReportRepository.${method} does not check permission.`);
  }
  // Each report carries its own permission on top of the module's.
  if (method !== 'catalogue' && !/definition\.permission/.test(body)) {
    problems.push(
      `MockReportRepository.${method} does not check the report's own permission. Staff workload ` +
        'and the person-level report are not readable by everyone who holds report.view.',
    );
  }
}
const exportBody = new RegExp('\\n  export\\(([\\s\\S]*?)\\n  \\}').exec(adapter)?.[1] ?? '';
// Scoped to the **first** guard in the method rather than to the method body.
// A later `denyUnless(null, 'report.export')` on the not-found path leaves the
// string present while the guard that actually runs has been downgraded — the
// same false clean this suite keeps producing in new shapes.
const firstGuard = /denyUnless<ReportExport>\(user,\s*'([a-z.-]+)'\)/.exec(exportBody)?.[1] ?? '';
if (firstGuard !== 'report.export-person-level') {
  problems.push(
    `Exporting is guarded by '${firstGuard || 'nothing'}' rather than report.export-person-level. Producing a ` +
      'file is a separate grant from reading a figure on screen.',
  );
}
if (!/isWithinBarangayScope\(/.test(adapter)) {
  problems.push('The report adapter no longer applies barangay scope.');
}
notes.push('access: module and per-report permissions, scope applied, export gated separately');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nReport check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Report check passed.');
