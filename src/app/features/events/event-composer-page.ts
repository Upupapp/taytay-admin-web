import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  EVENT_CATEGORY_LABELS,
  EVENT_PROBLEM_MESSAGES,
  EVENT_REPOSITORY,
  EVENT_TIMEZONE_LABEL,
  TAYTAY_BARANGAYS,
  asId,
  asIsoDateTime,
  eventProblems,
  type BarangayId,
  type EventCategory,
  type EventDraft,
  type LguEventId,
} from '@domain/index';
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
 */
@Component({
  selector: 'app-event-composer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RouterLink],
  templateUrl: './event-composer-page.html',
  styleUrl: './event-composer-page.scss',
})
export class EventComposerPage {
  private readonly repository = inject(EVENT_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  protected readonly copy = EVENTS_COPY.composer;
  protected readonly categories = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly timezone = EVENT_TIMEZONE_LABEL;

  protected readonly title = signal('');
  protected readonly summary = signal('');
  protected readonly details = signal('');
  protected readonly category = signal<EventCategory>('assembly');
  protected readonly imageUrl = signal('');
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
  protected readonly waitlist = signal(false);
  protected readonly participationNote = signal('');
  protected readonly reminders = signal('');
  protected readonly saving = signal(false);

  /**
   * Fixed for the lifetime of the screen.
   *
   * A validation message that changes while somebody reads it is worse than
   * one that is a minute stale.
   */
  private readonly now = asIsoDateTime(new Date());

  protected readonly draft = computed<EventDraft>(() => ({
    title: this.title(),
    summary: this.summary(),
    details: this.details(),
    category: this.category(),
    image:
      this.imageUrl().trim() === ''
        ? null
        : { url: this.imageUrl().trim(), altText: this.altText() },
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
      waitlistEnabled: this.waitlist(),
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

  private asDate(value: string): EventDraft['startsAt'] {
    return value === '' ? null : asIsoDateTime(new Date(value));
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
