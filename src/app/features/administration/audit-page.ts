import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_SOURCE_LABELS,
  GOVERNANCE_REPOSITORY,
  asId,
  describeAuditFilter,
  describeAuditRows,
  isAuditFilterActive,
  type AuditAction,
  type AuditEntryDetail,
  type AuditEntryId,
  type AuditFilter,
  type AuditRow,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { ADMIN_COPY } from './administration.copy';

/**
 * The audit trail.
 *
 * **A row cannot quote what changed, because it does not hold it** (`DL-114`).
 * The rows this screen renders carry a summary, the field names that moved and
 * how sensitive each was; the recorded values are a separate fetch behind
 * `audit.view-detail`, and the screen says so at the top rather than leaving
 * their absence to look like a missing feature.
 *
 * That split matters most on exactly this screen. An audit list is the one
 * surface designed to be scrolled and filtered by somebody reviewing *other
 * people's* work — a row reading `monthlyIncome: 3,200 → 18,000` would disclose
 * a resident's income to every reviewer who filters by date, in the name of
 * accountability.
 */
@Component({
  selector: 'app-audit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, PageHeader, RouterLink],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
})
export class AuditPage {
  private readonly repository = inject(GOVERNANCE_REPOSITORY);
  private readonly permissions = inject(PermissionService);

  protected readonly copy = ADMIN_COPY.audit;
  protected readonly actions = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

  protected readonly search = signal('');
  protected readonly action = signal<AuditAction | null>(null);
  protected readonly sensitiveOnly = signal(false);

  protected readonly canOpenValues = computed(() =>
    this.permissions.has('audit.view-detail'),
  );

  private readonly filter = computed<AuditFilter>(() => ({
    ...(this.search() ? { search: this.search() } : {}),
    ...(this.action() ? { action: this.action() as AuditAction } : {}),
    ...(this.sensitiveOnly() ? { sensitiveOnly: true } : {}),
  }));

  protected readonly state = toSignal(
    toObservable(this.filter).pipe(
      switchMap((filter) => toViewState(this.repository.auditRows(filter))),
    ),
    { initialValue: LOADING as ViewState<readonly AuditRow[]> },
  );

  protected readonly rows = computed<readonly AuditRow[]>(() => valueOf(this.state()) ?? []);
  protected readonly summary = computed(() => describeAuditRows(this.rows()));
  protected readonly coverage = computed(() => describeAuditFilter(this.filter()));
  protected readonly hasFilters = computed(() => isAuditFilterActive(this.filter()));

  protected actionLabel(action: AuditAction): string {
    return AUDIT_ACTION_LABELS[action];
  }

  protected sourceLabel(row: AuditRow): string {
    return AUDIT_SOURCE_LABELS[row.source];
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.trim());
  }

  protected onAction(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.action.set(value === '' ? null : (value as AuditAction));
  }

  protected onSensitiveOnly(event: Event): void {
    this.sensitiveOnly.set((event.target as HTMLInputElement).checked);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.action.set(null);
    this.sensitiveOnly.set(false);
  }

  /* ── Opening the recorded values ────────────────────────────────────────── */

  protected readonly openRowId = signal<string | null>(null);
  protected readonly detail = signal<AuditEntryDetail | null>(null);

  protected isOpen(row: AuditRow): boolean {
    return this.openRowId() === row.id;
  }

  protected async toggleValues(row: AuditRow): Promise<void> {
    if (this.isOpen(row)) {
      this.openRowId.set(null);
      this.detail.set(null);
      return;
    }
    if (!this.canOpenValues()) {
      return;
    }
    // Fetched only when asked for. The list response never carries values.
    const detail = await firstValueFrom(
      this.repository.auditDetail(asId<AuditEntryId>(row.id)),
    );
    this.openRowId.set(row.id);
    this.detail.set(detail);
  }
}
