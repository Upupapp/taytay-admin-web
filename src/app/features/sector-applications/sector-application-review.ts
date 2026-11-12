import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, switchMap, type Observable } from 'rxjs';

import {
  asIsoDate,
  barangayName,
  isCardLastFour,
  SECTOR_APPLICATION_EFFECTS,
  SECTOR_APPLICATION_REPOSITORY,
  SECTOR_APPLICATION_STATUS_CATALOG,
  SECTOR_REASON_MAX_LENGTH,
  type ApplicationSector,
  type BarangayId,
  type ResidentId,
  type ResidentView,
  type SectorApplication,
  type SectorApplicationDetail,
  type SectorApproval,
  type SectorCardDetails,
} from '@domain/index';
import { ObjectUrls } from '@shared/media/object-urls';
import { PersonPicker } from '@shared/residents/person-picker';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { SECTOR_APPLICATIONS_COPY } from './sector-applications.copy';

interface OpenedProof {
  readonly label: string;
  readonly url: string;
}

/**
 * One sector application, reviewed (`DL-215`), in the verification review's pattern: the facts and
 * the proof on one side, the decision on the other, in a centred dialog.
 *
 * **The proof only after a warning, and gone on leave.** No proof is fetched until the reviewer has
 * read the API's own warning and pressed its button; each is read as bytes with the bearer in a
 * header (`openProof`), shown from an object URL, and every URL is revoked when the proof is hidden,
 * another application is opened, or the dialog goes.
 *
 * **Approving links an account to a record once.** When the account is not linked, the reviewer
 * chooses the record among the API's suggestions and says why; the effects say the link is never
 * moved. **A card number is taken as its last four characters only** (`DL-183`).
 */
