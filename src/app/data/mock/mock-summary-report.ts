import {
  ASSISTANCE_STATUS_CATALOG,
  EXPORT_HANDLING_NOTICE,
  SENSITIVE_SECTORS,
  SMALL_CELL_BASIS,
  SMALL_CELL_PROVENANCE,
  SMALL_CELL_THRESHOLD,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTORS,
  VULNERABILITY_SECTOR_LABELS,
  asIsoDate,
  asIsoDateTime,
  barangayName,
  centavos,
  csvCell,
  describePesos,
  isSmallCell,
  isTerminalAssistanceStatus,
  type AssistanceProgram,
  type AssistanceRequest,
  type AuthenticatedUser,
  type Release,
  type Resident,
  type SummaryCell,
  type SummaryMeasure,
  type SummaryReport,
  type SummaryRow,
  type SummarySection,
  type SummaryReportFilter,
  type SummaryWithheldReason,
} from '@domain/index';

/**
 * The summary report composed from the mock seeds, for the local mock set only (`DL-228`).
 *
 * It follows the server's rules where they decide what may be shown — people are suppressed cell
 * by cell with totals taken before (`DL-105`), a protected sector is uncounted for a reader not
 * cleared, nothing is overdue (`DL-101`) — and is otherwise deliberately plain. The digital IDs are
 * never counted here: the mock set keeps no register to count them from, and a zero would read as
 * "none released".
 */
export interface MockSummaryInput {
  readonly user: AuthenticatedUser;
  readonly filter: SummaryReportFilter;
  readonly today: string;
  readonly requests: readonly AssistanceRequest[];
  readonly releases: readonly Release[];
  readonly programs: readonly AssistanceProgram[];
  readonly resident: (id: Resident['id']) => Resident | undefined;
  readonly sensitiveCleared: boolean;
}

const WAITING_ON_RESIDENT = new Set(['returned', 'scheduled']);
const TOTAL_BEFORE = 'Total (includes withheld figures)';

