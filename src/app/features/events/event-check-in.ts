import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  ATTENDANCE_CATALOG,
  CHECK_IN_MIN_LENGTH,
  EVENT_REPOSITORY,
  REGISTRATION_STATUS_CATALOG,
  type CheckInLookup,
  type LguEventId,
  type RegistrantView,
} from '@domain/index';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { EVENTS_COPY } from './events.copy';

/**
 * Check-in mode (`DL-195`): one registrant at a time, found by name or reference, and never the
 * list.
 *
 * A door list turned to face the queue shows everybody already on it — the NPC's concern with open
 * logbooks (Advisory Opinion 2018-003, and its 2020 probe of open contact-tracing forms). So this
 * asks the server for a handful of matches to what was typed, shows only those, and empties itself
 * once somebody is marked: the next person at the table does not read the last one's name.
 *
 * The lookup runs when the officer presses Find rather than as they type, because every partial
 * name typed into a debounced box would list whoever happens to share its first letters.
 */
@Component({
  selector: 'app-event-check-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusBadge],
  templateUrl: './event-check-in.html',
  styleUrl: './event-check-in.scss',
})
export class EventCheckIn {
  private readonly repository = inject(EVENT_REPOSITORY);
  private readonly notifications = inject(NotificationStore);

  readonly eventId = input.required<LguEventId>();
  /** A registrant marked here, so the page can count again. */
  readonly marked = output<RegistrantView>();

  protected readonly copy = EVENTS_COPY.detail;
  protected readonly registrationCatalog = REGISTRATION_STATUS_CATALOG;
  protected readonly attendanceCatalog = ATTENDANCE_CATALOG;

  protected readonly term = signal('');
  protected readonly busy = signal(false);
  protected readonly lookup = signal<CheckInLookup | null>(null);
  /** What was last done, said in a live region and kept until the next lookup. */
  protected readonly done = signal<string | null>(null);

  protected readonly canFind = computed(
    () => this.term().trim().length >= CHECK_IN_MIN_LENGTH && !this.busy(),
  );

  protected onTerm(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
  }

  protected async find(): Promise<void> {
    if (!this.canFind()) {
      return;
    }
    this.busy.set(true);
    this.done.set(null);
    try {
      this.lookup.set(await firstValueFrom(this.repository.checkIn(this.eventId(), this.term())));
    } catch {
      this.lookup.set(null);
      this.notifications.error(this.copy.checkInFailed);
    } finally {
      this.busy.set(false);
    }
  }

  protected async markAttended(row: RegistrantView): Promise<void> {
    this.busy.set(true);
    try {
      const updated = await firstValueFrom(
        this.repository.markAttendance(this.eventId(), row.id, 'attended'),
      );
      // Emptied before the next person steps up: nothing of this one stays on the screen except
      // the reference in the sentence that says it was done.
      this.term.set('');
      this.lookup.set(null);
      this.done.set(this.copy.checkInMarked(updated.reference));
      this.marked.emit(updated);
    } catch {
      this.notifications.error(this.copy.failed);
    } finally {
      this.busy.set(false);
    }
  }
}
