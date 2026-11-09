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
import { firstValueFrom, of, switchMap } from 'rxjs';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  CORRECTION_FIELD_LABELS,
  EVENT_CORRECTION_PROBLEM_MESSAGES,
  EVENT_CATEGORY_LABELS,
  EVENT_PROBLEM_MESSAGES,
  EVENT_REPOSITORY,
  EVENT_TIMEZONE_LABEL,
  REGISTRATION_ELIGIBILITY_LABELS,
  TAYTAY_BARANGAYS,
  asId,
  asIsoDateTime,
  canBeCorrected,
  categoryGivesOutBenefit,
  correctionOf,
  eventCorrectionProblems,
  eventProblems,
  type BarangayId,
  type EventCategory,
  type EventCover,
  type EventDraft,
  type IsoDateTime,
  type LguEvent,
  type LguEventId,
  type RegistrationEligibility,
} from '@domain/index';
import { ImageFileField } from '@shared/media/image-file-field';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { EVENTS_COPY } from './events.copy';

/**
 * The event composer.
 *
 * One form, in the order somebody actually answers the questions: what it is,
 * when, where, who to ask, and only then how registration works. The command
 * asks for the simplicity of Facebook Events, and the departure from that is
 * the address field — a venue name alone is findable by whoever already knows
 * where it is, which is not the person the listing is for.
 *
 * Two rules are enforced while typing rather than on submit:
 *
 *  - **an end before its start** is refused on a *draft* as well as on
 *    publication, because unlike a missing field it cannot become correct by
 *    adding to it;
 *  - **a waitlist needs a capacity**, or it is a queue behind a door that never
 *    fills.
 *
 * Everything else is lenient while drafting and strict at publication, on the
 * reasoning in `DL-125`.
 *
 * The cover is a file, never an address (`DL-193`). `ImageFileField` refuses what the API would
 * refuse before anything is sent; the chosen image is stored only when the draft is saved, and the
 * composer says so before its button. Its description sits beside it, never behind a disclosure.
 *
 * **The same form corrects a published event** (`DL-195`), at `events/:id/correct`. It starts from
 * the event as it stands, asks why, offers "Tell registered residents" switched off, and says before
 * its button what the correction changes and who it tells — a change to when, where, who may
 * register or fewer places always tells everybody holding a place. The publication rules apply,
 * because residents are reading it.
 */
@Component({
  selector: 'app-event-composer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFileField, PageHeader, RouterLink],
  templateUrl: './event-composer-page.html',
  styleUrl: './event-composer-page.scss',
})
export class EventComposerPage {
  private readonly repository = inject(EVENT_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  /** Set by `events/:id/correct`; absent when creating. */
  readonly id = input<string>();

  protected readonly copy = EVENTS_COPY.composer;
  protected readonly categories = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];
  protected readonly eligibilities = Object.keys(
    REGISTRATION_ELIGIBILITY_LABELS,
  ) as RegistrationEligibility[];
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly timezone = EVENT_TIMEZONE_LABEL;

  protected readonly title = signal('');
  protected readonly summary = signal('');
  protected readonly details = signal('');
  protected readonly category = signal<EventCategory>('assembly');
  /** The chosen cover, already held to `APP_IMAGE_POLICY` by the field; sent only on save. */
  protected readonly cover = signal<Blob | null>(null);
  protected readonly altText = signal('');
  protected readonly startsAt = signal('');
  protected readonly endsAt = signal('');
  protected readonly venueName = signal('');
  protected readonly address = signal('');
  protected readonly mapUrl = signal('');
  protected readonly barangayId = signal<BarangayId | null>(null);
  protected readonly contactName = signal('');
  protected readonly contactOffice = signal('');
  protected readonly contactPhone = signal('');
  protected readonly registrationRequired = signal(false);
  protected readonly opensAt = signal('');
  protected readonly closesAt = signal('');
  protected readonly capacity = signal('');
  protected readonly safeLimit = signal('');
  protected readonly waitlist = signal(false);
  protected readonly eligibility = signal<RegistrationEligibility>('verified-residents');
  protected readonly givesOutBenefit = signal(false);
  protected readonly participationNote = signal('');
  protected readonly reminders = signal('');
  protected readonly saving = signal(false);

  /* ── Correcting (`DL-195`) ──────────────────────────────────────────────── */