export function composeMockSummary(input: MockSummaryInput): SummaryReport {
  const { filter, user } = input;
  const to = filter.to ?? input.today;
  const from = filter.from ?? `${to.slice(0, 4)}-01-01`;
  const inPeriod = (moment: string | null): boolean =>
    moment !== null && moment.slice(0, 10) >= from && moment.slice(0, 10) <= to;
  const ageOn = (resident: Resident, day: string): number => {
    const [by, bm, bd] = resident.birthDate.split('-').map(Number);
    const [y, m, d] = day.split('-').map(Number);
    const years = (y ?? 0) - (by ?? 0);
    return (m ?? 0) < (bm ?? 0) || ((m ?? 0) === (bm ?? 0) && (d ?? 0) < (bd ?? 0))
      ? years - 1
      : years;
  };
  const personFits = (resident: Resident | undefined, day: string): boolean => {
    if (resident === undefined) return false;
    if (user.barangayId !== null && resident.address.barangayId !== user.barangayId) return false;
    if (filter.barangayId !== undefined && resident.address.barangayId !== filter.barangayId) {
      return false;
    }
    if (filter.sex !== undefined && resident.sex !== filter.sex) return false;
    if (filter.sector !== undefined && !resident.sectors.includes(filter.sector)) return false;
    if (filter.age !== undefined) {
      const age = ageOn(resident, day);
      const fits =
        filter.age === '0-17'
          ? age <= 17
          : filter.age === '18-59'
            ? age >= 18 && age <= 59
            : age >= 60;
      if (!fits) return false;
    }
    return true;
  };

  const requests = input.requests.filter(
    (request) =>
      request.status !== 'draft' &&
      (filter.programId === undefined || request.programId === filter.programId) &&
      personFits(input.resident(request.residentId), (request.submittedAt ?? to).slice(0, 10)),
  );
  const byRequest = new Map(requests.map((request) => [request.id, request]));
  const releases = input.releases.filter(
    (release) =>
      release.status === 'released' &&
      inPeriod(release.releasedAt) &&
      byRequest.has(release.requestId),
  );
  const received = requests.filter((request) => inPeriod(request.submittedAt));
  const rejected = received.filter((request) => request.status === 'rejected');
  const open = requests.filter((request) => !isTerminalAssistanceStatus(request.status));
  const amountCentavos = releases.reduce(
    (sum, release) => sum + (release.amount?.centavos ?? 0),
    0,
  );
  const goods = releases.filter((release) => release.amount === null).length;
  const persons = [...new Set(releases.map((release) => release.residentId))]
    .map((id) => input.resident(id))
    .filter((resident): resident is Resident => resident !== undefined);
  const personsServed = persons.length;

  const peopleRows = (
    rows: readonly { key: string; label: string; count: number }[],
    uncounted: readonly { key: string; label: string }[],
  ): { rows: SummaryRow[]; withheld: number } => {
    let withheld = 0;
    const out: SummaryRow[] = rows.map((row) => {
      if (isSmallCell(row.count)) {
        withheld += 1;
        return withheldRow(row.key, row.label, 'small-cell');
      }
      const share = personsServed === 0 ? 0 : Math.round((row.count * 100) / personsServed);
      return {
        key: row.key,
        label: row.label,
        values: { persons: row.count, share_percent: share },
        withheld: {},
      };
    });
    out.push(...uncounted.map((row) => withheldRow(row.key, row.label, 'protected-sector')));
    return { rows: out, withheld };
  };
  // The server's words (backend `notice` in summary.ts, ADR 0007's amendment), so a demo reads alike.
  const notice = (withheld: number, hidden: readonly string[], totalled = false): string | null => {
    const parts: string[] = [];
    if (withheld > 0) {
      const one = withheld === 1;
      parts.push(
        `${one ? 'One figure is' : `${withheld} figures are`} withheld because ` +
          `${one ? 'it counts' : 'each counts'} fewer than ${SMALL_CELL_THRESHOLD} people, few enough ` +
          'to identify someone. Withheld does not mean zero.',
      );
      if (totalled) {
        parts.push(`The total still includes ${one ? 'it' : 'them'}.`);
      }
    }
    if (hidden.length > 0) {
      const it = hidden.length === 1 ? 'it' : 'them';
      parts.push(
        `The ${hidden.join(' and ')} ${hidden.length === 1 ? 'sector is' : 'sectors are'} protected ` +
          `by law (RA 9262, RA 9344), so your account does not count ${it}` +
          `${totalled ? `, and the total leaves ${it} out.` : '.'}`,
      );
    }
    return parts.length === 0 ? null : parts.join(' ');
  };

  const sex = peopleRows(
    (['female', 'male'] as const).map((key) => ({
      key,
      label: key === 'female' ? 'Female' : 'Male',
      count: persons.filter((person) => person.sex === key).length,
    })),
    [],
  );
  const age = peopleRows(
    [
      { key: '0-17', label: 'Children (0–17)', min: 0, max: 17 },
      { key: '18-59', label: 'Adults (18–59)', min: 18, max: 59 },
      { key: '60-plus', label: 'Seniors (60 and over)', min: 60, max: 200 },
    ].map((band) => ({
      key: band.key,
      label: band.label,
      count: persons.filter((person) => {
        const years = ageOn(person, to);
        return years >= band.min && years <= band.max;
      }).length,
    })),
    [],
  );
  const shownSectors = VULNERABILITY_SECTORS.filter(
    (sector) => input.sensitiveCleared || !SENSITIVE_SECTORS.includes(sector),
  );
  const hiddenSectors = VULNERABILITY_SECTORS.filter((sector) => !shownSectors.includes(sector));
  const sector = peopleRows(
    shownSectors.map((key) => ({
      key,
      label: VULNERABILITY_SECTOR_LABELS[key],
      count: persons.filter((person) => person.sectors.includes(key)).length,
    })),
    hiddenSectors.map((key) => ({ key, label: VULNERABILITY_SECTOR_LABELS[key] })),
  );

  const months = twelveMonths(to);
  const monthRows: SummaryRow[] = months.map((month) => {
    const monthReleases = releases.filter((release) => release.releasedAt?.startsWith(month));
    return {
      key: month,
      label: monthLabel(month),
      values: {
        received: received.filter((request) => request.submittedAt?.startsWith(month)).length,
        served: monthReleases.length,
        amount_centavos: monthReleases.reduce((sum, r) => sum + (r.amount?.centavos ?? 0), 0),
      },
      withheld: {},
    };
  });
  const programRows: SummaryRow[] = input.programs.map((program) => {
    const mine = releases.filter(
      (release) => byRequest.get(release.requestId)?.programId === program.id,
    );
    return {
      key: program.id,
      label: program.name,
      values: {
        received: received.filter((request) => request.programId === program.id).length,
        served: mine.length,
        rejected: rejected.filter((request) => request.programId === program.id).length,
        open_now: open.filter((request) => request.programId === program.id).length,
        amount_centavos: mine.reduce((sum, release) => sum + (release.amount?.centavos ?? 0), 0),
      },
      withheld: {},
    };
  });
  const barangayRows: SummaryRow[] = TAYTAY_BARANGAYS.filter(
    (barangay) =>
      (user.barangayId === null || barangay.id === user.barangayId) &&
      (filter.barangayId === undefined || barangay.id === filter.barangayId),
  ).map((barangay) => {
    const mine = releases.filter(
      (release) => byRequest.get(release.requestId)?.barangayId === barangay.id,
    );
    return {
      key: barangay.id,
      label: barangay.name,
      values: {
        served: mine.length,
        amount_centavos: mine.reduce((sum, release) => sum + (release.amount?.centavos ?? 0), 0),
        open_now: open.filter((request) => request.barangayId === barangay.id).length,
      },
      withheld: {},
    };
  });
  const stages = [...new Set(open.map((request) => request.status))];
  const stageRows: SummaryRow[] = stages.map((status) => ({
    key: status,
    label: ASSISTANCE_STATUS_CATALOG[status].label,
    values: {
      waiting_on: WAITING_ON_RESIDENT.has(status) ? 'resident' : 'office',
      requests: open.filter((request) => request.status === status).length,
    },
    withheld: {},
  }));

  const personsWithheld = isSmallCell(personsServed);
  const women = persons.filter((person) => person.sex === 'female').length;
  const words = filterWords(filter, input.programs);
  const periodLabel = `${dayLabel(from)} to ${dayLabel(to)}`;
  const sections: SummarySection[] = [
    section('at-a-glance', 'A', 'At a glance', {
      tiles: [
        tile('received', 'Received', received.length, 'records', 'Requests filed in the period'),
        tile('served', 'Served', releases.length, 'records', 'Releases handed over in the period'),
        {
          key: 'persons_served',
          label: 'Persons served',
          value: personsWithheld ? null : personsServed,
          measure: 'people',
          withheld: personsWithheld ? 'small-cell' : null,
          hint: 'Each person once',
        },
        tile(
          'amount_released',
          'Amount released',
          amountCentavos,
          'centavos',
          'Money handed over in the period',
        ),
        tile(
          'rejected',
          'Rejected',
          rejected.length,
          'records',
          'Requests decided against in the period',
        ),
        tile(
          'open_now',
          'Open now',
          open.length,
          'records',
          'Requests not yet closed, as of today',
        ),
      ],
      suppressionNotice: personsWithheld ? notice(1, []) : null,
    }),
    section('month-by-month', 'B', 'Month by month', {
      note: 'The twelve months to the end of the period, by the month each request was filed and each release handed over.',
      columns: [
        { key: 'received', label: 'Received', measure: 'records' },
        { key: 'served', label: 'Served', measure: 'records' },
        { key: 'amount_centavos', label: 'Amount released', measure: 'centavos' },
      ],
      rows: monthRows,
      totals: sumColumns(monthRows, ['received', 'served', 'amount_centavos']),
      totalsLabel: 'Total',
    }),
    section('by-program', 'C', 'By programme', {
      note: 'Received and rejected in the period, served in the period, and open as of today.',
      columns: [
        { key: 'received', label: 'Received', measure: 'records' },
        { key: 'served', label: 'Served', measure: 'records' },
        { key: 'rejected', label: 'Rejected', measure: 'records' },
        { key: 'open_now', label: 'Open now', measure: 'records' },
        { key: 'amount_centavos', label: 'Amount released', measure: 'centavos' },
      ],
      rows: programRows,
      totals: sumColumns(programRows, [
        'received',
        'served',
        'rejected',
        'open_now',
        'amount_centavos',
      ]),
      totalsLabel: 'Total',
    }),
    section('by-barangay', 'D', 'By barangay', {
      note: 'Every barangay, those with nothing included. Served is releases handed over in the period.',
      columns: [
        { key: 'served', label: 'Served', measure: 'records' },
        { key: 'amount_centavos', label: 'Amount released', measure: 'centavos' },
        { key: 'open_now', label: 'Open now', measure: 'records' },
      ],
      rows: barangayRows,
      totals: sumColumns(barangayRows, ['served', 'amount_centavos', 'open_now']),
      totalsLabel: 'Total',
    }),
    peopleSection(
      'by-sex',
      'E',
      'Sex',
      'Each person once, as the registry records them.',
      sex.rows,
      personsServed,
      TOTAL_BEFORE,
      notice(sex.withheld, [], true),
    ),
    peopleSection(
      'by-age',
      'F',
      'Age group',
      'Each person once, by their age at the end of the period.',
      age.rows,
      personsServed,
      TOTAL_BEFORE,
      notice(age.withheld, [], true),
    ),
    peopleSection(
      'by-sector',
      'G',
      'Sector',
      'Each person under every sector the registry records for them now, so the rows overlap.',
      sector.rows,
      personsServed,
      'Persons served (includes withheld figures)',
      notice(
        sector.withheld,
        hiddenSectors.map((key) => VULNERABILITY_SECTOR_LABELS[key]),
        true,
      ),
    ),
    section('open-by-stage', 'H', 'Open requests by stage, as of today', {
      note: '"Waiting on the resident" means the office returned the request for something from her, or set the payout she must come to.',
      columns: [
        { key: 'waiting_on', label: 'Waiting on', measure: 'records' },
        { key: 'requests', label: 'Requests', measure: 'records' },
      ],
      rows: stageRows,
      totals: { requests: open.length },
      totalsLabel: 'Total',
    }),
    section('digital-ids', 'I', 'Digital IDs', {
      available: false,
      unavailableReason:
        'The local mock set keeps no digital ID register, so IDs are not counted here.',
    }),
  ];

  return {
    letterhead: [
      'Republic of the Philippines',
      'Province of Rizal',
      'Municipality of Taytay',
      'Municipal Social Welfare and Development Office',
    ],
    title: 'Assistance summary report',
    period: { from: asIsoDate(from), to: asIsoDate(to), label: periodLabel },
    filtersInWords: words,
    executiveSummary: {
      paragraphs: [
        `This report covers the assistance work of the Municipal Social Welfare and Development Office of Taytay from ${periodLabel}. ` +
          `The office received ${received.length} requests and handed over ${releases.length} releases` +
          (personsWithheld ? '.' : ` to ${personsServed} persons.`),
        `${rejected.length} requests were decided against, and ${open.length} are open today. ` +
          'No request is counted as overdue: the office has set no service standard for assistance requests.',
      ],
      figures: {
        received: received.length,
        served: releases.length,
        personsServed: personsWithheld ? null : personsServed,
        personsServedWithheld: personsWithheld,
        amountReleasedCentavos: amountCentavos,
        goodsReleased: goods,
        rejected: rejected.length,
        topProgram: null,
        topBarangay: null,
        womenSharePercent:
          personsServed === 0 || isSmallCell(women)
            ? null
            : Math.round((women * 100) / personsServed),
        averageProcessingDays: null,
        processingBasis: 'The local mock set does not time requests.',
        openNow: open.length,
        overdueNow: null,
        overdueBasis:
          'The office has set no service standard for assistance requests, so none is counted as overdue (DL-101).',
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

function withheldRow(key: string, label: string, reason: SummaryWithheldReason): SummaryRow {
  return {
    key,
    label,
    values: { persons: null, share_percent: null },
    withheld: { persons: reason, share_percent: reason },
  };
}

function tile(
  key: string,
  label: string,
  value: number,
  measure: 'records' | 'centavos',
  hint: string,
): SummarySection['tiles'][number] {
  return { key, label, value, measure, withheld: null, hint };
}

function section(
  key: SummarySection['key'],
  letter: SummarySection['letter'],
  title: string,
  rest: Partial<SummarySection>,
): SummarySection {
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

function peopleSection(
  key: SummarySection['key'],
  letter: SummarySection['letter'],
  title: string,
  note: string,
  rows: readonly SummaryRow[],
  total: number,
  totalsLabel: string,
  suppressionNotice: string | null,
): SummarySection {
  return section(key, letter, title, {
    note,
    columns: [
      { key: 'persons', label: 'Persons', measure: 'people' },
      { key: 'share_percent', label: 'Share', measure: 'percent' },
    ],
    rows,
    totals: { persons: total },
    totalsLabel,
    suppressionNotice,
  });
}

function sumColumns(rows: readonly SummaryRow[], keys: readonly string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const key of keys) {
    totals[key] = rows.reduce((sum, row) => {
      const value = row.values[key];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  }
  return totals;
}

function twelveMonths(to: string): readonly string[] {
  const last = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7)) - 1;
  return Array.from({ length: 12 }, (_, index) => {
    const month = last - 11 + index;
    return `${Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}`;
  });
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function filterWords(
  filter: SummaryReportFilter,
  programs: readonly AssistanceProgram[],
): readonly string[] {
  const words: string[] = [];
  if (filter.barangayId !== undefined) words.push(`Barangay ${barangayName(filter.barangayId)}`);
  if (filter.programId !== undefined) {
    const name = programs.find((program) => program.id === filter.programId)?.name;
    words.push(`the programme ${name ?? 'chosen'}`);
  }
  if (filter.sex !== undefined) words.push(filter.sex === 'female' ? 'women' : 'men');
  if (filter.age !== undefined) {
    words.push(
      filter.age === '0-17'
        ? 'children (0–17)'
        : filter.age === '18-59'
          ? 'adults (18–59)'
          : 'seniors (60 and over)',
    );
  }
  if (filter.sector !== undefined) {
    words.push(`persons the registry records as ${VULNERABILITY_SECTOR_LABELS[filter.sector]}`);
  }
  return words;
}

/** The tables as CSV, the conditions before the first figure, as the server writes them (`DL-106`). */
export function summaryCsv(
  report: Pick<
    SummaryReport,
    'letterhead' | 'title' | 'period' | 'filtersInWords' | 'footer' | 'disclosure'
  > & { readonly sections: readonly SummarySection<string>[] },
  unfiltered = 'Nothing: every barangay, programme and person',
): string {
  const cell = (
    value: SummaryCell | undefined,
    measure: SummaryMeasure,
    withheld: boolean,
  ): string => {
    if (withheld || value === null || value === undefined) return csvCell('Withheld');
    if (typeof value === 'string') return csvCell(value);
    if (measure === 'centavos') return csvCell(describePesos(centavos(value)));
    if (measure === 'percent') return `${value}%`;
    return String(value);
  };
  const lines = [
    ...report.letterhead.map((line) => csvCell(line)),
    csvCell(report.title),
    `Period covered,${csvCell(report.period.label)}`,
    `Narrowed to,${csvCell(report.filtersInWords.length === 0 ? unfiltered : report.filtersInWords.join('; '))}`,
    `Generated at,${csvCell(report.footer.generatedAt)}`,
    `Generated by,${csvCell(report.footer.generatedBy)}`,
    `Names individuals,${csvCell('No')}`,
    `Why figures are withheld,${csvCell(report.disclosure.basis)}`,
    `Handling,${csvCell(report.footer.handlingNotice)}`,
    '',
  ];
  for (const part of report.sections) {
    lines.push(csvCell(`${part.letter}. ${part.title}`));
    if (!part.available) {
      lines.push(csvCell(part.unavailableReason ?? 'Not available.'), '');
      continue;
    }
    for (const entry of part.tiles) {
      lines.push(
        `${csvCell(entry.label)},${cell(entry.value, entry.measure, entry.withheld !== null)}`,
      );
    }
    if (part.columns.length > 0) {
      lines.push(['', ...part.columns.map((column) => csvCell(column.label))].join(','));
      for (const row of part.rows) {
        lines.push(
          [
            csvCell(row.label),
            ...part.columns.map((column) =>
              cell(row.values[column.key], column.measure, row.withheld[column.key] !== undefined),
            ),
          ].join(','),
        );
      }
    }
    if (part.suppressionNotice !== null) lines.push(csvCell(part.suppressionNotice));
    lines.push('');
  }
  return lines.join('\r\n');
}
