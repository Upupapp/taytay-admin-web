import {
  EXPORT_HANDLING_NOTICE,
  RESIDENT_AGE_GROUPS,
  RESIDENT_AGE_GROUP_LABELS,
  SENSITIVE_SECTORS,
  SMALL_CELL_BASIS,
  SMALL_CELL_PROVENANCE,
  SMALL_CELL_THRESHOLD,
  asIsoDateTime,
  isSmallCell,
  type AuthenticatedUser,
  type CitizenReport,
  type CitizenReportSectionKey,
  type ReportRow,
  type ResidentSummary,
  type SummaryFigure,
  type SummaryRow,
  type SummarySection,
  type SummarySectionLetter,
  type SummaryTile,
} from '@domain/index';

import { dayLabel, monthLabel } from './mock-summary-report';

export interface MockCitizenReportInput {
  readonly user: AuthenticatedUser;
  /** The overview counted over the mock registry, with the report's period. */
  readonly summary: ResidentSummary;
  /** This month's birthdays at each RA 11982 milestone age, raw. */
  readonly milestones: readonly { readonly age: number; readonly count: number }[];
  readonly words: readonly string[];
  readonly cleared: boolean;
}

const TOTAL_BEFORE = 'Total, counted before anything was withheld';

/**
 * The citizen registry report over the mock registry, in the shape the API composes it (backend
 * ADR 0007): the overview's own figures laid out as sections A to G, people withheld below the
 * threshold. Sample figures only, behind the mock.
 */
