import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  ASSISTANCE_STATUS_CATALOG,
  CASE_STATUS_CATALOG,
  DISBURSEMENT_STATUS_CATALOG,
  EXPORT_HANDLING_NOTICE,
  REFERRAL_STATUS_CATALOG,
  REPORT_CATALOGUE,
  SMALL_CELL_BASIS,
  VISIT_STATUS_CATALOG,
  VULNERABILITY_SECTOR_LABELS,
  asIsoDateTime,
  barangayName,
  csvCell,
  describeFilter,
  describeSuppression,
  formatPersonName,
  isReleaseOpen,
  isTaskOpen,
  isWithinBarangayScope,
  manifestHeaderLines,
  reportById,
  suppressSmallCells,
  TAYTAY_BARANGAYS,
  totalBeforeSuppression,
  userHasPermission,
  type AuthenticatedUser,
  type ExportFormat,
  type ReportDefinition,
  type ReportExport,
  type ReportFilter,
  type ReportId,
  type ReportRepository,
  type ReportResult,
  type ReportRow,
  type ReportSeries,
  type VulnerabilitySector,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockCaseStore } from './mock-case.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_DISBURSEMENTS } from './seed/disbursements.seed';
import { MOCK_FIELD_VISITS } from './seed/field-visits.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { MOCK_REFERRALS } from './seed/referrals.seed';
import { MOCK_STAFF } from './seed/staff.seed';

/**
 * The report adapter.
 *
 * Everything here is **aggregate by default** (`DL-104`). Only one report in
 * the catalogue names people, it says why it must, and it sits behind
 * `report.export` rather than `report.view`.
 *
 * Three rules this file enforces rather than assumes:
 *
 *  - **Suppression is not optional.** Every series counting people or
 *    households goes through `suppressSmallCells` on the way out, and there is
 *    no parameter to skip it. A caller cannot ask for the raw figures, because
 *    "just this once" is how a threshold stops being one (`DL-105`).
 *  - **The conditions travel with the figures.** Every result carries the
 *    applied filter in words and the moment it was generated, and every export
 *    repeats them inside the file (`DL-106`).
 *  - **The export is composed here.** A screen holding the fuller result is one
 *    binding away from writing a name into a spreadsheet (`DL-92` restated).
 */
