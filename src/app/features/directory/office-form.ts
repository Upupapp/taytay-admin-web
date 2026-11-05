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
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  DIRECTORY_OFFICE_REPOSITORY,
  OFFICE_BANNER_LIMIT,
  OFFICE_EFFECTS,
  OFFICE_FIXED_AFTER_CREATION,
  officeChangeProblems,
  officeDraftProblems,
  type DirectoryOffice,
  type OfficeChanges,
  type OfficeDraft,
} from '@domain/index';
import { blankToNull, coordinateOf, coordinateProblem, readText } from '@shared/forms/form-values';
import { ImageFileField } from '@shared/media/image-file-field';
import { failureReason } from '@shared/state/failure-reason';

import { DIRECTORY_COPY } from './directory.copy';

/**
 * One office, added or changed (`DL-170`), in a drawer beside the list.
 *
 * ## What a change can reach, and what it cannot
 *
 * A new office takes every field `OfficeWrite` declares. A change takes the four `OfficePatch`
 * declares — name, address, short name, category — and a banner; the rest are shown as set when the
 * office was created, with the reason, rather than offered as fields whose edits the server might
 * drop while reporting success (`OfficeChanges`).
 *
 * ## What it does, before the button
 *
 * The consequences — `OFFICE_EFFECTS`, read from the backend — are listed between the fields and the
 * button, and grow with the change: a new address says what happens to old links; a banner says the
 * old one is deleted.
 */
@Component({
  selector: 'app-office-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFileField],
  templateUrl: './office-form.html',
  styleUrl: './directory-form.scss',
})
export class OfficeForm {
  private readonly repository = inject(DIRECTORY_OFFICE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** The office to change, or `null` to add one. */
  readonly office = input<DirectoryOffice | null>(null);
  readonly saved = output<DirectoryOffice>();

  protected readonly copy = DIRECTORY_COPY.officeForm;
  protected readonly bannerLimit = OFFICE_BANNER_LIMIT;
  protected readonly effectsLead = DIRECTORY_COPY.list.effectsLead;
  protected readonly fixedLead = this.copy.fixedLead(OFFICE_FIXED_AFTER_CREATION.join(', '));

  protected readonly name = signal('');
  protected readonly slug = signal('');
  protected readonly shortName = signal('');
  protected readonly category = signal('');
  protected readonly description = signal('');
  protected readonly head = signal('');
  protected readonly hours = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly address = signal('');
  protected readonly latitude = signal('');
  protected readonly longitude = signal('');
  protected readonly banner = signal<Blob | null>(null);

  protected readonly busy = signal(false);
  protected readonly attempted = signal(false);
  protected readonly outcome = signal('');

  protected readonly creating = computed(() => this.office() === null);

  /** The office as the fields describe it, for a new one. */
  private readonly draft = computed<OfficeDraft>(() => ({
    name: this.name().trim(),
    slug: this.slug().trim(),
    shortName: blankToNull(this.shortName()),
    category: blankToNull(this.category()),
    description: blankToNull(this.description()),
    head: blankToNull(this.head()),
    hours: blankToNull(this.hours()),
    phone: blankToNull(this.phone()),
    email: blankToNull(this.email()),
    address: blankToNull(this.address()),
    latitude: coordinateOf(this.latitude()),
    longitude: coordinateOf(this.longitude()),
  }));

  /** What differs from the office as the server holds it — only what a change can carry. */
  private readonly changes = computed<OfficeChanges>(() => {
    const office = this.office();
    if (office === null) {
      return {};
    }
    const changes: { -readonly [K in keyof OfficeChanges]: OfficeChanges[K] } = {};
    const name = this.name().trim();
    const slug = this.slug().trim();
    const shortName = this.shortName().trim();
    const category = this.category().trim();
    if (name !== office.name) changes.name = name;
    if (slug !== office.slug) changes.slug = slug;
    // A short name or category cannot be cleared by a form; an emptied field is left as it was.
    if (shortName !== '' && shortName !== (office.shortName ?? '')) changes.shortName = shortName;
    if (category !== '' && category !== (office.category ?? '')) changes.category = category;
    return changes;
  });

  protected readonly unchanged = computed(
    () => !this.creating() && Object.keys(this.changes()).length === 0 && this.banner() === null,
  );

  protected readonly problems = computed<readonly string[]>(() => [
    ...(this.creating()
      ? officeDraftProblems(this.draft())
      : officeChangeProblems(this.changes())
    ).map((problem) => problem.message),
    ...(this.creating()
      ? [
          coordinateProblem('latitude', this.latitude()),
          coordinateProblem('longitude', this.longitude()),
        ].filter((problem): problem is string => problem !== null)
      : []),
  ]);

  /** Every consequence of pressing the button now. */
  protected readonly effects = computed<readonly string[]>(() => {
    const office = this.office();
    const banner = this.banner();
    if (office === null) {
      return [...OFFICE_EFFECTS.create, ...(banner === null ? [] : OFFICE_EFFECTS.bannerAdded)];
    }
    return [
      ...(this.changes().slug === undefined ? [] : OFFICE_EFFECTS.slug),
      ...(banner === null
        ? []
        : office.hasBanner
          ? OFFICE_EFFECTS.bannerReplaced
          : OFFICE_EFFECTS.bannerAdded),
      ...OFFICE_EFFECTS.update,
    ];
  });

  /** An emptied short name or category, which a change cannot carry, said rather than dropped. */
  protected readonly clearingIgnored = computed(() => {
    const office = this.office();
    return (
      office !== null &&
      ((office.shortName !== null && this.shortName().trim() === '') ||
        (office.category !== null && this.category().trim() === ''))
    );
  });

  constructor() {
    // The fields start from the office opened, and afresh when another is opened in its place.
    effect(() => {
      const office = this.office();
      untracked(() => this.fill(office));
    });
  }

  /** The value an input event carries. */
  protected text(event: Event): string {
    return readText(event);
  }

  private fill(office: DirectoryOffice | null): void {
    const coordinate = (value: number | null | undefined) =>
      value === null || value === undefined ? '' : String(value);
    this.name.set(office?.name ?? '');
    this.slug.set(office?.slug ?? '');
    this.shortName.set(office?.shortName ?? '');
    this.category.set(office?.category ?? '');
    this.description.set(office?.description ?? '');
    this.head.set(office?.head ?? '');
    this.hours.set(office?.hours ?? '');
    this.phone.set(office?.phone ?? '');
    this.email.set(office?.email ?? '');
    this.address.set(office?.address ?? '');
    this.latitude.set(coordinate(office?.latitude));
    this.longitude.set(coordinate(office?.longitude));
    this.banner.set(null);
    this.attempted.set(false);
    this.outcome.set('');
  }

  protected save(): void {
    this.attempted.set(true);
    if (this.problems().length > 0 || this.unchanged() || this.busy()) {
      return;
    }
    const office = this.office();
    const work =
      office === null
        ? this.repository.create(this.draft(), this.banner())
        : this.repository.update(office.id, this.changes(), this.banner());

    this.busy.set(true);
    this.outcome.set('');
    work.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.saved.emit(result);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.outcome.set(
          DIRECTORY_COPY.list.notDone(failureReason(failure) ?? DIRECTORY_COPY.list.failed),
        );
      },
    });
  }
}