export function composeMockCitizenReport(input: MockCitizenReportInput): CitizenReport {
  const { summary, user, cleared } = input;
  const total = summary.residents.current;
  const today = summary.period.to;

  const sections: SummarySection<CitizenReportSectionKey>[] = [
    section('at-a-glance', 'A', 'At a glance', {
      note: `The registry as it stands on ${dayLabel(today)}; "this period" is ${dayLabel(summary.period.from)} to date.`,
      tiles: [
        {
          key: 'on-registry',
          label: 'On the registry',
          value: total,
          measure: 'records',
          withheld: null,
          hint: `Active records under this filter; ${summary.residents.previous} when the period began.`,
        },
        figureTile(
          'registered',
          'Registered this period',
          summary.registered.current,
          'Records created in the period.',
        ),
        countTile(
          'women',
          'Women and girls',
          summary.totalBySex.female,
          'Active records recorded as female.',
        ),
        countTile(
          'men',
          'Men and boys',
          summary.totalBySex.male,
          'Active records recorded as male.',
        ),
        figureTile(
          'on-app',
          'Linked to an app account',
          summary.funnel.onApp,
          'Records linked to an open app account.',
        ),
        figureTile(
          'active-ids',
          'Holding a Digital ID',
          summary.funnel.activeIds,
          'Records holding a Digital ID in force.',
        ),
      ],
    }),
    oneColumn(
      'registry-by-month',
      'B',
      'The registry over twelve months',
      'Active records at the end of each month under this filter, the current month as it stands today.',
      'On the registry at month end',
      summary.residents.byMonth.map((point, index, all) => ({
        key: point.month,
        label: `${monthLabel(point.month)}${index === all.length - 1 ? ' (to date)' : ''}`,
        figure: point.figure,
      })),
    ),
    section('by-barangay', 'C', 'Residents by barangay', {
      columns: [
        { key: 'residents', label: 'Residents', measure: 'people' },
        { key: 'share', label: 'Share of the registry', measure: 'percent' },
      ],
      rows: summary.byBarangay.rows.map((row) =>
        withShare(row.key, row.label, fromRow(row), total),
      ),
      totals: { residents: summary.byBarangay.total },
      totalsLabel: TOTAL_BEFORE,
    }),
    section('by-age-sex', 'D', 'Residents by age group and sex', {
      note: 'Age today, by the birth date on the record.',
      columns: [
        { key: 'female', label: 'Female', measure: 'people' },
        { key: 'male', label: 'Male', measure: 'people' },
      ],
      rows: RESIDENT_AGE_GROUPS.map((group): SummaryRow => {
        const cell = (sex: 'female' | 'male') =>
          fromRow(summary.byAgeSex.rows.find((row) => row.key === `${group}.${sex}`));
        const female = cell('female');
        const male = cell('male');
        return {
          key: group,
          label: RESIDENT_AGE_GROUP_LABELS[group],
          values: { female: female.value, male: male.value },
          withheld: {
            ...(female.withheld ? { female: 'small-cell' as const } : {}),
            ...(male.withheld ? { male: 'small-cell' as const } : {}),
          },
        };
      }),
      totals: { female: summary.totalBySex.female, male: summary.totalBySex.male },
      totalsLabel: TOTAL_BEFORE,
    }),
    section('by-sector', 'E', 'Residents by sector', {
      note: 'Sectors overlap: one person may be recorded under several, so no total is given.',
      columns: [{ key: 'residents', label: 'Residents', measure: 'people' }],
      rows: summary.bySector.rows.map((row): SummaryRow => {
        if (!cleared && SENSITIVE_SECTORS.some((sector) => sector === row.key)) {
          return {
            key: row.key,
            label: row.label,
            values: { residents: null },
            withheld: { residents: 'protected-sector' },
          };
        }
        return peopleRow(row.key, row.label, fromRow(row));
      }),
    }),
    section('registry-to-id', 'F', 'From the registry to a Digital ID', {
      columns: [
        { key: 'people', label: 'Residents', measure: 'people' },
        { key: 'share', label: 'Share of the registry', measure: 'percent' },
      ],
      rows: [
        withShare('on-registry', 'On the registry', countFigure(total), total, 'people'),
        withShare('on-app', 'Linked to an app account', summary.funnel.onApp, total, 'people'),
        withShare('verified', 'Account verified', summary.funnel.verified, total, 'people'),
        withShare(
          'active-ids',
          'Holding a Digital ID in force',
          summary.funnel.activeIds,
          total,
          'people',
        ),
      ],
    }),
    oneColumn(
      'this-month',
      'G',
      `This month: ${monthLabel(summary.thisMonth.month)}`,
      'Birthdays by the birth date on the record; RA 11982 marks 80, 85, 90, 95 and 100 with a cash gift. These figures decide nothing.',
      'Residents',
      [
        { key: 'turning-18', label: 'Turning 18', figure: summary.thisMonth.turning18 },
        { key: 'turning-60', label: 'Turning 60', figure: summary.thisMonth.turning60 },
        ...input.milestones.map((entry) => ({
          key: `turning-${entry.age}`,
          label: `Turning ${entry.age} (an RA 11982 milestone)`,
          figure: countFigure(entry.count),
        })),
        {
          key: 'solo-parent-ids-due',
          label: 'Solo parent IDs ending',
          figure: summary.thisMonth.soloParentIdsDue,
        },
        {
          key: 'pwd-ids-expiring',
          label: 'PWD IDs ending',
          figure: summary.thisMonth.pwdIdsExpiring,
        },
      ],
    ),
  ];

  const female = summary.totalBySex.female;
  const male = summary.totalBySex.male;
  const womenSharePercent =
    female + male > 0 && !isSmallCell(female) && !isSmallCell(male)
      ? share(female, female + male)
      : null;
  const scope =
    input.words.length === 0 ? 'Across the municipality' : `For ${input.words.join(', ')}`;

  return {
    letterhead: [
      'Republic of the Philippines',
      'Province of Rizal',
      'Municipality of Taytay',
      'Municipal Social Welfare and Development Office',
    ],
    title: 'Citizen Registry Report',
    period: {
      from: summary.period.from,
      to: today,
      label: `${dayLabel(summary.period.from)} to ${dayLabel(today)}`,
    },
    filtersInWords: input.words,
    executiveSummary: {
      paragraphs: [
        `${scope}, the registry holds ${total} active records on ${dayLabel(today)}, against ${summary.residents.previous} on ${dayLabel(summary.period.from)}.`,
        womenSharePercent === null
          ? 'The share by sex is not given: one of the figures is too small to publish.'
          : `Women and girls make up ${womenSharePercent}% of the registry and men and boys ${100 - womenSharePercent}%.`,
      ],
      figures: {
        residents: total,
        residentsPrevious: summary.residents.previous,
        registered: summary.registered.current.value,
        registeredWithheld: summary.registered.current.withheld,
        womenSharePercent,
        onApp: summary.funnel.onApp.value,
        verified: summary.funnel.verified.value,
        activeIds: summary.funnel.activeIds.value,
      },
    },
    sections,
    signatories: {
      preparedBy: { name: user.displayName, title: null },
      notedBy: { name: null, title: 'Municipal Social Welfare and Development Officer' },
      approvedBy: { name: null, title: 'Municipal Mayor' },
    },
    footer: {
      generatedAt: asIsoDateTime(new Date()),
      generatedBy: user.displayName,
      handlingNotice: EXPORT_HANDLING_NOTICE,
    },
    disclosure: {
      threshold: SMALL_CELL_THRESHOLD,
      provenance: SMALL_CELL_PROVENANCE,
      basis: SMALL_CELL_BASIS,
    },
  };
}

