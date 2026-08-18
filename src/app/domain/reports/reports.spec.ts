import {
  REPORT_CATALOGUE,
  REPORT_AREA_LABELS,
  reportById,
  reportProblems,
  reportsInArea,
  type ReportArea,
  type ReportDefinition,
} from './report-definition';
import {
  SMALL_CELL_BASIS,
  SMALL_CELL_THRESHOLD,
  WITHHELD_DISPLAY,
  describeSuppression,
  isSmallCell,
  suppressSmallCells,
  totalBeforeSuppression,
  withheldCount,
} from './report-disclosure';
import {
  EXPORT_HANDLING_NOTICE,
  PERSON_LEVEL_WARNING,
  csvCell,
  describeFilter,
  manifestHeaderLines,
  type ExportManifest,
  type ReportRow,
} from './report-result';

function row(key: string, value: number): ReportRow {
  return { key, label: key, value };
}

/* ── Criterion: aggregate analytics without exposing names by default ─────── */

describe('the report catalogue', () => {
  it('is aggregate by default', () => {
    const personLevel = REPORT_CATALOGUE.filter((report) => report.grain === 'person-level');

    // One report names people, and it exists to be corrected record by record.
    expect(personLevel).toHaveLength(1);
    expect(personLevel[0]?.id).toBe('data-completeness');
  });

  it('makes every person-level report state why it needs names', () => {
    for (const report of REPORT_CATALOGUE) {
      if (report.grain === 'person-level') {
        expect(report.personLevelJustification?.trim().length ?? 0).toBeGreaterThan(0);
      } else {
        expect(report.personLevelJustification).toBeNull();
      }
    }
  });

  it('holds every report definition to its own coherence rules', () => {
    for (const report of REPORT_CATALOGUE) {
      expect(reportProblems(report)).toEqual([]);
    }
  });

  it('refuses a person-level report that only needs report.view', () => {
    const bad: ReportDefinition = {
      ...(REPORT_CATALOGUE[0] as ReportDefinition),
      grain: 'person-level',
      permission: 'report.view',
      personLevelJustification: 'Because we always have.',
    };

    // Naming people is a higher bar than reading a count of them.
    expect(reportProblems(bad)).toContain('person-level-without-export-permission');
  });

  it('refuses a person-level report with no stated reason', () => {
    const bad: ReportDefinition = {
      ...(REPORT_CATALOGUE[0] as ReportDefinition),
      grain: 'person-level',
      permission: 'report.export-person-level',
      personLevelJustification: '   ',
    };

    expect(reportProblems(bad)).toContain('person-level-without-justification');
  });

  it('covers all fourteen report areas the master command names', () => {
    expect(REPORT_CATALOGUE).toHaveLength(14);
  });

  it('gives every report a question and a unit, not only a title', () => {
    for (const report of REPORT_CATALOGUE) {
      expect(report.question.length).toBeGreaterThan(0);
      expect(report.unit.length).toBeGreaterThan(0);
    }
  });

  it('groups the catalogue into areas the hub can render', () => {
    const areas = Object.keys(REPORT_AREA_LABELS) as ReportArea[];
    const covered = areas.flatMap((area) => reportsInArea(area));

    expect(covered).toHaveLength(REPORT_CATALOGUE.length);
  });

  it('finds a report by id, and returns null rather than throwing', () => {
    expect(reportById('caseload')?.title).toBe('Social welfare caseload');
    expect(reportById('not-a-report' as never)).toBeNull();
  });
});

/* ── Criterion: an aggregate is not automatically anonymous ───────────────── */

describe('small-cell suppression', () => {
  it('withholds a count small enough to identify somebody', () => {
    expect(isSmallCell(1)).toBe(true);
    expect(isSmallCell(SMALL_CELL_THRESHOLD - 1)).toBe(true);
    expect(isSmallCell(SMALL_CELL_THRESHOLD)).toBe(false);
  });

  it('never suppresses zero, because an absence of service is the finding', () => {
    // Hiding "no one in this barangay was served" would hide exactly what a
    // planning report exists to show.
    expect(isSmallCell(0)).toBe(false);
    expect(suppressSmallCells([row('a', 0)])[0]?.isWithheld).toBeUndefined();
  });

  it('withholds the row rather than dropping it', () => {
    const suppressed = suppressSmallCells([row('a', 2), row('b', 9)]);

    // A missing row reads as "none", which is a different and false claim.
    expect(suppressed).toHaveLength(2);
    expect(suppressed[0]?.isWithheld).toBe(true);
    expect(suppressed[0]?.display).toBe(WITHHELD_DISPLAY);
    expect(suppressed[0]?.label).toBe('a');
  });

  it('never rounds a small count up to the threshold', () => {
    const suppressed = suppressSmallCells([row('a', 2)]);

    // Rounding 2 to 5 puts a number in a report that is not true, and somebody
    // will act on it.
    expect(suppressed[0]?.value).toBe(0);
    expect(suppressed[0]?.display).not.toContain(String(SMALL_CELL_THRESHOLD));
  });

  it('strips the drill-down from a withheld row', () => {
    const suppressed = suppressSmallCells([
      { key: 'a', label: 'a', value: 2, routerLink: '/residents' },
    ]);

    // Withholding the figure and leaving a link to the four records behind it
    // would withhold nothing at all.
    expect(suppressed[0]?.routerLink).toBeUndefined();
  });

  it('reports the true total, taken before suppression', () => {
    const rows = [row('a', 2), row('b', 9)];

    // A reader adding up the visible rows would otherwise get 9 and believe it.
    expect(totalBeforeSuppression(rows)).toBe(11);
  });

  it('says on the report that figures are missing, and why the total will not add up', () => {
    const notice = describeSuppression(suppressSmallCells([row('a', 2), row('b', 9)]));

    expect(notice).toContain('withheld');
    expect(notice).toContain('does not add up');
  });

  it('says nothing when nothing was withheld', () => {
    expect(describeSuppression(suppressSmallCells([row('a', 9)]))).toBeNull();
    expect(withheldCount(suppressSmallCells([row('a', 9)]))).toBe(0);
  });

  it('admits the threshold is a convention this office has not confirmed', () => {
    expect(SMALL_CELL_BASIS).toContain('has not yet confirmed');
  });
});