@Component({
  selector: 'app-sector-application-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, Icon, Modal, PersonPicker, RouterLink, StatusBadge],
  templateUrl: './sector-application-review.html',
  styleUrl: './sector-applications.scss',
})
export class SectorApplicationReview {
  private readonly repository = inject(SECTOR_APPLICATION_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly objectUrls = new ObjectUrls();

  readonly application = input.required<SectorApplication>();
  readonly decided = output<SectorApplication>();

  protected readonly copy = SECTOR_APPLICATIONS_COPY.review;
  protected readonly sectors = SECTOR_APPLICATIONS_COPY.sectors;
  protected readonly noAnswer = SECTOR_APPLICATIONS_COPY.noAnswer;
  protected readonly catalog = SECTOR_APPLICATION_STATUS_CATALOG;
  protected readonly effects = SECTOR_APPLICATION_EFFECTS;
  protected readonly maxLength = SECTOR_REASON_MAX_LENGTH;

  protected readonly detail = toSignal(
    toObservable(this.application).pipe(
      switchMap((application) => toViewState(this.repository.get(application.id))),
    ),
    { initialValue: LOADING as ViewState<SectorApplicationDetail | null> },
  );

  protected readonly warningOpen = signal(false);
  protected readonly proofs = signal<readonly OpenedProof[] | null>(null);
  protected readonly proofsFailed = signal(false);

  protected readonly chosen = signal<ResidentId | null>(null);
  /** The record found through the registry search, when it is not one of the API's suggestions. */
  protected readonly pickedName = signal<string | null>(null);
  protected readonly linkReason = signal('');
  protected readonly approveReason = signal('');
  protected readonly returnReason = signal('');
  protected readonly idLastFour = signal('');
  protected readonly issuedOn = signal('');
  protected readonly validUntil = signal('');
  protected readonly socialPension = signal(false);
  protected readonly disabilityType = signal('');

  protected readonly busy = signal(false);
  protected readonly problem = signal('');
  protected readonly outcome = signal('');

  protected readonly lastFourInvalid = computed(() => {
    const value = this.idLastFour().trim();
    return value !== '' && !isCardLastFour(value);
  });

  constructor() {
    // Another application opened in the same dialog starts from nothing.
    effect(() => {
      this.application();
      this.discardProofs();
      this.chosen.set(null);
      this.pickedName.set(null);
      this.linkReason.set('');
      this.approveReason.set('');
      this.returnReason.set('');
      this.idLastFour.set('');
      this.issuedOn.set('');
      this.validUntil.set('');
      this.socialPension.set(false);
      this.disabilityType.set('');
      this.problem.set('');
      this.outcome.set('');
    });
    this.destroyRef.onDestroy(() => this.objectUrls.revokeAll());
  }

  /** A record found through the registry search: the same choice as a suggestion, with its name said. */
  protected pick(view: ResidentView): void {
    this.chosen.set(view.resident.id);
    this.pickedName.set(view.listedName);
  }

  protected suggest(id: ResidentId): void {
    this.chosen.set(id);
    this.pickedName.set(null);
  }

  protected sectorLabel(sector: ApplicationSector): string {
    return this.sectors[sector];
  }

  protected barangay(id: BarangayId | null): string {
    return id === null ? '' : barangayName(id);
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  /** The only path that fetches a proof: from the warning's own button. */
  protected confirmOpen(detail: SectorApplicationDetail): void {
    this.warningOpen.set(false);
    this.discardProofs();
    if (detail.proofs.length === 0) return;
    forkJoin(detail.proofs.map((proof) => this.repository.openProof(detail.id, proof)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blobs) => {
          // Answered after the reviewer moved on: these are not this application's.
          if (this.application().id !== detail.id) return;
          this.proofs.set(
            blobs.map((blob, index) => ({
              label: this.copy.proofLabel(index + 1),
              url: this.objectUrls.make(blob),
            })),
          );
        },
        error: () => this.proofsFailed.set(true),
      });
  }

  protected discardProofs(): void {
    this.objectUrls.revokeAll();
    this.proofs.set(null);
    this.proofsFailed.set(false);
  }

  protected approve(detail: SectorApplicationDetail): void {
    const reason = this.approveReason().trim();
    const residentId = this.chosen();
    const why = this.linkReason().trim();
    const unlinked = detail.linkedResident === null;
    const refusal =
      reason === ''
        ? this.copy.reasonMissing
        : unlinked && residentId === null
          ? this.copy.chooseRecord
          : unlinked && why === ''
            ? this.copy.linkReasonMissing
            : this.lastFourInvalid()
              ? this.copy.idLastFourInvalid
              : '';
    if (refusal !== '') {
      this.problem.set(refusal);
      return;
    }
    const link: SectorApproval['link'] =
      unlinked && residentId !== null ? { residentId, reason: why } : undefined;
    const details = detail.detailsWritable ? this.details(detail) : undefined;
    this.send(
      this.repository.approve(detail.id, {
        reason,
        ...(link === undefined ? {} : { link }),
        ...(details === undefined ? {} : { details }),
      }),
      this.copy.approved,
    );
  }

  protected giveBack(detail: SectorApplicationDetail): void {
    const reason = this.returnReason().trim();
    if (reason === '') {
      this.problem.set(this.copy.reasonMissing);
      return;
    }
    this.send(this.repository.returnToApplicant(detail.id, reason), this.copy.returned);
  }

  private details(detail: SectorApplicationDetail): SectorCardDetails | undefined {
    const idLastFour = this.idLastFour().trim();
    const issuedOn = this.issuedOn();
    const validUntil = this.validUntil();
    const disabilityType = this.disabilityType().trim();
    const result: SectorCardDetails = {
      ...(idLastFour === '' ? {} : { idLastFour }),
      ...(issuedOn === '' ? {} : { issuedOn: asIsoDate(issuedOn) }),
      ...(validUntil === '' ? {} : { validUntil: asIsoDate(validUntil) }),
      ...(detail.sector === 'senior-citizen' ? { socialPension: this.socialPension() } : {}),
      ...(detail.sector === 'pwd' && disabilityType !== '' ? { disabilityType } : {}),
    };
    return Object.keys(result).length === 0 ? undefined : result;
  }

  private send(request: Observable<SectorApplication>, done: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.problem.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (answer) => {
        this.busy.set(false);
        this.outcome.set(done);
        this.discardProofs();
        this.decided.emit(answer);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.problem.set(this.copy.refused(failureReason(failure) ?? this.noAnswer));
      },
    });
  }
}
