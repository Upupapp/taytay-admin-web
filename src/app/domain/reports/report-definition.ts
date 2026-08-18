import type { Permission } from '../access/permission';

/**
 * The report catalogue is **data, not code**.
 *
 * Same doctrine as programme eligibility (`DL-66`): the screens render whatever
 * they are given, and no component branches on a report id. Adding a report is
 * adding a record here plus a producer in the adapter; it is never a new screen
 * and never a new `@if`.
 *
 * Each definition states the **question it answers** rather than only a title,
 * because a report nobody can say the purpose of is one an office prints and
 * never reads.
 */

export type ReportId =
  | 'caseload'
  | 'assistance-pipeline'
  | 'program-utilisation'
  | 'beneficiaries-by-barangay'
  | 'vulnerability-indicators'
  | 'service-reach'
  | 'case-aging'
  | 'requirement-bottlenecks'
  | 'referral-outcomes'
  | 'visit-workload'
  | 'release-status'
  | 'repeat-assistance'
  | 'data-completeness'
  | 'staff-workload';

/** How the reports hub groups the catalogue. */
export type ReportArea = 'operations' | 'delivery' | 'population' | 'quality';

export const REPORT_AREA_LABELS: Readonly<Record<ReportArea, string>> = {
  operations: 'Casework and workload',
  delivery: 'Assistance delivered',
  population: 'Who the office reaches',
  quality: 'Data quality and completeness',
};

/**
 * What a report is allowed to be about.
 *
 * The master command asks for **aggregate-first** reporting: no names by
 * default, drilling to person level only when necessary. So the grain is a
 * property of the report itself rather than a choice a screen makes, and every
 * person-level report carries a separate permission and a stated reason for
 * needing names at all (`DL-104`).
 */
export type ReportGrain = 'aggregate' | 'person-level';

/** Which filters a report actually honours. Offering one it ignores is a lie. */
export interface ReportFilterSupport {
  readonly period: boolean;
  readonly barangay: boolean;
  readonly program: boolean;
  readonly status: boolean;
  readonly caseworker: boolean;
}

const NONE: ReportFilterSupport = {
  period: false,
  barangay: false,
  program: false,
  status: false,
  caseworker: false,
};

export interface ReportDefinition {
  readonly id: ReportId;
  readonly area: ReportArea;
  readonly title: string;
  /** The question this answers, in one sentence, in an officer's words. */
  readonly question: string;
  readonly grain: ReportGrain;
  readonly permission: Permission;
  /**
   * Why person-level detail is necessary, for the reports that need it.
   *
   * `null` on every aggregate report. A person-level report **must** state
   * this: "we have always shown names here" is not a lawful basis, and writing
   * the reason down is what makes it reviewable (`DL-104`).
   */
  readonly personLevelJustification: string | null;
  readonly filters: ReportFilterSupport;
  /** What the value column counts, so a header never has to be guessed at. */
  readonly unit: string;
  /**
   * A caution rendered above the report.
   *
   * Used where a number invites a wrong reading — most importantly staff
   * workload, which the master command warns must not become a performance
   * ranking (`DL-107`).
   */
  readonly caution: string | null;
}

