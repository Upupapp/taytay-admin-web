import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  asId,
  asIsoDate,
  CIVIL_STATUS_LABELS,
  CIVIL_STATUSES,
  isSensitiveSector,
  pesos,
  RESIDENT_REPOSITORY,
  SEX_LABELS,
  SEXES,
  TAYTAY_BARANGAYS,
  toDecimal,
  toResidentDraft,
  validateResidentDraft,
  VULNERABILITY_SECTOR_LABELS,
  VULNERABILITY_SECTORS,
  type BarangayId,
  type CivilStatus,
  type ResidentDraft,
  type ResidentDraftProblem,
  type ResidentId,
  type ResidentView,
  type Sex,
  type VulnerabilitySector,
} from '@domain/index';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { RESIDENTS_COPY } from './residents.copy';

/**
 * What the controls hold. Numbers arrive from `<input>` as strings, and keeping
 * them that way until submit is what stops "0" and "" from being the same thing.
 */
interface FormModel {
  first: string;
  middle: string;
  last: string;
  suffix: string;
  sex: Sex;
  birthDate: string;
  civilStatus: CivilStatus;
  barangayId: string;
  purokOrSitio: string;
  streetAddress: string;
  mobile: string;
  email: string;
  philsysLastFour: string;
  monthlyIncome: string;
  sectors: readonly VulnerabilitySector[];
  /** How the office established these. Required once any sector is ticked. */
  sectorBasis: string;
}

const BLANK: FormModel = {
  first: '',
  middle: '',
  last: '',
  suffix: '',
  sex: 'female',
  birthDate: '',
  civilStatus: 'single',
  barangayId: '',
  purokOrSitio: '',
  streetAddress: '',
  mobile: '',
  email: '',
  philsysLastFour: '',
  monthlyIncome: '',
  sectors: [],
  sectorBasis: '',
};

/**
 * Register a resident, or correct an existing record.
 *
 * One component for both, because they are the same form with a different verb
 * and a different starting point; splitting them is how the two drift until a
 * field can be set at creation and never changed again.
 *
 * Two rules it enforces on top of the obvious ones:
 *
 *  - **A record you cannot fully see, you cannot edit.** A draft replaces the
 *    record, so submitting one built from a redacted copy would delete the
 *    withheld attributes. The adapter refuses it too (`DL-39`); this screen just
 *    explains why before the person types anything.
 *  - **Protected sectors are not offered without clearance.** Recording someone
 *    as a VAWC survivor is a disclosure decision, not a checkbox.
 */
@Component({
  selector: 'app-resident-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, PageHeader, RouterLink],
  templateUrl: './resident-form-page.html',
  styleUrl: './resident-form-page.scss',
})
export class ResidentFormPage {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  /** Present on `/residents/:id/edit`, absent on `/residents/new`. */
  readonly id = input<string | undefined>(undefined);

  protected readonly copy = RESIDENTS_COPY.form;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly sexes = SEXES;
  protected readonly civilStatuses = CIVIL_STATUSES;

  protected readonly isEdit = computed(() => this.id() !== undefined);

  /** Protected sectors are only offered to someone cleared to see them. */
  protected readonly offeredSectors = computed<readonly VulnerabilitySector[]>(() =>
    this.permissions.has('request.view-sensitive')
      ? VULNERABILITY_SECTORS
      : VULNERABILITY_SECTORS.filter((sector) => !isSensitiveSector(sector)),
  );

  /**
   * A ticked sector with no basis blocks the save.
   *
   * Enforced here as well as by the server, which requires the reason on every sector act — this
   * is the usability half, so a clerk finds out before they submit rather than after the resident
   * has been created and the sectors refused.
   */
  protected readonly sectorBasisMissing = computed(
    () => this.model().sectors.length > 0 && this.model().sectorBasis.trim().length === 0,
  );

  protected readonly hasRestrictedSectors = computed(
    () => this.offeredSectors().length < VULNERABILITY_SECTORS.length,
  );

  protected readonly model = signal<FormModel>(BLANK);
  protected readonly problems = signal<readonly ResidentDraftProblem[]>([]);
  protected readonly submitting = signal(false);
  protected readonly loadFailed = signal<string | null>(null);

