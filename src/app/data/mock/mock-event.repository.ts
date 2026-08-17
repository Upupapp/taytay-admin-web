import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  EVENT_STATUS_TRANSITIONS,
  PermissionDeniedError,
  REGISTRANT_EXPORT_NOTICE,
  asId,
  asIsoDateTime,
  attendanceRateOf,
  barangayName,
  canTransition,
  discloseResident,
  eventProblems,
  matchesEventView,
  registrationProblems,
  targetStatusOf,
  toAuditRow,
  userHasPermission,
  type AttendanceStatus,
  type AuditRow,
  type EventCapacitySummary,
  type EventDraft,
  type EventFilter,
  type EventMetrics,
  type EventRegistration,
  type EventRegistrationId,
  type EventRepository,
  type EventView,
  type LguEvent,
  type LguEventId,
  type Permission,
  type RegistrantExport,
  type RegistrantFilter,
  type RegistrantView,
  type RegistrationAction,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { matchesSearch } from './mock-query';
import { MockLatency } from './mock-latency';
import { MOCK_EVENTS, MOCK_REGISTRATIONS } from './seed/events.seed';
import { MOCK_RESIDENTS } from './seed/residents.seed';

const STATUS_AUDIT = {
  published: 'published',
  cancelled: 'cancelled',
  completed: 'status-changed',
  archived: 'archived',
} as const;

const STATUS_SUMMARY = {
  published: 'Event published.',
  cancelled: 'Event cancelled. Everybody registered is notified.',
  completed: 'Event completed. Attendance declared final.',
  archived: 'Event archived.',
} as const;

/**
 * The events adapter.
 *
 * Three rules are enforced **here** rather than assumed of the screens:
 *
 *  - **A registrant list is composed, never handed over whole** (`DL-130`).
 *    Reads return `RegistrantView`, which holds a reference, a display name, a
 *    barangay, a date and two statuses. A template cannot leak an address it
 *    was never given.
 *  - **The display name goes through the resident disclosure policy**
 *    (`DL-38`). A registrant is a resident, and a second surface formatting the
 *    name itself would quietly hand an events clerk the full name of somebody
 *    the residents module shows as "Cordero, M." — the protection is one
 *    reader, or it is not a protection.
 *  - **Capacity is reported, never enforced** (`DL-129`). Every summary carries
 *    the moment it was taken, and promoting from the waitlist is attempted
 *    rather than predicted. This adapter is a stand-in for a backend that owns
 *    the truth; it must not pretend to be that backend.
 */