/* ── Criterion: exports show applied filters and generation metadata ──────── */

describe('describing what a report covers', () => {
  it('always names the period, even when nothing was narrowed', () => {
    // A printed report that does not say what it covers will be read as
    // covering everything.
    expect(describeFilter({})).toBe('All time');
  });

  it('uses the labels it is handed rather than raw identifiers', () => {
    const described = describeFilter(
      { period: 'last-30-days', barangayId: 'brgy-san-juan' as never },
      { barangay: 'San Juan' },
    );

    expect(described).toContain('Last 30 days');
    expect(described).toContain('Barangay: San Juan');
    expect(described).not.toContain('brgy-san-juan');
  });

  it('falls back to the identifier rather than silently omitting a filter', () => {
    const described = describeFilter({ barangayId: 'brgy-dolores' as never });

    expect(described).toContain('brgy-dolores');
  });
});

describe('the export manifest', () => {
  const manifest: ExportManifest = {
    reportId: 'caseload',
    reportTitle: 'Social welfare caseload',
    question: 'How many cases is the office carrying?',
    appliedFilterDescription: 'Last 30 days · Barangay: San Juan',
    generatedAt: '2026-08-16T02:00:00.000Z' as ExportManifest['generatedAt'],
    generatedBy: 'Teodoro Lim',
    rowCount: 6,
    includesPersonLevel: false,
    handlingNotice: EXPORT_HANDLING_NOTICE,
    suppressionNotice: null,
  };

  it('puts the conditions inside the file, before the first figure', () => {
    const lines = manifestHeaderLines(manifest);
    const joined = lines.join('\n');

    // A spreadsheet on somebody's desktop in six months has no screen around it.
    expect(joined).toContain('Social welfare caseload');
    expect(joined).toContain('Last 30 days');
    expect(joined).toContain('2026-08-16T02:00:00.000Z');
    expect(joined).toContain('Teodoro Lim');
    expect(joined).toContain('Names individuals,"No"');
  });

  it('carries the handling rule with the file', () => {
    expect(manifestHeaderLines(manifest).join('\n')).toContain('RA 10173');
  });

  it('says in the file when figures were withheld', () => {
    const withSuppression = { ...manifest, suppressionNotice: '2 figures are withheld.' };

    expect(manifestHeaderLines(withSuppression).join('\n')).toContain('Withheld figures');
  });

  it('flags a person-level export in the file itself', () => {
    const personLevel = { ...manifest, includesPersonLevel: true };

    expect(manifestHeaderLines(personLevel).join('\n')).toContain('Names individuals,"Yes"');
  });

  it('warns before naming people, in words a person can act on', () => {
    expect(PERSON_LEVEL_WARNING).toContain('nothing can be recalled');
  });
});

describe('CSV quoting', () => {
  it('quotes a cell so a comma in a name cannot shift a column', () => {
    expect(csvCell('Dela Cruz, Maria')).toBe('"Dela Cruz, Maria"');
  });

  it('escapes an embedded quote rather than breaking the row', () => {
    expect(csvCell('the "old" market')).toBe('"the ""old"" market"');
  });
});

/* ── Criterion: staff workload is not a performance ranking ───────────────── */

describe('staff workload', () => {
  it('carries a caution saying it is not a productivity measure', () => {
    const report = reportById('staff-workload');

    expect(report?.caution).toContain('not a productivity measure');
    expect(report?.caution).toContain('heavy caseload is usually a hard caseload');
  });

  it('is aggregate, and behind the permission to see staff at all', () => {
    const report = reportById('staff-workload');

    expect(report?.grain).toBe('aggregate');
    expect(report?.permission).toBe('staff.view');
  });
});

describe('reports that invite a wrong reading carry a caution', () => {
  it('says vulnerability indicators decide nothing', () => {
    expect(reportById('vulnerability-indicators')?.caution).toContain('never a decision');
  });

  it('says case aging is waiting time, not lateness', () => {
    // No service standard has been adopted, so nothing can be behind a target.
    expect(reportById('case-aging')?.caution).toContain('no service standard');
  });

  it('says repeat assistance decides nobody’s eligibility', () => {
    expect(reportById('repeat-assistance')?.caution).toContain('decides nobody');
  });

  it('warns that the one person-level report must not be circulated', () => {
    expect(reportById('data-completeness')?.caution).toContain('Do not circulate');
  });
});