@Injectable()
export class MockReportRepository implements ReportRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly residents = inject(MockResidentStore);
  private readonly cases = inject(MockCaseStore);

  catalogue(): Observable<readonly ReportDefinition[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly ReportDefinition[]>(user, 'report.view');
    if (denied) {
      return denied;
    }
    // Each report carries its own permission; the hub shows only what this
    // account could actually open.
    return this.latency.respond(
      REPORT_CATALOGUE.filter((report) => userHasPermission(user, report.permission)),
    );
  }

  run(id: ReportId, filter: ReportFilter): Observable<ReportResult | null> {
    const user = this.access.currentUser();
    const definition = reportById(id);

    // Not found and not yours read identically (`DL-31`).
    if (
      definition === null ||
      !userHasPermission(user, 'report.view') ||
      !userHasPermission(user, definition.permission)
    ) {
      return this.latency.respond(null);
    }

    return this.latency.respond({
      definition,
      appliedFilter: filter,
      appliedFilterDescription: describeFilter(filter, this.filterLabels(filter)),
      generatedAt: asIsoDateTime(new Date()),
      grain: definition.grain,
      series: this.seriesFor(definition, filter, user),
      caution: definition.caution,
      disclosureBasis: SMALL_CELL_BASIS,
    });
  }

  export(id: ReportId, filter: ReportFilter, format: ExportFormat): Observable<ReportExport> {
    const user = this.access.currentUser();
    const denied = denyUnless<ReportExport>(user, 'report.export');
    if (denied) {
      return denied;
    }
    const definition = reportById(id);
    if (definition === null || !userHasPermission(user, definition.permission)) {
      return denyUnless<ReportExport>(null, 'report.export') as Observable<ReportExport>;
    }

    const series = this.seriesFor(definition, filter, user);
    const rowCount = series.reduce((total, entry) => total + entry.rows.length, 0);
    const suppression = series
      .map((entry) => entry.suppressionNotice)
      .find((notice) => notice !== null);

    const manifest = {
      reportId: definition.id,
      reportTitle: definition.title,
      question: definition.question,
      appliedFilterDescription: describeFilter(filter, this.filterLabels(filter)),
      generatedAt: asIsoDateTime(new Date()),
      generatedBy: user?.displayName ?? 'Unknown',
      rowCount,
      includesPersonLevel: definition.grain === 'person-level',
      handlingNotice: EXPORT_HANDLING_NOTICE,
      suppressionNotice: suppression ?? null,
    };

    const lines = [...manifestHeaderLines(manifest), ''];
    for (const entry of series) {
      lines.push(csvCell(entry.title));
      lines.push(csvCell(entry.summary));
      lines.push(`${csvCell(entry.labelHeader)},${csvCell(entry.valueHeader)}`);
      for (const row of entry.rows) {
        lines.push(`${csvCell(row.label)},${csvCell(row.display ?? String(row.value))}`);
      }
      lines.push(`${csvCell('Total')},${entry.total}`);
      lines.push('');
    }

    return this.latency.respond({
      manifest,
      format,
      content: lines.join('\r\n'),
      filename: `${definition.id}-${manifest.generatedAt.slice(0, 10)}.csv`,
    });
  }

  /* ── The producers ──────────────────────────────────────────────────────── */

  private seriesFor(
    definition: ReportDefinition,
    filter: ReportFilter,
    user: AuthenticatedUser | null,
  ): readonly ReportSeries[] {
    switch (definition.id) {
      case 'caseload':
        return this.caseload(filter);
      case 'assistance-pipeline':
        return this.pipeline(filter);
      case 'case-aging':
        return this.caseAging(filter);
      case 'visit-workload':
        return this.visitWorkload(filter);
      case 'staff-workload':
        return this.staffWorkload();
      case 'program-utilisation':
        return this.programUtilisation(filter);
      case 'release-status':
        return this.releaseStatus(filter);
      case 'referral-outcomes':
        return this.referralOutcomes(filter);
      case 'beneficiaries-by-barangay':
        return this.beneficiariesByBarangay(filter);
      case 'vulnerability-indicators':
        return this.vulnerabilityIndicators(filter);
      case 'service-reach':
        return this.serviceReach(filter);
      case 'repeat-assistance':
        return this.repeatAssistance(filter);
      case 'requirement-bottlenecks':
        return this.requirementBottlenecks(filter);
      case 'data-completeness':
        return this.dataCompleteness(filter, user);
    }
  }

  private caseload(filter: ReportFilter): readonly ReportSeries[] {
    const records = this.cases
      .allCases()
      .filter((record) => this.inBarangay(record.barangayId, filter));

    const rows = Object.keys(CASE_STATUS_CATALOG).map((status) => ({
      key: status,
      label: CASE_STATUS_CATALOG[status as keyof typeof CASE_STATUS_CATALOG].label,
      value: records.filter((record) => record.status === status).length,
    }));

    return [
      this.aboutCases('by-status', 'Cases by status', 'Status', 'Cases', rows),
    ];
  }

  private pipeline(filter: ReportFilter): readonly ReportSeries[] {
    const requests = MOCK_ASSISTANCE_REQUESTS.filter(
      (request) =>
        this.inBarangay(request.barangayId, filter) &&
        (filter.programId === undefined || request.programId === filter.programId),
    );

    const rows = Object.keys(ASSISTANCE_STATUS_CATALOG).map((status) => ({
      key: status,
      label: ASSISTANCE_STATUS_CATALOG[status as keyof typeof ASSISTANCE_STATUS_CATALOG].label,
      value: requests.filter((request) => request.status === status).length,
    }));

    return [
      this.aboutCases('by-status', 'Requests by stage', 'Stage', 'Requests', rows),
    ];
  }

  private caseAging(filter: ReportFilter): readonly ReportSeries[] {
    const open = MOCK_ASSISTANCE_REQUESTS.filter(
      (request) =>
        this.inBarangay(request.barangayId, filter) &&
        !['completed', 'rejected', 'cancelled', 'expired'].includes(request.status),
    );

    const buckets: Record<string, number> = {
      'Under a week': 0,
      'One to four weeks': 0,
      'One to three months': 0,
      'Over three months': 0,
      'Never submitted': 0,
    };
    const now = Date.now();
    for (const request of open) {
      if (request.submittedAt === null) {
        buckets['Never submitted'] = (buckets['Never submitted'] ?? 0) + 1;
        continue;
      }
      const days = Math.floor((now - Date.parse(request.submittedAt)) / 86_400_000);
      const key =
        days < 7
          ? 'Under a week'
          : days < 28
            ? 'One to four weeks'
            : days < 90
              ? 'One to three months'
              : 'Over three months';
      buckets[key] = (buckets[key] ?? 0) + 1;
    }

    const rows = Object.entries(buckets).map(([label, value]) => ({
      key: label,
      label,
      value,
    }));

    return [
      this.aboutCases(
        'aging',
        'How long open requests have been waiting',
        'Waiting',
        'Requests',
        rows,
      ),
    ];
  }

  private visitWorkload(filter: ReportFilter): readonly ReportSeries[] {
    const visits = MOCK_FIELD_VISITS.filter((visit) => {
      const resident = this.residents.find(visit.residentId);
      return resident !== undefined && this.inBarangay(resident.address.barangayId, filter);
    });

    const rows = Object.keys(VISIT_STATUS_CATALOG).map((status) => ({
      key: status,
      label: VISIT_STATUS_CATALOG[status as keyof typeof VISIT_STATUS_CATALOG].label,
      value: visits.filter((visit) => visit.status === status).length,
    }));

    return [this.aboutCases('by-outcome', 'Visits by outcome', 'Outcome', 'Visits', rows)];
  }

  /**
   * Open work per person.
   *
   * Counts what each officer is **carrying**, so a supervisor can move work.
   * There is deliberately no completion rate, no average turnaround per person
   * and no ranking metric: a heavy caseload is usually a hard caseload, and a
   * count cannot tell an office who is doing well (`DL-107`).
   */
  private staffWorkload(): readonly ReportSeries[] {
    const openTasks = this.cases.allTasks().filter(isTaskOpen);

    const rows: ReportRow[] = MOCK_STAFF.filter((staff) => staff.isActive).map((staff) => ({
      key: staff.id,
      label: formatPersonName(staff.name),
      value: openTasks.filter((task) => task.assignedTo === staff.id).length,
    }));
    rows.push({
      key: 'unassigned',
      label: 'Not assigned to anybody',
      value: openTasks.filter((task) => task.assignedTo === null).length,
    });

    // Alphabetical, not by count. Sorting by volume is what turns a workload
    // table into a league table, whatever the heading says.
    const ordered = [...rows].sort((a, b) => a.label.localeCompare(b.label));

    return [
      this.aboutCases(
        'per-officer',
        'Open tasks each officer is carrying',
        'Officer',
        'Open tasks',
        ordered,
        false,
      ),
    ];
  }

  private programUtilisation(filter: ReportFilter): readonly ReportSeries[] {
    const releases = MOCK_DISBURSEMENTS.filter((release) => {
      const resident = this.residents.find(release.residentId);
      return resident !== undefined && this.inBarangay(resident.address.barangayId, filter);
    });

    const rows = MOCK_PROGRAMS.map((program) => {
      const requests = MOCK_ASSISTANCE_REQUESTS.filter(
        (request) => request.programId === program.id,
      );
      const ids = new Set(requests.map((request) => request.id));
      return {
        key: program.id,
        label: program.name,
        value: releases.filter((release) => ids.has(release.requestId)).length,
      };
    });

    return [this.aboutCases('by-program', 'Releases by programme', 'Programme', 'Releases', rows)];
  }

  private releaseStatus(filter: ReportFilter): readonly ReportSeries[] {
    const releases = MOCK_DISBURSEMENTS.filter((release) => {
      const resident = this.residents.find(release.residentId);
      return resident !== undefined && this.inBarangay(resident.address.barangayId, filter);
    });

    const rows = Object.keys(DISBURSEMENT_STATUS_CATALOG).map((status) => ({
      key: status,
      label: DISBURSEMENT_STATUS_CATALOG[status as keyof typeof DISBURSEMENT_STATUS_CATALOG].label,
      value: releases.filter((release) => release.status === status).length,
    }));

    return [
      this.aboutCases('by-status', 'Releases by status', 'Status', 'Releases', rows),
      this.aboutCases(
        'outstanding',
        'Still to settle',
        'Position',
        'Releases',
        [
          {
            key: 'open',
            label: 'Open — the office still owes an act',
            value: releases.filter((release) => isReleaseOpen(release.status)).length,
          },
          {
            key: 'settled',
            label: 'Settled',
            value: releases.filter((release) => !isReleaseOpen(release.status)).length,
          },
        ],
      ),
    ];
  }

  private referralOutcomes(filter: ReportFilter): readonly ReportSeries[] {
    const referrals = MOCK_REFERRALS.filter((referral) => {
      const resident = this.residents.find(referral.residentId);
      return resident !== undefined && this.inBarangay(resident.address.barangayId, filter);
    });

    const rows = Object.keys(REFERRAL_STATUS_CATALOG).map((status) => ({
      key: status,
      label: REFERRAL_STATUS_CATALOG[status as keyof typeof REFERRAL_STATUS_CATALOG].label,
      value: referrals.filter((referral) => referral.status === status).length,
    }));

    return [this.aboutCases('by-status', 'Referrals by outcome', 'Outcome', 'Referrals', rows)];
  }

  /* ── Series about people: suppression applies ───────────────────────────── */

  private beneficiariesByBarangay(filter: ReportFilter): readonly ReportSeries[] {
    const served = new Set(
      MOCK_DISBURSEMENTS.filter((release) => release.releasedAt !== null).map(
        (release) => release.residentId,
      ),
    );

    const rows = TAYTAY_BARANGAYS.map((barangay) => barangay.id).filter(
      (id) => filter.barangayId === undefined || filter.barangayId === id,
    ).map((id) => ({
      key: id,
      label: barangayName(id),
      value: [...served].filter((residentId) => {
        const resident = this.residents.find(residentId);
        return resident !== undefined && resident.address.barangayId === id;
      }).length,
    }));

    return [
      this.aboutPeople(
        'by-barangay',
        'People served, by barangay',
        'Barangay',
        'People served',
        rows,
      ),
    ];
  }

  private vulnerabilityIndicators(filter: ReportFilter): readonly ReportSeries[] {
    const households = this.residents
      .allHouseholds()
      .filter((household) => this.inBarangay(household.address.barangayId, filter));

    const sectors = Object.keys(VULNERABILITY_SECTOR_LABELS) as VulnerabilitySector[];
    const rows = sectors.map((sector) => ({
      key: sector,
      label: VULNERABILITY_SECTOR_LABELS[sector],
      value: households.filter((household) =>
        household.members.some((member) => {
          const resident = this.residents.find(member.residentId);
          return resident !== undefined && resident.sectors.includes(sector);
        }),
      ).length,
    }));

    return [
      this.aboutPeople(
        'by-sector',
        'Households with each indicator present',
        'Indicator',
        'Households',
        rows,
      ),
    ];
  }

  private serviceReach(filter: ReportFilter): readonly ReportSeries[] {
    const servedIds = new Set(
      MOCK_DISBURSEMENTS.filter((release) => release.releasedAt !== null).map(
        (release) => release.residentId,
      ),
    );
    const served = [...servedIds]
      .map((id) => this.residents.find(id))
      .filter((resident) => resident !== undefined)
      .filter((resident) => this.inBarangay(resident.address.barangayId, filter));

    const sectors = Object.keys(VULNERABILITY_SECTOR_LABELS) as VulnerabilitySector[];
    const rows = sectors.map((sector) => ({
      key: sector,
      label: VULNERABILITY_SECTOR_LABELS[sector],
      value: served.filter((resident) => resident.sectors.includes(sector)).length,
    }));

    return [
      this.aboutPeople('by-sector', 'People served, by sector', 'Sector', 'People served', rows),
    ];
  }

  private repeatAssistance(filter: ReportFilter): readonly ReportSeries[] {
    const counts = new Map<string, number>();
    for (const request of MOCK_ASSISTANCE_REQUESTS) {
      if (!this.inBarangay(request.barangayId, filter)) {
        continue;
      }
      if (filter.programId !== undefined && request.programId !== filter.programId) {
        continue;
      }
      counts.set(request.residentId, (counts.get(request.residentId) ?? 0) + 1);
    }

    const buckets = { once: 0, twice: 0, thrice: 0 };
    for (const count of counts.values()) {
      if (count === 1) buckets.once += 1;
      else if (count === 2) buckets.twice += 1;
      else buckets.thrice += 1;
    }

    return [
      this.aboutPeople(
        'by-frequency',
        'How many times a household has applied',
        'Times applied',
        'Households',
        [
          { key: 'once', label: 'Once', value: buckets.once },
          { key: 'twice', label: 'Twice', value: buckets.twice },
          { key: 'thrice', label: 'Three times or more', value: buckets.thrice },
        ],
      ),
    ];
  }

  private requirementBottlenecks(filter: ReportFilter): readonly ReportSeries[] {
    const held = new Map<string, number>();
    for (const request of MOCK_ASSISTANCE_REQUESTS) {
      if (filter.programId !== undefined && request.programId !== filter.programId) {
        continue;
      }
      for (const requirement of request.requirements) {
        if (requirement.status === 'pending' || requirement.status === 'rejected') {
          held.set(requirement.label, (held.get(requirement.label) ?? 0) + 1);
        }
      }
    }

    const rows = [...held.entries()]
      .map(([label, value]) => ({ key: label, label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

    return [
      this.aboutCases(
        'by-document',
        'Documents most often outstanding',
        'Document',
        'Requests held',
        rows,
      ),
    ];
  }

  /**
   * The one report that names people, and only for somebody who may export.
   *
   * It exists to be worked through record by record — a count of "42
   * incomplete" cannot be acted on, because nobody knows which 42 (`DL-104`).
   */
  private dataCompleteness(
    filter: ReportFilter,
    user: AuthenticatedUser | null,
  ): readonly ReportSeries[] {
    const rows: ReportRow[] = this.residents
      .all()
      .filter((resident) => resident.isActive && this.inBarangay(resident.address.barangayId, filter))
      .flatMap((resident) => {
        // Only genuinely optional fields. `birthDate` is required by the model
        // and cannot be missing, so reporting it as a gap would be reporting a
        // gap that can never be closed.
        const missing: string[] = [];
        if (resident.contact.mobile === null) missing.push('mobile number');
        if (resident.philsysLastFour === null) missing.push('PhilSys last four');
        if (resident.householdId === null) missing.push('household');
        if (missing.length === 0) {
          return [];
        }
        return [
          {
            key: resident.id,
            // Named on purpose: this is the person-level report, and it is
            // gated behind `report.export` for exactly that reason.
            label: formatPersonName(resident.name),
            value: missing.length,
            display: missing.join(', '),
            routerLink: `/residents/${resident.id}`,
          },
        ];
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    void user;
    // No suppression: a person-level report is already person-level, and
    // withholding "1" here would hide the record somebody has to go and fix.
    return [
      {
        key: 'incomplete',
        title: 'Records missing something',
        summary:
          rows.length === 0
            ? 'Every active record has a mobile number, PhilSys last four and a household.'
            : `${rows.length} active ${rows.length === 1 ? 'record is' : 'records are'} missing at least one field. Each is named so it can be opened and corrected.`,
        labelHeader: 'Resident',
        valueHeader: 'What is missing',
        rows,
        total: rows.length,
        suppressionNotice: null,
      },
    ];
  }

  /* ── Series helpers ─────────────────────────────────────────────────────── */

  /**
   * A series counting things, not people. No suppression: a count of documents
   * or requests identifies nobody, and withholding it would cost the report its
   * usefulness for no privacy gain.
   */
  private aboutCases(
    key: string,
    title: string,
    labelHeader: string,
    valueHeader: string,
    rows: readonly ReportRow[],
    sortByValue = true,
  ): ReportSeries {
    const ordered = sortByValue
      ? [...rows].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      : rows;
    const total = totalBeforeSuppression(ordered);
    return {
      key,
      title,
      summary: summarise(title, ordered, total, valueHeader),
      labelHeader,
      valueHeader,
      rows: ordered,
      total,
      suppressionNotice: null,
    };
  }

  /**
   * A series counting **people or households**, which always goes through
   * suppression on the way out (`DL-105`). There is no flag to skip it.
   */
  private aboutPeople(
    key: string,
    title: string,
    labelHeader: string,
    valueHeader: string,
    rows: readonly ReportRow[],
  ): ReportSeries {
    const ordered = [...rows].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    // The total is taken BEFORE suppression, so a reader is told the real
    // figure rather than the sum of what survived.
    const total = totalBeforeSuppression(ordered);
    const suppressed = suppressSmallCells(ordered);
    return {
      key,
      title,
      summary: summarise(title, suppressed, total, valueHeader),
      labelHeader,
      valueHeader,
      rows: suppressed,
      total,
      suppressionNotice: describeSuppression(suppressed),
    };
  }

  /* ── Filtering and labels ───────────────────────────────────────────────── */

  private inBarangay(id: string, filter: ReportFilter): boolean {
    const user = this.access.currentUser();
    if (!isWithinBarangayScope(user, id as never)) {
      return false;
    }
    return filter.barangayId === undefined || filter.barangayId === id;
  }

  private filterLabels(filter: ReportFilter) {
    return {
      ...(filter.barangayId !== undefined
        ? { barangay: barangayName(filter.barangayId) }
        : {}),
      ...(filter.programId !== undefined
        ? {
            program:
              MOCK_PROGRAMS.find((program) => program.id === filter.programId)?.name ??
              filter.programId,
          }
        : {}),
      ...(filter.caseworkerId !== undefined
        ? {
            caseworker: (() => {
              const staff = MOCK_STAFF.find((member) => member.id === filter.caseworkerId);
              return staff === undefined ? filter.caseworkerId : formatPersonName(staff.name);
            })(),
          }
        : {}),
    };
  }
}

/**
 * The sentence read with the table caption.
 *
 * Required on every series, because a visualisation with no plain-text
 * equivalent is one a screen reader cannot convey and a sighted reader cannot
 * check. It names the largest row rather than describing a shape — "most" is a
 * claim somebody can verify against the row beneath it.
 */
function summarise(
  title: string,
  rows: readonly ReportRow[],
  total: number,
  valueHeader: string,
): string {
  const unit = valueHeader.toLowerCase();
  if (rows.length === 0) {
    return `${title}: nothing matched this filter.`;
  }
  if (total === 0) {
    return `${title}: no ${unit} at all under this filter.`;
  }
  const visible = rows.filter((row) => row.isWithheld !== true);
  const largest = visible.reduce<ReportRow | null>(
    (best, row) => (best === null || row.value > best.value ? row : best),
    null,
  );
  if (largest === null || largest.value === 0) {
    return `${title}: ${total} ${unit} in total. Every figure is small enough to be withheld.`;
  }
  const share = Math.round((largest.value / total) * 100);
  return `${title}: ${total} ${unit} in total. The largest is ${largest.label} with ${largest.value} (${share}%).`;
}
