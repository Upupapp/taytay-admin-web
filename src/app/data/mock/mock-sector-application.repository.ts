import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDateTime,
  isCardLastFour,
  type AppAccountId,
  type ApplicantRecord,
  type CursorPage,
  type CursorRequest,
  type MediaId,
  type ResidentId,
  type SectorApplication,
  type SectorApplicationDetail,
  type SectorApplicationId,
  type SectorApplicationRepository,
  type SectorApplicationStatus,
  type SectorApproval,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { samplePlaceholder } from './seed/verification-requests.seed';

interface HeldApplication {
  application: SectorApplication;
  proofs: readonly MediaId[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function sample(
  n: number,
  sector: SectorApplication['sector'],
  name: string,
  daysAgo: number,
): HeldApplication {
  return {
    application: {
      id: asId<SectorApplicationId>(`sector-application-${String(n).padStart(4, '0')}`),
      sector,
      status: 'pending',
      submittedAt: asIsoDateTime(new Date(Date.now() - daysAgo * DAY_MS)),
      decidedAt: null,
      decidedBy: null,
      returnReason: null,
      residentId: null,
      proofCount: 1,
      applicant: {
        account: asId<AppAccountId>(`app-account-00${String(10 + n)}`),
        name,
        barangayName: 'San Juan',
      },
    },
    proofs: [asId<MediaId>(`sector-proof-${n}`)],
  };
}

/** Sample applications only, behind the mock. */
const SEED: readonly HeldApplication[] = [
  sample(1, 'senior-citizen', 'Sample Applicant One', 6),
  sample(2, 'pwd', 'Sample Applicant Two', 3),
  sample(3, 'solo-parent', 'Sample Applicant Three', 1),
];

const PROOF_WARNING =
  'A proof is a picture of a person’s card or certificate. Open it only to decide this application; it is not kept on this computer, and opening it is recorded under your name.';

/**
 * Sector applications over the mock registry (`DL-215`), as `office/sector-applications` behaves:
 * `resident.update`; pending oldest first, decided newest first; approving needs a reason, and a
 * link to a record when the account has none; returning needs a reason; a decided one is refused.
 */
@Injectable()
export class MockSectorApplicationRepository implements SectorApplicationRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly store = inject(MockResidentStore);
  private held: HeldApplication[] = SEED.map((entry) => ({ ...entry }));

  list(
    page: CursorRequest,
    status: SectorApplicationStatus,
  ): Observable<CursorPage<SectorApplication>> {
    const denied = this.deny<CursorPage<SectorApplication>>();
    if (denied) return denied;
    const matching = this.held
      .map((entry) => entry.application)
      .filter((application) => application.status === status)
      .sort((a, b) =>
        status === 'pending'
          ? a.submittedAt.localeCompare(b.submittedAt)
          : (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''),
      );
    const start = page.cursor ? Number(page.cursor) : 0;
    const end = start + page.limit;
    const hasMore = end < matching.length;
    return this.latency.respond({
      items: matching.slice(start, end),
      hasMore,
      nextCursor: hasMore ? String(end) : null,
    });
  }

  get(id: SectorApplicationId): Observable<SectorApplicationDetail | null> {
    const denied = this.deny<SectorApplicationDetail | null>();
    if (denied) return denied;
    const entry = this.find(id);
    if (entry === undefined) return this.latency.respond(null);
    const linked =
      entry.application.residentId === null
        ? null
        : this.recordOf(entry.application.residentId);
    return this.latency.respond({
      ...entry.application,
      proofs: entry.proofs,
      proofWarning: PROOF_WARNING,
      linkedResident: linked,
      candidates: linked === null ? this.candidates() : [],
      detailsWritable: this.access.currentUser()?.permissions.has('resident.view-sensitive') ?? false,
    });
  }

  openProof(id: SectorApplicationId, media: MediaId): Observable<Blob> {
    const denied = this.deny<Blob>();
    if (denied) return denied;
    if (!this.find(id)?.proofs.includes(media)) {
      return throwError(() => new Error('That proof was not found.'));
    }
    return this.latency.respond(samplePlaceholder('id-front'));
  }

  approve(id: SectorApplicationId, approval: SectorApproval): Observable<SectorApplication> {
    const denied = this.deny<SectorApplication>();
    if (denied) return denied;
    const entry = this.find(id);
    if (entry === undefined) return throwError(() => new Error('That application was not found.'));
    if (entry.application.status !== 'pending') {
      return throwError(() => new Error('That application has already been decided.'));
    }
    if (approval.reason.trim() === '') return throwError(() => new Error('A reason is required.'));
    const residentId = entry.application.residentId ?? approval.link?.residentId ?? null;
    if (residentId === null) {
      return throwError(
        () => new Error('Say which registry record this account is, and why, before approving.'),
      );
    }
    if (approval.details?.idLastFour !== undefined && !isCardLastFour(approval.details.idLastFour)) {
      return throwError(() => new Error('A card number is kept as its last four characters.'));
    }
    return this.decide(entry, {
      status: 'approved',
      residentId,
      returnReason: null,
    });
  }

  returnToApplicant(id: SectorApplicationId, reason: string): Observable<SectorApplication> {
    const denied = this.deny<SectorApplication>();
    if (denied) return denied;
    const entry = this.find(id);
    if (entry === undefined) return throwError(() => new Error('That application was not found.'));
    if (entry.application.status !== 'pending') {
      return throwError(() => new Error('That application has already been decided.'));
    }
    if (reason.trim() === '') return throwError(() => new Error('A reason is required.'));
    return this.decide(entry, { status: 'returned', residentId: null, returnReason: reason.trim() });
  }

  private decide(
    entry: HeldApplication,
    change: Pick<SectorApplication, 'status' | 'residentId' | 'returnReason'>,
  ): Observable<SectorApplication> {
    const decided: SectorApplication = {
      ...entry.application,
      ...change,
      residentId: change.residentId ?? entry.application.residentId,
      decidedAt: asIsoDateTime(new Date()),
      decidedBy: this.access.currentUser()?.displayName ?? null,
    };
    entry.application = decided;
    return this.latency.respond(decided);
  }

  private deny<T>(): Observable<T> | null {
    return denyUnless<T>(this.access.currentUser(), 'resident.update');
  }

  private find(id: SectorApplicationId): HeldApplication | undefined {
    return this.held.find((entry) => entry.application.id === id);
  }

  private recordOf(id: ResidentId): ApplicantRecord | null {
    const resident = this.store.find(id);
    return resident === undefined
      ? null
      : {
          residentId: resident.id,
          name: `${resident.name.last}, ${resident.name.first}`,
          barangayId: resident.address.barangayId,
        };
  }

  /** Sample suggestions: the first two registry records, standing in for the API's own rule. */
  private candidates(): readonly ApplicantRecord[] {
    return this.store
      .all()
      .slice(0, 2)
      .map((resident) => ({
        residentId: resident.id,
        name: `${resident.name.last}, ${resident.name.first}`,
        barangayId: resident.address.barangayId,
      }));
  }
}