  /** `null` on the create route; the existing record on the edit route. */
  protected readonly existing = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        id === undefined
          ? of({ kind: 'ready', value: null } as ViewState<ResidentView | null>)
          : toViewState(this.repository.getById(asId<ResidentId>(id))),
      ),
    ),
    { initialValue: LOADING as ViewState<ResidentView | null> },
  );

  /**
   * True when the record exists but arrived redacted. Rendering the form anyway
   * would invite someone to overwrite the parts they were not shown.
   */
  protected readonly blockedByDisclosure = computed(() => {
    const view = valueOf(this.existing());
    return view !== null && view !== undefined && view.withheld.length > 0;
  });

  protected readonly notFound = computed(() => {
    const state = this.existing();
    return this.isEdit() && state.kind === 'ready' && state.value === null;
  });

  protected readonly title = computed(() =>
    this.isEdit() ? this.copy.editTitle : this.copy.createTitle,
  );

  protected readonly subtitle = computed(() =>
    this.isEdit() ? this.copy.editSubtitle : this.copy.createSubtitle,
  );

  private seeded = false;

  constructor() {
    // Seeded once, when the record arrives. Re-seeding on every emission would
    // throw away whatever the person had already typed.
    effect(() => {
      const view = valueOf(this.existing());
      if (!this.seeded && view) {
        this.seeded = true;
        this.seed(view);
      }
    });
  }

  private seed(view: ResidentView): void {
    const draft = toResidentDraft(view.resident);
    this.model.set({
      first: draft.name.first,
      middle: draft.name.middle ?? '',
      last: draft.name.last,
      suffix: draft.name.suffix ?? '',
      sex: draft.sex,
      birthDate: draft.birthDate,
      civilStatus: draft.civilStatus,
      barangayId: draft.address.barangayId,
      purokOrSitio: draft.address.purokOrSitio ?? '',
      streetAddress: draft.address.streetAddress ?? '',
      mobile: draft.contact.mobile ?? '',
      email: draft.contact.email ?? '',
      philsysLastFour: draft.philsysLastFour ?? '',
      monthlyIncome: draft.monthlyIncome === null ? '' : String(toDecimal(draft.monthlyIncome)),
      sectors: draft.sectors,
      sectorBasis: '',
    });
  }

  /* ── controls ───────────────────────────────────────────────────────────── */

  protected onText(field: keyof Omit<FormModel, 'sectors'>, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.model.update((model) => ({ ...model, [field]: value }));
  }

  protected toggleSector(sector: VulnerabilitySector, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.model.update((model) => ({
      ...model,
      sectors: checked
        ? [...model.sectors, sector]
        : model.sectors.filter((existing) => existing !== sector),
    }));
  }

  protected isChecked(sector: VulnerabilitySector): boolean {
    return this.model().sectors.includes(sector);
  }

  protected sectorLabel(sector: VulnerabilitySector): string {
    return VULNERABILITY_SECTOR_LABELS[sector];
  }

  protected sexLabel(sex: Sex): string {
    return SEX_LABELS[sex];
  }

  protected civilStatusLabel(status: CivilStatus): string {
    return CIVIL_STATUS_LABELS[status];
  }

  protected problemText(problem: ResidentDraftProblem): string {
    return `${RESIDENTS_COPY.fieldLabel[problem.field]} ${RESIDENTS_COPY.rule[problem.rule]}`;
  }

  /* ── submit ─────────────────────────────────────────────────────────────── */

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.submitting()) {
      return;
    }

    const draft = this.toDraft();
    const problems = validateResidentDraft(draft);
    this.problems.set(problems);
    if (problems.length > 0 || this.sectorBasisMissing()) {
      return;
    }

    const id = this.id();
    this.submitting.set(true);
    const save$ =
      id === undefined
        ? this.repository.create(draft)
        : this.repository.update(asId<ResidentId>(id), draft);

    save$
      .pipe(
        /*
         * ── sectors are recorded AFTER the record exists, one act at a time ──────────
         *
         * They are not part of the draft and never were on the wire: each sector rests on
         * something somebody checked — a Senior Citizen ID, a PWD card — and the server takes it
         * as its own act with a reason. Until TAB 19 there was no endpoint at all, so every
         * sector ticked on this form was silently discarded.
         *
         * The failure mode is real and is reported rather than hidden (`DL-87`): the resident is
         * saved either way, and a sector that did not record is named. A screen that said
         * "saved" while a safeguarding flag was refused would be the worst possible lie.
         */
        switchMap((saved) =>
          this.recordSectors(asId<ResidentId>(saved.id), draft.sectors).pipe(
            map((refused) => ({ saved, refused })),
          ),
        ),
      )
      .subscribe({
      next: ({ saved, refused }) => {
        this.submitting.set(false);

        if (refused.length > 0) {
          this.notifications.warning(this.copy.sectorsNotRecorded(refused));
        } else {
          this.notifications.success(
            id === undefined ? this.copy.savedCreate : this.copy.savedUpdate,
          );
        }

        void this.router.navigate(['/residents', saved.id]);
      },
      error: (failure: unknown) => {
        this.submitting.set(false);
        this.notifications.error(
          failure instanceof Error ? failure.message : 'That record could not be saved.',
        );
      },
    });
  }

  /**
   * Records each ticked sector and returns the ones that were refused.
   *
   * Sequential rather than concurrent, and it never fails the stream: the resident record is
   * already saved by the time this runs, so an error here must degrade into a warning rather than
   * into an error message about a save that actually succeeded.
   *
   * On edit this records what is ticked and does **not** end what was un-ticked — removing a
   * sector is its own act with its own reason, and inferring a removal from a checkbox somebody
   * cleared is exactly the silent protection change this design refuses.
   */
  private recordSectors(
    id: ResidentId,
    sectors: readonly VulnerabilitySector[],
  ): Observable<readonly VulnerabilitySector[]> {
    if (sectors.length === 0) {
      return of([]);
    }

    const reason = this.model().sectorBasis.trim();

    return forkJoin(
      sectors.map((sector) =>
        this.repository.recordSector(id, sector, reason).pipe(
          map(() => null),
          catchError(() => of(sector)),
        ),
      ),
    ).pipe(map((results) => results.filter((entry): entry is VulnerabilitySector => entry !== null)));
  }

  private toDraft(): ResidentDraft {
    const model = this.model();
    const income = Number.parseFloat(model.monthlyIncome);

    return {
      name: {
        first: model.first,
        middle: blankToNull(model.middle),
        last: model.last,
        suffix: blankToNull(model.suffix),
      },
      sex: model.sex,
      birthDate: asIsoDate(model.birthDate),
      civilStatus: model.civilStatus,
      address: {
        barangayId: model.barangayId as BarangayId,
        purokOrSitio: blankToNull(model.purokOrSitio),
        streetAddress: blankToNull(model.streetAddress),
      },
      contact: { mobile: blankToNull(model.mobile), email: blankToNull(model.email) },
      sectors: model.sectors,
      philsysLastFour: blankToNull(model.philsysLastFour),
      monthlyIncome: Number.isFinite(income) ? pesos(income) : null,
      // Household membership is edited from the household, not from a person:
      // moving someone between families is a household decision with two sides.
      householdId: valueOf(this.existing())?.resident.householdId ?? null,
    };
  }
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