@Injectable()
export class MockEventRepository implements EventRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private events: readonly LguEvent[] = [...MOCK_EVENTS];
  private registrations: readonly EventRegistration[] = [...MOCK_REGISTRATIONS];
  private trail: readonly AuditRow[] = [];

  /* ── Reading ────────────────────────────────────────────────────────────── */

  list(view: EventView, filter: EventFilter): Observable<readonly LguEvent[]> {
    const denied = denyUnless<readonly LguEvent[]>(this.access.currentUser(), 'events.view');
    if (denied) {
      return denied;
    }
    const now = asIsoDateTime(new Date());
    const matched = this.events
      .filter((event) => matchesEventView(event, view, now))
      .filter((event) => filter.category === undefined || event.category === filter.category)
      .filter((event) => filter.from === undefined || event.startsAt >= filter.from)
      .filter((event) => filter.to === undefined || event.startsAt <= filter.to)
      .filter((event) => matchesSearch([event.title, event.summary, event.venue.name], filter.search));

    // Soonest first. An events list is read to answer "what is next", and a
    // newest-created ordering answers a question nobody asked.
    return this.latency.respond(
      [...matched]
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((event) => this.withCounts(event)),
    );
  }

  getById(id: LguEventId): Observable<LguEvent | null> {
    if (!userHasPermission(this.access.currentUser(), 'events.view')) {
      return this.latency.respond(null);
    }
    const found = this.events.find((event) => event.id === id);
    return this.latency.respond(found === undefined ? null : this.withCounts(found));
  }

  history(id: LguEventId): Observable<readonly AuditRow[]> {
    const denied = denyUnless<readonly AuditRow[]>(this.access.currentUser(), 'events.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(this.trail.filter((row) => row.entityId === id));
  }

  /* ── Registrants ────────────────────────────────────────────────────────── */

  registrants(id: LguEventId, filter: RegistrantFilter): Observable<readonly RegistrantView[]> {
    const denied = denyUnless<readonly RegistrantView[]>(this.access.currentUser(), 'events.view');
    if (denied) {
      return denied;
    }
    const views = this.registrationsFor(id)
      .map((registration) => this.compose(registration))
      .filter((view) => filter.status === undefined || view.status === filter.status)
      .filter((view) => filter.attendance === undefined || view.attendance === filter.attendance)
      .filter((view) => matchesSearch([view.displayName, view.reference], filter.search));

    return this.latency.respond(views);
  }

  capacity(id: LguEventId): Observable<EventCapacitySummary> {
    const denied = denyUnless<EventCapacitySummary>(this.access.currentUser(), 'events.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(this.summaryFor(id));
  }

  metrics(id: LguEventId): Observable<EventMetrics> {
    const denied = denyUnless<EventMetrics>(this.access.currentUser(), 'events.view-insights');
    if (denied) {
      return denied;
    }
    const summary = this.summaryFor(id);
    const event = this.events.find((entry) => entry.id === id);
    const marked = summary.attendedCount + summary.noShowCount;
    return this.latency.respond({
      eventId: id,
      registeredCount: summary.registeredCount,
      waitlistedCount: summary.waitlistedCount,
      cancelledCount: summary.cancelledCount,
      attendedCount: summary.attendedCount,
      noShowCount: summary.noShowCount,
      unmarkedCount: Math.max(0, summary.registeredCount - marked),
      // Withheld until the office says attendance is final, because a rate
      // taken mid-afternoon reads as a poor turnout (`DL-131`).
      attendanceRate: attendanceRateOf(summary, event?.status === 'completed'),
      asOf: summary.asOf,
    });
  }

  /* ── Writing ────────────────────────────────────────────────────────────── */

  saveDraft(draft: EventDraft, id: LguEventId | null): Observable<LguEvent> {
    const user = this.access.currentUser();
    const denied = denyUnless<LguEvent>(user, id === null ? 'events.create' : 'events.edit');
    if (denied) {
      return denied;
    }
    const problems = eventProblems(draft, asIsoDateTime(new Date()), 'save');
    if (problems.length > 0) {
      return throwError(() => new Error(problems.join(', ')));
    }

    const now = asIsoDateTime(new Date());
    const existing = id === null ? undefined : this.events.find((event) => event.id === id);
    if (id !== null && existing === undefined) {
      return throwError(() => new PermissionDeniedError('events.edit'));
    }

    const saved: LguEvent = {
      id: existing?.id ?? asId<LguEventId>(`event-${String(this.events.length + 1).padStart(4, '0')}`),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      details: draft.details,
      category: draft.category,
      status: existing?.status ?? 'draft',
      image: draft.image,
      // A draft may be saved without dates; the composer refuses to publish
      // one, and the placeholder never reaches a resident.
      startsAt: draft.startsAt ?? existing?.startsAt ?? now,
      endsAt: draft.endsAt ?? existing?.endsAt ?? now,
      venue: draft.venue,
      contact: draft.contact,
      registration: draft.registration,
      reminders: draft.reminders,
      publishedAt: existing?.publishedAt ?? null,
      publishedBy: existing?.publishedBy ?? null,
      cancelledAt: existing?.cancelledAt ?? null,
      cancellationReason: existing?.cancellationReason ?? null,
      replacesEventId: existing?.replacesEventId ?? null,
      // Carried through rather than recomputed here: saving the wording of an
      // event does not change who signed up for it.
      registeredCount: existing?.registeredCount ?? 0,
      waitlistedCount: existing?.waitlistedCount ?? 0,
      audit: {
        createdAt: existing?.audit.createdAt ?? now,
        createdBy: existing?.audit.createdBy ?? user?.id ?? null,
        updatedAt: now,
        updatedBy: user?.id ?? null,
      },
    };

    this.events =
      existing === undefined
        ? [saved, ...this.events]
        : this.events.map((event) => (event.id === saved.id ? saved : event));
    this.record(saved, existing === undefined ? 'created' : 'updated',
      existing === undefined ? 'Event created.' : 'Event edited.', null);
    return this.latency.respond(saved);
  }

  publish(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.move(id, 'published', 'events.publish', reason, (event, user) => ({
      status: 'published' as const,
      publishedAt: event.publishedAt ?? asIsoDateTime(new Date()),
      publishedBy: event.publishedBy ?? user,
    }));
  }

  cancel(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.move(id, 'cancelled', 'events.cancel', reason, () => ({
      status: 'cancelled' as const,
      cancelledAt: asIsoDateTime(new Date()),
      cancellationReason: reason,
    }));
  }

  complete(id: LguEventId, reason: string): Observable<LguEvent> {
    // Nothing is swept: whoever is `not-checked-in` when this runs stays
    // `not-checked-in`. Turning them into no-shows would be the software
    // making a claim about people it never saw (`DL-131`).
    return this.move(id, 'completed', 'events.edit', reason, () => ({
      status: 'completed' as const,
    }));
  }

  archive(id: LguEventId, reason: string): Observable<LguEvent> {
    return this.move(id, 'archived', 'events.archive', reason, () => ({
      status: 'archived' as const,
    }));
  }

  actOnRegistration(
    registrationId: EventRegistrationId,
    action: RegistrationAction,
    reason: string,
  ): Observable<RegistrantView> {
    const denied = denyUnless<RegistrantView>(
      this.access.currentUser(),
      'events.manage-registrations',
    );
    if (denied) {
      return denied;
    }
    const registration = this.registrations.find((entry) => entry.id === registrationId);
    if (registration === undefined) {
      return throwError(() => new PermissionDeniedError('events.manage-registrations'));
    }
    const problems = registrationProblems(registration, action, reason);
    if (problems.length > 0) {
      return throwError(() => new Error(problems.join(', ')));
    }

    // Promotion is not gated on the office's own count. A stand-in backend
    // that refused here would be inventing the concurrency guarantee the
    // command says not to invent (`DL-129`).
    const updated = this.saveRegistration(registration, {
      status: targetStatusOf(action),
      statusReason: reason.trim(),
    });
    this.recordRegistration(updated, 'registration-changed', reason.trim());
    return this.latency.respond(this.compose(updated));
  }

  markAttendance(
    registrationId: EventRegistrationId,
    attendance: AttendanceStatus,
  ): Observable<RegistrantView> {
    const denied = denyUnless<RegistrantView>(this.access.currentUser(), 'events.mark-attendance');
    if (denied) {
      return denied;
    }
    const registration = this.registrations.find((entry) => entry.id === registrationId);
    if (registration === undefined) {
      return throwError(() => new PermissionDeniedError('events.mark-attendance'));
    }
    if (registration.status === 'cancelled') {
      return throwError(
        () => new Error('That registration was cancelled, so there is no attendance to record.'),
      );
    }
    const updated = this.saveRegistration(registration, { attendance });
    this.recordRegistration(updated, 'attendance-changed', null);
    return this.latency.respond(this.compose(updated));
  }

  exportRegistrants(id: LguEventId): Observable<RegistrantExport> {
    const user = this.access.currentUser();
    const denied = denyUnless<RegistrantExport>(user, 'events.export-registrations');
    if (denied) {
      return denied;
    }
    const event = this.events.find((entry) => entry.id === id);
    if (event === undefined) {
      return throwError(() => new PermissionDeniedError('events.export-registrations'));
    }
    const rows = this.registrationsFor(id).map((registration) => this.compose(registration));
    const now = asIsoDateTime(new Date());

    // Composed here, like a payout manifest (`DL-92`): the file holds exactly
    // the columns the screen showed, and its conditions travel inside it
    // (`DL-106`).
    const header = [
      `Event,${cell(event.title)}`,
      `Starts,${cell(event.startsAt)}`,
      `Venue,${cell(event.venue.name)}`,
      `Generated at,${cell(now)}`,
      `Generated by,${cell(user?.displayName ?? 'Unknown')}`,
      `Registrants,${rows.length}`,
      `Handling,${cell(REGISTRANT_EXPORT_NOTICE)}`,
      '',
      'Reference,Name,Barangay,Registered,Status,Attendance',
    ];
    const body = rows.map((row) =>
      [
        cell(row.reference),
        cell(row.displayName),
        cell(row.barangayId === null ? '' : barangayName(row.barangayId)),
        cell(row.registeredAt),
        cell(row.status),
        cell(row.attendance),
      ].join(','),
    );

    this.record(event, 'exported', `Registrant list exported (${rows.length} rows).`, null);
    return this.latency.respond({
      manifest: {
        eventId: event.id,
        eventTitle: event.title,
        eventStartsAt: event.startsAt,
        appliedFilterDescription: 'All registrations for this event.',
        generatedAt: now,
        generatedBy: user?.displayName ?? 'Unknown',
        rowCount: rows.length,
        handlingNotice: REGISTRANT_EXPORT_NOTICE,
      },
      content: [...header, ...body].join('\n'),
      filename: `registrants-${event.id}.csv`,
    });
  }

  /* ── Internals ──────────────────────────────────────────────────────────── */

  /**
   * One registration, reduced to what a screen may see.
   *
   * The name is produced by `discloseResident` rather than formatted here, so
   * a protected record reads the same on this screen as on every other one
   * (`DL-38`). A registrant whose resident record is missing is still listed —
   * silently dropping them would understate the count somebody is catering for.
   */
  private compose(registration: EventRegistration): RegistrantView {
    const resident = MOCK_RESIDENTS.find((entry) => entry.id === registration.residentId);
    const holds = (permission: Permission): boolean =>
      userHasPermission(this.access.currentUser(), permission);
    const disclosed = resident === undefined ? null : discloseResident(resident, holds);

    return {
      id: registration.id,
      reference: registration.reference,
      displayName: disclosed?.listedName ?? 'Not on the resident registry',
      barangayId: disclosed?.resident.address.barangayId ?? null,
      registeredAt: registration.registeredAt,
      status: registration.status,
      attendance: registration.attendance,
      // Notes are the office's own words about a person, so they need the
      // grant that covers managing the registration rather than merely seeing
      // that it exists.
      notes: holds('events.manage-registrations') ? registration.notes : null,
    };
  }

  /**
   * The counts, recomputed on the way out.
   *
   * Stored on the record so the list can render "registered / capacity"
   * without a query per row, but never trusted between reads: a promotion or a
   * cancellation a moment ago has to be visible on the next render, and a
   * stale figure here is exactly the failure `DL-129` is about.
   */
  private withCounts(event: LguEvent): LguEvent {
    const rows = this.registrationsFor(event.id);
    return {
      ...event,
      registeredCount: rows.filter((row) => row.status === 'registered').length,
      waitlistedCount: rows.filter((row) => row.status === 'waitlisted').length,
    };
  }

  private registrationsFor(id: LguEventId): readonly EventRegistration[] {
    return this.registrations
      .filter((registration) => registration.eventId === id)
      .slice()
      .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
  }

  private summaryFor(id: LguEventId): EventCapacitySummary {
    const rows = this.registrationsFor(id);
    const event = this.events.find((entry) => entry.id === id);
    const counted = (status: EventRegistration['status']) =>
      rows.filter((row) => row.status === status).length;
    const attendance = (value: AttendanceStatus) =>
      rows.filter((row) => row.status !== 'cancelled' && row.attendance === value).length;

    return {
      capacity: event?.registration.capacity ?? null,
      registeredCount: counted('registered'),
      waitlistedCount: counted('waitlisted'),
      cancelledCount: counted('cancelled'),
      attendedCount: attendance('attended'),
      noShowCount: attendance('no-show'),
      // Stamped every read, and printed on the screen. The office is told when
      // this was true rather than invited to assume it still is (`DL-129`).
      asOf: asIsoDateTime(new Date()),
    };
  }

  private move(
    id: LguEventId,
    to: LguEvent['status'],
    permission: Permission,
    reason: string,
    change: (event: LguEvent, user: LguEvent['publishedBy']) => Partial<LguEvent>,
  ): Observable<LguEvent> {
    const user = this.access.currentUser();
    const denied = denyUnless<LguEvent>(user, permission);
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('That needs a reason.'));
    }
    const event = this.events.find((entry) => entry.id === id);
    if (event === undefined) {
      return throwError(() => new PermissionDeniedError(permission));
    }
    if (!canTransition(EVENT_STATUS_TRANSITIONS, event.status, to)) {
      return throwError(() => new Error(`A ${event.status} event cannot become ${to}.`));
    }
    // Publication rules are re-run here with the publishing intent, so a screen
    // that forgot to check cannot put out an event with no venue or an
    // undescribed poster (`DL-125`).
    if (to === 'published') {
      const problems = eventProblems(toDraft(event), asIsoDateTime(new Date()), 'publish');
      if (problems.length > 0) {
        return throwError(() => new Error(problems.join(', ')));
      }
    }

    const now = asIsoDateTime(new Date());
    const updated: LguEvent = {
      ...event,
      ...change(event, user?.id ?? null),
      audit: { ...event.audit, updatedAt: now, updatedBy: user?.id ?? null },
    };
    this.events = this.events.map((entry) => (entry.id === updated.id ? updated : entry));
    this.record(updated, STATUS_AUDIT[to as keyof typeof STATUS_AUDIT] ?? 'status-changed',
      STATUS_SUMMARY[to as keyof typeof STATUS_SUMMARY] ?? 'Event updated.', reason.trim());
    return this.latency.respond(updated);
  }

  private saveRegistration(
    registration: EventRegistration,
    changes: Partial<EventRegistration>,
  ): EventRegistration {
    const user = this.access.currentUser();
    const updated: EventRegistration = {
      ...registration,
      ...changes,
      updatedBy: user?.id ?? null,
      audit: {
        ...registration.audit,
        updatedAt: asIsoDateTime(new Date()),
        updatedBy: user?.id ?? null,
      },
    };
    this.registrations = this.registrations.map((entry) =>
      entry.id === updated.id ? updated : entry,
    );
    return updated;
  }

  private record(
    event: LguEvent,
    action: AuditRow['action'],
    summary: string,
    reason: string | null,
  ): void {
    const user = this.access.currentUser();
    this.trail = [
      toAuditRow(
        {
          id: asId<AuditRow['id']>(`aud-ev-${this.trail.length + 1}`),
          entityType: 'lgu-event',
          entityId: event.id,
          action,
          summary,
          reason,
          actorId: user?.id ?? null,
          actorName: user?.displayName ?? 'Unknown',
          occurredAt: asIsoDateTime(new Date()),
        },
        'Event',
        'web',
        [],
        false,
      ),
      ...this.trail,
    ];
  }

  private recordRegistration(
    registration: EventRegistration,
    action: AuditRow['action'],
    reason: string | null,
  ): void {
    const event = this.events.find((entry) => entry.id === registration.eventId);
    if (event === undefined) {
      return;
    }
    // Recorded against the **event**, because that is the record the office
    // opens. The registration reference identifies the row without putting a
    // resident's name in the summary of a trail designed to be scrolled
    // (`DL-114`).
    this.record(
      event,
      action,
      action === 'attendance-changed'
        ? `Attendance recorded for ${registration.reference}: ${registration.attendance}.`
        : `Registration ${registration.reference} moved to ${registration.status}.`,
      reason,
    );
  }
}

function toDraft(event: LguEvent): EventDraft {
  return {
    title: event.title,
    summary: event.summary,
    details: event.details,
    category: event.category,
    image: event.image,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venue: event.venue,
    contact: event.contact,
    registration: event.registration,
    reminders: event.reminders,
  };
}

function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