function share(part: number, total: number): number {
  return total === 0 ? 0 : Math.floor((part * 200 + total) / (total * 2));
}

function countFigure(value: number): SummaryFigure {
  return isSmallCell(value) ? { value: null, withheld: true } : { value, withheld: false };
}

function fromRow(row: ReportRow | undefined): SummaryFigure {
  if (row === undefined) return { value: 0, withheld: false };
  return row.isWithheld === true ? { value: null, withheld: true } : countFigure(row.value);
}

function figureTile(key: string, label: string, figure: SummaryFigure, hint: string): SummaryTile {
  return {
    key,
    label,
    value: figure.value,
    measure: 'people',
    withheld: figure.withheld ? 'small-cell' : null,
    hint,
  };
}

function countTile(key: string, label: string, value: number, hint: string): SummaryTile {
  return figureTile(key, label, countFigure(value), hint);
}

function peopleRow(key: string, label: string, figure: SummaryFigure): SummaryRow {
  return {
    key,
    label,
    values: { residents: figure.value },
    withheld: figure.withheld ? { residents: 'small-cell' } : {},
  };
}

function withShare(
  key: string,
  label: string,
  figure: SummaryFigure,
  total: number,
  column: 'residents' | 'people' = 'residents',
): SummaryRow {
  return {
    key,
    label,
    values: {
      [column]: figure.value,
      share: figure.value === null ? null : share(figure.value, total),
    },
    withheld: figure.withheld ? { [column]: 'small-cell', share: 'small-cell' } : {},
  };
}

function oneColumn(
  key: CitizenReportSectionKey,
  letter: SummarySectionLetter,
  title: string,
  note: string,
  label: string,
  rows: readonly { readonly key: string; readonly label: string; readonly figure: SummaryFigure }[],
): SummarySection<CitizenReportSectionKey> {
  return section(key, letter, title, {
    note,
    columns: [{ key: 'residents', label, measure: 'people' }],
    rows: rows.map((row) => peopleRow(row.key, row.label, row.figure)),
  });
}

function section(
  key: CitizenReportSectionKey,
  letter: SummarySectionLetter,
  title: string,
  rest: Partial<SummarySection<CitizenReportSectionKey>>,
): SummarySection<CitizenReportSectionKey> {
  return {
    key,
    letter,
    title,
    note: null,
    available: true,
    unavailableReason: null,
    tiles: [],
    columns: [],
    rows: [],
    totals: null,
    totalsLabel: null,
    suppressionNotice: null,
    ...rest,
  };
}
