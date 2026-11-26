import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { LiveUpdates } from '@core/live/live-updates';
import {
  barangayName,
  IDENTITY_FIELD_LABELS,
  IDENTITY_SOURCE_LABELS,
  RESIDENT_REPOSITORY,
  SEX_LABELS,
  asId,
  type BarangayId,
  type IdentityChange,
  type IdentityChangeValues,
  type ResidentId,
} from '@domain/index';
import { DisplayDatePipe, formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { failureReason } from '@shared/state/failure-reason';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';

import { RESIDENTS_COPY } from './residents.copy';

/** What a person asked to see of one change: not yet, being read, read, or refused. */
type ValuesState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly values: IdentityChangeValues }
  | { readonly kind: 'error'; readonly message: string };

/**
 * A registry record's identity history on its page (`DL-264`): when, who, which field, through
 * which act, whether an ID was seen, and the reason — never a value in the list (`DL-114`).
 *
 * The earlier and later values of one change are opened by a person who holds `audit.view-detail`,
 * one change at a time, because the server records each opening in the audit trail; the server
 * also says per row whether this reader may (`valuesReadable`), so a protected record's values are
 * not offered to an auditor without the protected tier. The list keeps itself current on the
 * registry's topic and re-reads without a skeleton (`DL-222`); a value already opened stays on
 * screen, because a re-read is not a fresh opening.
 */
@Component({
  selector: 'app-identity-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DisplayDatePipe],
  templateUrl: './identity-history.html',
  styleUrl: './identity-history.scss',
})
export class IdentityHistory {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly live = inject(LiveUpdates);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly residentId = input.required<ResidentId>();

  protected readonly copy = RESIDENTS_COPY.identityHistory;
  protected readonly fieldLabels = IDENTITY_FIELD_LABELS;
  protected readonly sourceLabels = IDENTITY_SOURCE_LABELS;
  /** Usability only: the server answers `values_readable` and refuses the read itself (rule 4). */
  protected readonly canOpenValues = this.permissions.can('audit.view-detail');

  private readonly retries = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.residentId(), retry: this.retries() }))).pipe(
      switchMap(({ id }) =>
        liveViewState(
          () => this.repository.identityHistory(id),
          this.live.changes(['residents']),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly IdentityChange[]> },
  );

  /** The changes once read; the template reads them here, typed, rather than from its context. */
  protected readonly changes = computed<readonly IdentityChange[]>(() => {
    const read = this.state();
    return read.kind === 'ready' ? read.value : [];
  });

  /** The values opened, by change id. */
  protected readonly opened = signal<Readonly<Record<string, ValuesState>>>({});

  protected retry(): void {
    this.retries.update((count) => count + 1);
  }

  protected open(change: IdentityChange): void {
    const current = this.opened()[change.id];
    if (current !== undefined && current.kind !== 'error') {
      return;
    }
    this.opened.update((all) => ({ ...all, [change.id]: { kind: 'loading' } }));
    this.repository
      .identityChangeValues(this.residentId(), change.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (values) =>
          this.opened.update((all) => ({ ...all, [change.id]: { kind: 'ready', values } })),
        error: (failure: unknown) =>
          this.opened.update((all) => ({
            ...all,
            [change.id]: {
              kind: 'error',
              message: failureReason(failure) ?? this.copy.valuesFailed,
            },
          })),
      });
  }

  protected valuesOf(change: IdentityChange): ValuesState | null {
    return this.opened()[change.id] ?? null;
  }

  /** A value as the record would show it: a barangay by name, a sex in words, a date as a date. */
  protected shown(values: IdentityChangeValues, value: string | null): string {
    if (value === null) {
      return this.copy.none;
    }
    switch (values.field) {
      case 'barangay':
        return barangayName(asId<BarangayId>(value));
      case 'sex':
        return value === 'female' || value === 'male' ? SEX_LABELS[value] : value;
      case 'birthDate':
        return formatDisplayDate(value, 'date') ?? value;
      default:
        return value;
    }
  }
}
