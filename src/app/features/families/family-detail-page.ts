import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  asId,
  FAMILY_REPOSITORY,
  FAMILY_ROLES,
  isRelationshipInvalid,
  isTransferRefused,
  isValidTransferReason,
  RELATIONSHIP_KINDS,
  type FamilyDetail,
  type FamilyId,
  type FamilyRole,
  type GraphNode,
  type RelationshipEvent,
  type RelationshipKind,
  type ResidentId,
  type ResidentView,
} from '@domain/index';
import { LOADING, toViewState, type ViewState } from '@shared/state/view-state';
import { RelationshipGraph } from '@shared/families/relationship-graph';
import { RELATIONSHIP_COPY } from '@shared/families/relationship.copy';
import { PersonPicker } from '@shared/residents/person-picker';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { FAMILIES_COPY } from './families.copy';

/**
 * One family: who is in it, who they are to each other, and everything anybody
 * has done to that record.
 *
 * Two things this screen refuses to imply. It never presents the household as
 * the family — the address is one fact among several, and the families sharing
 * it are listed beside it (`DL-47`). And it never lets a change overwrite the
 * past: moving a person and ending a relationship both append to a history the
 * page shows in full (`DL-48`).
 */
@Component({
  selector: 'app-family-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    DatePipe,
    HasPermissionDirective,
    Modal,
    PageHeader,
    PersonPicker,
    RelationshipGraph,
    RouterLink,
  ],
  templateUrl: './family-detail-page.html',
  styleUrl: './family-detail-page.scss',
})
export class FamilyDetailPage {
  private readonly repository = inject(FAMILY_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);

  readonly id = input.required<string>();

  protected readonly copy = FAMILIES_COPY.detail;
  protected readonly transferCopy = FAMILIES_COPY.transfer;
  protected readonly relationshipCopy = FAMILIES_COPY.relationship;
  protected readonly graphCopy = RELATIONSHIP_COPY;
  protected readonly roles = FAMILY_ROLES;
  protected readonly kinds = RELATIONSHIP_KINDS;

  private readonly reloads = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => toViewState(this.repository.getById(asId<FamilyId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<FamilyDetail | null> },
  );

  protected readonly canManage = computed(() => this.permissions.has('family.manage'));

  /* ── transfer ───────────────────────────────────────────────────────────── */

  protected readonly transferring = signal(false);
  protected readonly transferResident = signal<ResidentId | null>(null);
  protected readonly transferDestination = signal<FamilyId | null>(null);
  protected readonly transferRole = signal<FamilyRole>('other-member');
  protected readonly transferMovesHousehold = signal(false);
  protected readonly transferReason = signal('');
  protected readonly submitting = signal(false);

  protected readonly transferReasonOk = computed(() =>
    isValidTransferReason(this.transferReason()),
  );
  protected readonly canTransfer = computed(
    () => this.transferResident() !== null && this.transferReasonOk() && !this.submitting(),
  );

  /* ── relationship ───────────────────────────────────────────────────────── */

  protected readonly recording = signal(false);
  protected readonly relationshipSubject = signal<ResidentView | null>(null);
  protected readonly relationshipObject = signal<ResidentView | null>(null);
  protected readonly relationshipKind = signal<RelationshipKind>('parent-of');
  protected readonly relationshipReason = signal('');

  protected readonly canRecord = computed(
    () =>
      this.relationshipSubject() !== null &&
      this.relationshipObject() !== null &&
      this.relationshipReason().trim().length > 0 &&
      !this.submitting(),
  );

  /* ── formatting ─────────────────────────────────────────────────────────── */

  protected memberOptions(detail: FamilyDetail): readonly GraphNode[] {
    return detail.graph.nodes.filter((node) => node.isCurrentMember);
  }

  protected roleLabel(role: FamilyRole): string {
    return this.graphCopy.roleLabel[role];
  }

  protected kindLabel(kind: RelationshipKind): string {
    return this.graphCopy.kindLabel[kind];
  }

  protected eventLabel(event: RelationshipEvent): string {
    return this.graphCopy.eventLabel[event.kind];
  }

  /* ── transfer actions ───────────────────────────────────────────────────── */

  protected openTransfer(): void {
    this.transferResident.set(null);
    this.transferDestination.set(null);
    this.transferRole.set('other-member');
    this.transferMovesHousehold.set(false);
    this.transferReason.set('');
    this.transferring.set(true);
  }

  protected onTransferResident(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.transferResident.set(value ? asId<ResidentId>(value) : null);
  }

  protected onTransferDestination(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.transferDestination.set(value ? asId<FamilyId>(value) : null);
  }

  protected onTransferRole(event: Event): void {
    this.transferRole.set((event.target as HTMLSelectElement).value as FamilyRole);
  }

  protected onTransferHousehold(event: Event): void {
    this.transferMovesHousehold.set((event.target as HTMLInputElement).checked);
  }

  protected onTransferReason(event: Event): void {
    this.transferReason.set((event.target as HTMLInputElement).value);
  }

  protected confirmTransfer(): void {
    const residentId = this.transferResident();
    if (residentId === null || !this.canTransfer()) {
      return;
    }
    this.submitting.set(true);
    this.repository
      .transferResident({
        residentId,
        fromFamilyId: asId<FamilyId>(this.id()),
        toFamilyId: this.transferDestination(),
        role: this.transferRole(),
        moveHousehold: this.transferMovesHousehold(),
        reason: this.transferReason().trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.transferring.set(false);
          this.notifications.success(this.transferCopy.saved);
          this.reloads.update((value) => value + 1);
        },
        error: (failure: unknown) => {
          this.submitting.set(false);
          this.notifications.error(
            isTransferRefused(failure)
              ? failure.problems
                  .map((problem) => FAMILIES_COPY.transferProblem[problem.code])
                  .join(' ')
              : failure instanceof Error
                ? failure.message
                : 'That move could not be recorded.',
          );
        },
      });
  }

  /* ── relationship actions ───────────────────────────────────────────────── */

  protected openRecord(): void {
    this.relationshipSubject.set(null);
    this.relationshipObject.set(null);
    this.relationshipKind.set('parent-of');
    this.relationshipReason.set('');
    this.recording.set(true);
  }

  protected onRelationshipKind(event: Event): void {
    this.relationshipKind.set((event.target as HTMLSelectElement).value as RelationshipKind);
  }

  protected onRelationshipReason(event: Event): void {
    this.relationshipReason.set((event.target as HTMLInputElement).value);
  }

  protected confirmRecord(): void {
    const subject = this.relationshipSubject();
    const object = this.relationshipObject();
    if (subject === null || object === null || !this.canRecord()) {
      return;
    }
    this.submitting.set(true);
    this.repository
      .recordRelationship(
        subject.resident.id,
        object.resident.id,
        this.relationshipKind(),
        this.relationshipReason().trim(),
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.recording.set(false);
          this.notifications.success(this.relationshipCopy.saved);
          this.reloads.update((value) => value + 1);
        },
        error: (failure: unknown) => {
          this.submitting.set(false);
          this.notifications.error(
            isRelationshipInvalid(failure)
              ? failure.problems
                  .map((problem) => FAMILIES_COPY.relationshipProblem[problem.code])
                  .join(' ')
              : failure instanceof Error
                ? failure.message
                : 'That relationship could not be recorded.',
          );
        },
      });
  }

  protected cancel(): void {
    this.transferring.set(false);
    this.recording.set(false);
  }
}
