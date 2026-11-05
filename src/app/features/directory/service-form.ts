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
import type { Observable } from 'rxjs';

import {
  officeLabel,
  SERVICE_CONTACT_LABELS,
  SERVICE_CONTACT_TYPES,
  SERVICE_EFFECTS,
  SERVICE_FIXED_AFTER_CREATION,
  serviceProblems,
  TULONG_SERVICE_REPOSITORY,
  type Office,
  type OfficeId,
  type ServiceChanges,
  type ServiceContact,
  type ServiceContactType,
  type ServiceDraft,
  type ServiceLocation,
  type TulongService,
} from '@domain/index';
import { ImageFileField } from '@shared/media/image-file-field';
import { failureReason } from '@shared/state/failure-reason';
import { valueOf, type ViewState } from '@shared/state/view-state';

import { DIRECTORY_COPY } from './directory.copy';
import { blankToNull, linesOf, readChecked, readText } from './form-values';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

const sameContacts = (a: readonly ServiceContact[], b: readonly ServiceContact[]) =>
  a.length === b.length &&
  a.every(
    (contact, index) =>
      contact.type === b[index]?.type &&
      contact.label === b[index]?.label &&
      contact.value === b[index]?.value,
  );

/**
 * One Tulong page, added or changed (`DL-170`) — information for residents, never a programme.
 *
 * A new page takes what `ServiceWrite` declares; a change takes what `ServicePatch` declares, and the
 * page's address, category, who it is for, places and office are shown as set at creation, with the
 * reason (`ServiceChanges`). Featuring and the picture come after the page exists: the API refuses
 * `featured` on a create, and the picture is uploaded to the page's own id.
 *
 * Every consequence — hiding it, featuring it, replacing its picture — is listed before the button
 * that does it (`SERVICE_EFFECTS`).
 */