  protected readonly correcting = computed(() => this.id() !== undefined);
  /** The event being corrected, as last read: `undefined` while loading, `null` if not found. */
  protected readonly original = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        id === undefined ? of(null) : this.repository.getById(asId<LguEventId>(id)),
      ),
    ),
  );
  /** The cover the event already has, kept unless a new file is chosen. */
  private readonly storedCover = signal<EventCover | null>(null);
  protected readonly reason = signal('');
  /** Off by default: a change residents do not plan around reaches them only when asked. */
  protected readonly tellRegistrants = signal(false);

  /** The category decides where it can: four kinds of event always give something out. */
  protected readonly benefitFixed = computed(() => categoryGivesOutBenefit(this.category()));

  /**
   * Fixed for the lifetime of the screen.
   *
   * A validation message that changes while somebody reads it is worse than
   * one that is a minute stale.
   */
  private readonly now = asIsoDateTime(new Date());

  constructor() {
    // The form starts from the event as it stands, once, when it arrives.
    effect(() => {
      const event = this.original();
      if (event !== undefined && event !== null) {
        this.fill(event);
      }
    });
  }

  protected readonly draft = computed<EventDraft>(() => ({
    title: this.title(),
    summary: this.summary(),
    details: this.details(),
    category: this.category(),
    image: this.coverImage(),
    startsAt: this.asDate(this.startsAt()),
    endsAt: this.asDate(this.endsAt()),
    venue: {
      name: this.venueName(),
      address: this.address(),
      mapUrl: this.mapUrl().trim() || null,
      barangayId: this.barangayId(),
    },
    contact: {
      name: this.contactName(),
      office: this.contactOffice(),
      phone: this.contactPhone().trim() || null,
    },
    registration: {
      isRequired: this.registrationRequired(),
      opensAt: this.asDate(this.opensAt()),
      closesAt: this.asDate(this.closesAt()),
      capacity: this.capacity().trim() === '' ? null : Number(this.capacity()),
      safeLimit: this.safeLimit().trim() === '' ? null : Number(this.safeLimit()),
      waitlistEnabled: this.waitlist(),
      eligibility: this.eligibility(),
      givesOutBenefit: this.benefitFixed() || this.givesOutBenefit(),
      participationNote: this.participationNote().trim() || null,
    },
    reminders: this.reminders().trim() || null,
  }));

  /** What would stop this being published, shown while it is being written. */
  protected readonly publishProblems = computed(() =>
    eventProblems(this.draft(), this.now, 'publish').map(
      (problem) => EVENT_PROBLEM_MESSAGES[problem],
    ),
  );

  /** What would stop it even being saved. A much shorter list, on purpose. */
  private readonly saveProblems = computed(() => eventProblems(this.draft(), this.now, 'save'));

  protected readonly blockingProblems = computed(() =>
    this.saveProblems().map((problem) => EVENT_PROBLEM_MESSAGES[problem]),
  );

  protected readonly canSave = computed(
    () => this.title().trim().length > 0 && this.saveProblems().length === 0 && !this.saving(),
  );

  /** What stops the correction, in words: the publication rules and the correction's own. */
  protected readonly correctionBlocks = computed<readonly string[]>(() => {
    const event = this.original();
    if (!this.correcting() || event === undefined || event === null) {
      return [];
    }
    return [
      ...eventCorrectionProblems(
        event,
        this.draft(),
        { reason: this.reason(), tellRegistrants: this.tellRegistrants() },
        this.now,
      ).map((problem) => EVENT_CORRECTION_PROBLEM_MESSAGES[problem]),
      ...this.publishProblems(),
    ];
  });

  /** What the correction would do, said before the button that does it. */
  protected readonly correctionEffects = computed<readonly string[]>(() => {
    const event = this.original();
    if (event === undefined || event === null) {
      return [];
    }
    const summary = correctionOf(event, this.draft());
    if (summary.changed.length === 0) {
      return [this.copy.correctionNothing];
    }
    const holders = event.registeredCount + event.waitlistedCount;
    const fields = summary.changed.map((field) => CORRECTION_FIELD_LABELS[field]);
    return [
      this.copy.correctionChanges(fields.join(', ')),
      summary.material
        ? this.copy.correctionTellsMaterial(holders)
        : this.tellRegistrants()
          ? this.copy.correctionTellsRequested(holders)
          : this.copy.correctionTellsNobody,
      this.copy.correctionKept,
    ];
  });

  protected readonly canCorrect = computed(() => {
    const event = this.original();
    return (
      event !== undefined &&
      event !== null &&
      this.correctionBlocks().length === 0 &&
      correctionOf(event, this.draft()).changed.length > 0 &&
      !this.saving()
    );
  });

  /** Whether the event can be corrected at all; said instead of the form when it cannot. */
  protected readonly correctable = computed(() => {
    const event = this.original();
    return event !== undefined && event !== null && canBeCorrected(event, this.now);
  });

  private coverImage(): EventDraft['image'] {
    const file = this.cover();
    if (file !== null) {
      return { kind: 'chosen', file, altText: this.altText() };
    }
    const stored = this.storedCover();
    return stored === null
      ? null
      : { kind: 'stored', mediaId: stored.mediaId, altText: this.altText() };
  }

  /** The form, filled from the event as it stands. */
  private fill(event: LguEvent): void {
    this.title.set(event.title);
    this.summary.set(event.summary);
    this.details.set(event.details);
    this.category.set(event.category);
    this.storedCover.set(event.image);
    this.altText.set(event.image?.altText ?? '');
    this.startsAt.set(this.asLocal(event.startsAt));
    this.endsAt.set(this.asLocal(event.endsAt));
    this.venueName.set(event.venue.name);
    this.address.set(event.venue.address);
    this.mapUrl.set(event.venue.mapUrl ?? '');
    this.barangayId.set(event.venue.barangayId);
    this.contactName.set(event.contact.name);
    this.contactOffice.set(event.contact.office);
    this.contactPhone.set(event.contact.phone ?? '');
    this.registrationRequired.set(event.registration.isRequired);
    this.opensAt.set(
      event.registration.opensAt === null ? '' : this.asLocal(event.registration.opensAt),
    );
    this.closesAt.set(
      event.registration.closesAt === null ? '' : this.asLocal(event.registration.closesAt),
    );
    this.capacity.set(
      event.registration.capacity === null ? '' : String(event.registration.capacity),
    );
    this.safeLimit.set(
      event.registration.safeLimit === null ? '' : String(event.registration.safeLimit),
    );
    this.waitlist.set(event.registration.waitlistEnabled);
    this.eligibility.set(event.registration.eligibility);
    this.givesOutBenefit.set(event.registration.givesOutBenefit);
    this.participationNote.set(event.registration.participationNote ?? '');
    this.reminders.set(event.reminders ?? '');
  }

  /** An instant as a `datetime-local` value, in this browser's time, as the field reads it back. */
  private asLocal(value: IsoDateTime): string {
    const at = new Date(value);
    const two = (part: number): string => String(part).padStart(2, '0');
    const local =
      `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}` +
      `T${two(at.getHours())}:${two(at.getMinutes())}`;
    this.filledTimes.set(local, value);
    return local;
  }

  /** The event's own instants, by the field text they were filled as. */
  private readonly filledTimes = new Map<string, IsoDateTime>();

  private asDate(value: string): EventDraft['startsAt'] {
    // A time left as the event had it is the event's own instant, seconds included, so an untouched
    // field never reads as a correction of when the event is.
    return value === '' ? null : (this.filledTimes.get(value) ?? asIsoDateTime(new Date(value)));
  }

  protected categoryLabel(category: EventCategory): string {
    return EVENT_CATEGORY_LABELS[category];
  }

  protected onText(target: { set: (value: string) => void }, event: Event): void {
    target.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  protected onCategory(event: Event): void {
    this.category.set((event.target as HTMLSelectElement).value as EventCategory);
  }

  protected onBarangay(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.barangayId.set(value === '' ? null : asId<BarangayId>(value));
  }

  protected onRegistrationRequired(event: Event): void {
    this.registrationRequired.set((event.target as HTMLInputElement).checked);
  }

  protected onWaitlist(event: Event): void {
    this.waitlist.set((event.target as HTMLInputElement).checked);
  }

  protected onEligibility(value: RegistrationEligibility): void {
    this.eligibility.set(value);
  }

  protected eligibilityLabel(value: RegistrationEligibility): string {
    return REGISTRATION_ELIGIBILITY_LABELS[value];
  }

  protected onGivesOutBenefit(event: Event): void {
    this.givesOutBenefit.set((event.target as HTMLInputElement).checked);
  }

  protected onTellRegistrants(event: Event): void {
    this.tellRegistrants.set((event.target as HTMLInputElement).checked);
  }

  protected submit(): Promise<void> {
    return this.correcting() ? this.saveCorrection() : this.save();
  }

  protected async saveCorrection(): Promise<void> {
    const event = this.original();
    if (!this.canCorrect() || event === undefined || event === null) {
      return;
    }
    this.saving.set(true);
    try {
      const corrected = await firstValueFrom(
        this.repository.correct(asId<LguEventId>(event.id), this.draft(), {
          reason: this.reason(),
          tellRegistrants: this.tellRegistrants(),
        }),
      );
      this.notifications.success(this.copy.corrected);
      await this.router.navigate(['/events', asId<LguEventId>(corrected.id)]);
    } catch {
      this.notifications.error(this.copy.correctFailed);
    } finally {
      this.saving.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    try {
      const event = await firstValueFrom(this.repository.saveDraft(this.draft(), null));
      this.notifications.success(this.copy.saved);
      // Straight to the event, which is where publishing happens: the composer
      // writes, the detail screen decides.
      await this.router.navigate(['/events', asId<LguEventId>(event.id)]);
    } catch {
      this.notifications.error(this.copy.saveFailed);
    } finally {
      this.saving.set(false);
    }
  }
}