export const REPORT_CATALOGUE: readonly ReportDefinition[] = [
  {
    id: 'caseload',
    area: 'operations',
    title: 'Social welfare caseload',
    question: 'How many cases is the office carrying, and in what state?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, barangay: true, status: true },
    unit: 'Cases',
    caution: null,
  },
  {
    id: 'assistance-pipeline',
    area: 'operations',
    title: 'Assistance pipeline',
    question: 'Where are assistance requests sitting on their way to a decision?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, barangay: true, program: true, status: true },
    unit: 'Requests',
    caution: null,
  },
  {
    id: 'case-aging',
    area: 'operations',
    title: 'Case aging and turnaround',
    question: 'How long have open requests been waiting?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, barangay: true, program: true },
    unit: 'Requests',
    caution:
      'Waiting time, not lateness. The office has adopted no service standard for these, so ' +
      'nothing here is behind a target.',
  },
  {
    id: 'visit-workload',
    area: 'operations',
    title: 'Field visit workload',
    question: 'How many visits are scheduled, done, or not completed?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, barangay: true },
    unit: 'Visits',
    caution: null,
  },
  {
    id: 'staff-workload',
    area: 'operations',
    title: 'Staff workload',
    question: 'How is open work distributed across the office right now?',
    grain: 'aggregate',
    permission: 'staff.view',
    personLevelJustification: null,
    filters: { ...NONE, barangay: true },
    unit: 'Open items',
    caution:
      'This counts what each person is carrying so work can be moved. It is not a productivity ' +
      'measure and must not be read as one: a heavy caseload is usually a hard caseload, and the ' +
      'office cannot see from a count who is doing well.',
  },
  {
    id: 'program-utilisation',
    area: 'delivery',
    title: 'Programme utilisation',
    question: 'Which programmes are being used, and how much has gone out?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, program: true, barangay: true },
    unit: 'Releases',
    caution: null,
  },
  {
    id: 'release-status',
    area: 'delivery',
    title: 'Release and distribution status',
    question: 'What has been released, what is waiting, and what could not be paid?',
    grain: 'aggregate',
    permission: 'disbursement.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, barangay: true },
    unit: 'Releases',
    caution: null,
  },
  {
    id: 'referral-outcomes',
    area: 'delivery',
    title: 'Referral outcomes',
    question: 'What happened to the people this office referred elsewhere?',
    grain: 'aggregate',
    permission: 'referral.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, barangay: true },
    unit: 'Referrals',
    caution: null,
  },
  {
    id: 'beneficiaries-by-barangay',
    area: 'population',
    title: 'Beneficiaries by barangay',
    question: 'Where in the municipality is assistance reaching people?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, program: true },
    unit: 'People served',
    caution: null,
  },
  {
    id: 'vulnerability-indicators',
    area: 'population',
    title: 'Household vulnerability indicators',
    question: 'Which indicators are present across the households on file?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, barangay: true },
    unit: 'Households',
    caution:
      'Indicators are evidence a caseworker reads, never a decision. Nothing here ranks ' +
      'households or establishes entitlement.',
  },
  {
    id: 'service-reach',
    area: 'population',
    title: 'Demographic service reach',
    question: 'Which sectors is the office reaching, and which it may be missing?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, barangay: true },
    unit: 'People served',
    caution:
      'Sector membership is sensitive. Figures small enough to identify somebody are withheld ' +
      'rather than shown.',
  },
  {
    id: 'repeat-assistance',
    area: 'population',
    title: 'Repeat assistance patterns',
    question: 'How often do households come back, and how soon?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, barangay: true, program: true },
    unit: 'Households',
    caution:
      'A household returning is a fact about their circumstances, not about them. This exists ' +
      'for planning, and it decides nobody’s eligibility.',
  },
  {
    id: 'requirement-bottlenecks',
    area: 'quality',
    title: 'Requirements bottlenecks',
    question: 'Which documents hold applications up most often?',
    grain: 'aggregate',
    permission: 'report.view',
    personLevelJustification: null,
    filters: { ...NONE, period: true, program: true },
    unit: 'Requests held',
    caution: null,
  },
  {
    id: 'data-completeness',
    area: 'quality',
    title: 'Data completeness and verification',
    question: 'Which records are missing something the office needs?',
    grain: 'person-level',
    permission: 'report.export-person-level',
    // The one report that must name people. A completeness report exists so
    // somebody can go and fix the records it names; a count of "42 incomplete"
    // is unactionable, and an officer would have to search for them by hand.
    personLevelJustification:
      'A completeness report is worked through record by record. A count cannot be acted on — ' +
      'somebody has to open each named record and fill in what is missing.',
    filters: { ...NONE, barangay: true },
    unit: 'Records',
    caution:
      'This report names people, because it exists to be corrected record by record. Do not ' +
      'circulate it outside the office.',
  },
];

export function reportById(id: ReportId): ReportDefinition | null {
  return REPORT_CATALOGUE.find((report) => report.id === id) ?? null;
}

export function reportsInArea(area: ReportArea): readonly ReportDefinition[] {
  return REPORT_CATALOGUE.filter((report) => report.area === area);
}

/**
 * Whether a definition is internally coherent.
 *
 * Asserted rather than assumed: a person-level report with no stated reason is
 * the exact drift this catalogue exists to prevent, and it would arrive as a
 * one-line edit that looks harmless in review.
 */
export type ReportProblem =
  | 'person-level-without-justification'
  | 'aggregate-with-justification'
  | 'person-level-without-export-permission'
  | 'missing-question'
  | 'missing-unit';

export function reportProblems(report: ReportDefinition): readonly ReportProblem[] {
  const problems: ReportProblem[] = [];

  if (report.grain === 'person-level' && (report.personLevelJustification ?? '').trim() === '') {
    problems.push('person-level-without-justification');
  }
  if (report.grain === 'aggregate' && report.personLevelJustification !== null) {
    problems.push('aggregate-with-justification');
  }
  // Naming people is a higher bar than reading a count of them.
  if (report.grain === 'person-level' && report.permission === 'report.view') {
    problems.push('person-level-without-export-permission');
  }
  if (report.question.trim() === '') {
    problems.push('missing-question');
  }
  if (report.unit.trim() === '') {
    problems.push('missing-unit');
  }

  return problems;
}