@Component({
  selector: 'app-service-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFileField],
  templateUrl: './service-form.html',
  styleUrl: './directory-form.scss',
})
export class ServiceForm {
  private readonly repository = inject(TULONG_SERVICE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** The page to change, or `null` to add one. */
  readonly service = input<TulongService | null>(null);
  /** The office directory, read once by the section. */
  readonly offices = input.required<ViewState<readonly Office[]>>();
  /** The page as the server answered after a save or an upload. */
  readonly saved = output<TulongService>();

  protected readonly copy = DIRECTORY_COPY.serviceForm;
  protected readonly effectsLead = DIRECTORY_COPY.list.effectsLead;
  protected readonly contactTypes = SERVICE_CONTACT_TYPES;
  protected readonly contactLabels = SERVICE_CONTACT_LABELS;
  protected readonly fixedLead = this.copy.fixedLead(SERVICE_FIXED_AFTER_CREATION.join(', '));

  protected readonly name = signal('');
  protected readonly slug = signal('');
  protected readonly category = signal('');
  protected readonly summary = signal('');
  protected readonly details = signal('');
  protected readonly eligibility = signal('');
  protected readonly requirements = signal('');
  protected readonly claimSteps = signal('');
  protected readonly contacts = signal<readonly ServiceContact[]>([]);
  protected readonly locations = signal<readonly ServiceLocation[]>([]);
  protected readonly officeId = signal<OfficeId | null>(null);
  protected readonly schedule = signal('');
  protected readonly legalBasis = signal('');
  protected readonly badge = signal('');
  protected readonly iconKey = signal('');
  protected readonly tileColor = signal('');
  protected readonly featuredHeadline = signal('');
  protected readonly hiddenFromList = signal(false);
  protected readonly featured = signal(false);
  protected readonly image = signal<Blob | null>(null);

  protected readonly busy = signal(false);
  protected readonly attempted = signal(false);
  protected readonly outcome = signal('');

  protected readonly creating = computed(() => this.service() === null);
  protected readonly directory = computed(() => valueOf(this.offices()) ?? []);

  private readonly draft = computed<ServiceDraft>(() => ({
    name: this.name().trim(),
    slug: this.slug().trim(),
    category: blankToNull(this.category()),
    summary: this.summary().trim(),
    details: this.details().trim(),
    eligibility: blankToNull(this.eligibility()),
    requirements: linesOf(this.requirements()),
    contacts: this.cleanContacts(),
    locations: this.locations().map((place) => ({
      name: place.name.trim(),
      address: place.address.trim(),
    })),
    officeId: this.officeId(),
    iconKey: blankToNull(this.iconKey()),
    tileColor: blankToNull(this.tileColor()),
    badge: blankToNull(this.badge()),
    legalBasis: blankToNull(this.legalBasis()),
    claimSteps: linesOf(this.claimSteps()),
    featuredHeadline: blankToNull(this.featuredHeadline()),
    schedule: blankToNull(this.schedule()),
    hiddenFromList: this.hiddenFromList(),
  }));

  /** What differs from the page as the server holds it — only what a change can carry. */
  private readonly changes = computed<ServiceChanges>(() => {
    const service = this.service();
    if (service === null) {
      return {};
    }
    const draft = this.draft();
    const changes: Mutable<ServiceChanges> = {};
    if (draft.name !== service.name) changes.name = draft.name;
    if (draft.summary !== service.summary) changes.summary = draft.summary;
    if (draft.details !== service.details) changes.details = draft.details;
    if (!sameList(draft.requirements, service.requirements)) {
      changes.requirements = draft.requirements;
    }
    if (!sameContacts(draft.contacts, service.contacts)) changes.contacts = draft.contacts;
    if (!sameList(draft.claimSteps, service.claimSteps)) changes.claimSteps = draft.claimSteps;
    if (draft.iconKey !== service.iconKey) changes.iconKey = draft.iconKey;
    if (draft.tileColor !== service.tileColor) changes.tileColor = draft.tileColor;
    if (draft.badge !== service.badge) changes.badge = draft.badge;
    if (draft.legalBasis !== service.legalBasis) changes.legalBasis = draft.legalBasis;
    if (draft.featuredHeadline !== service.featuredHeadline) {
      changes.featuredHeadline = draft.featuredHeadline;
    }
    if (draft.schedule !== service.schedule) changes.schedule = draft.schedule;
    if (draft.hiddenFromList !== service.hiddenFromList) {
      changes.hiddenFromList = draft.hiddenFromList;
    }
    if (this.featured() !== service.featured) changes.featured = this.featured();
    return changes;
  });

  protected readonly unchanged = computed(
    () => !this.creating() && Object.keys(this.changes()).length === 0,
  );

  protected readonly problems = computed<readonly string[]>(() =>
    serviceProblems(this.creating() ? this.draft() : this.changes()).map(
      (problem) => problem.message,
    ),
  );

  protected readonly effects = computed<readonly string[]>(() => {
    if (this.creating()) {
      return SERVICE_EFFECTS.create;
    }
    const changes = this.changes();
    return [
      ...(changes.hiddenFromList === true ? SERVICE_EFFECTS.hide : []),
      ...(changes.hiddenFromList === false ? SERVICE_EFFECTS.show : []),
      ...(changes.featured === true ? SERVICE_EFFECTS.feature : []),
      ...(changes.featured === false ? SERVICE_EFFECTS.unfeature : []),
      ...SERVICE_EFFECTS.update,
    ];
  });

  protected readonly imageEffects = computed<readonly string[]>(() =>
    this.service()?.hasImage === true ? SERVICE_EFFECTS.imageReplaced : SERVICE_EFFECTS.imageAdded,
  );

  constructor() {
    effect(() => {
      const service = this.service();
      untracked(() => this.fill(service));
    });
  }

  protected text(event: Event): string {
    return readText(event);
  }

  protected checked(event: Event): boolean {
    return readChecked(event);
  }

  protected officeName(id: OfficeId | null): string {
    if (id === null) {
      return this.copy.officeNone;
    }
    const office = this.directory().find((candidate) => candidate.id === id);
    return office === undefined ? id : officeLabel(office);
  }

  /** The office chosen in the picker — one the directory names, or none. */
  protected chooseOffice(event: Event): void {
    const chosen = readText(event);
    this.officeId.set(this.directory().find((office) => office.id === chosen)?.id ?? null);
  }

  protected label(office: Office): string {
    return officeLabel(office);
  }

  protected addContact(): void {
    this.contacts.update((rows) => [...rows, { type: 'hotline', label: null, value: '' }]);
  }

  protected removeContact(index: number): void {
    this.contacts.update((rows) => rows.filter((_, at) => at !== index));
  }

  protected setContact(index: number, change: Partial<ServiceContact>): void {
    this.contacts.update((rows) =>
      rows.map((row, at) => (at === index ? { ...row, ...change } : row)),
    );
  }

  protected contactType(event: Event): ServiceContactType {
    const value = readText(event);
    return SERVICE_CONTACT_TYPES.find((type) => type === value) ?? 'hotline';
  }

  protected addLocation(): void {
    this.locations.update((rows) => [...rows, { name: '', address: '' }]);
  }

  protected removeLocation(index: number): void {
    this.locations.update((rows) => rows.filter((_, at) => at !== index));
  }

  protected setLocation(index: number, change: Partial<ServiceLocation>): void {
    this.locations.update((rows) =>
      rows.map((row, at) => (at === index ? { ...row, ...change } : row)),
    );
  }

  protected save(): void {
    this.attempted.set(true);
    if (this.problems().length > 0 || this.unchanged() || this.busy()) {
      return;
    }
    const service = this.service();
    this.run(
      service === null
        ? this.repository.create(this.draft())
        : this.repository.update(service.id, this.changes()),
    );
  }

  /** The picture is its own act, applied at once — said before the button. */
  protected uploadImage(): void {
    const service = this.service();
    const image = this.image();
    if (service === null || image === null || this.busy()) {
      return;
    }
    this.run(this.repository.replaceImage(service.id, image));
  }

  private run(work: Observable<TulongService>): void {
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

  private cleanContacts(): readonly ServiceContact[] {
    return this.contacts().map((contact) => ({
      type: contact.type,
      label: blankToNull(contact.label ?? ''),
      value: contact.value.trim(),
    }));
  }

  private fill(service: TulongService | null): void {
    this.name.set(service?.name ?? '');
    this.slug.set(service?.slug ?? '');
    this.category.set(service?.category ?? '');
    this.summary.set(service?.summary ?? '');
    this.details.set(service?.details ?? '');
    this.eligibility.set(service?.eligibility ?? '');
    this.requirements.set((service?.requirements ?? []).join('\n'));
    this.claimSteps.set((service?.claimSteps ?? []).join('\n'));
    this.contacts.set(service?.contacts ?? []);
    this.locations.set(service?.locations ?? []);
    this.officeId.set(service?.officeId ?? null);
    this.schedule.set(service?.schedule ?? '');
    this.legalBasis.set(service?.legalBasis ?? '');
    this.badge.set(service?.badge ?? '');
    this.iconKey.set(service?.iconKey ?? '');
    this.tileColor.set(service?.tileColor ?? '');
    this.featuredHeadline.set(service?.featuredHeadline ?? '');
    this.hiddenFromList.set(service?.hiddenFromList ?? false);
    this.featured.set(service?.featured ?? false);
    this.image.set(null);
    this.attempted.set(false);
    this.outcome.set('');
  }
}
