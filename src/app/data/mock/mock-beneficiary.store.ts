import { Injectable } from '@angular/core';

import {
  asId,
  asIsoDateTime,
  pairKey,
  type IdentityResolution,
  type IdentityResolutionDraft,
  type IdentityResolutionId,
  type ProgramEnrollment,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import { MOCK_ENROLLMENTS } from './seed/enrollments.seed';

/**
 * Mutable mock state for the beneficiary registry.
 *
 * Holds two things: programme enrollments, and the findings reviewers have
 * recorded about whether two records are the same person.
 *
 * **Nothing here deletes.** A resolution is appended; a superseded record keeps
 * existing and keeps its history; and the pair index exists so the same two
 * records are answered once rather than resurfacing in the queue forever
 * (`DL-74`).
 */
@Injectable({ providedIn: 'root' })
export class MockBeneficiaryStore {
  private readonly enrollments: readonly ProgramEnrollment[] = [...MOCK_ENROLLMENTS];
  private resolutions: readonly IdentityResolution[] = [];
  private sequence = 0;

  enrollmentsFor(residentId: ResidentId): readonly ProgramEnrollment[] {
    return this.enrollments.filter((enrollment) => enrollment.residentId === residentId);
  }

  allEnrollments(): readonly ProgramEnrollment[] {
    return this.enrollments;
  }

  allResolutions(): readonly IdentityResolution[] {
    return this.resolutions;
  }

  resolutionsFor(residentId: ResidentId): readonly IdentityResolution[] {
    return this.resolutions
      .filter((resolution) => resolution.pair.includes(residentId))
      .slice()
      .sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : -1));
  }

  /** The finding already recorded about this pair, if a reviewer has answered. */
  findForPair(a: ResidentId, b: ResidentId): IdentityResolution | undefined {
    const key = pairKey(a, b);
    return this.resolutions.find(
      (resolution) => pairKey(resolution.pair[0], resolution.pair[1]) === key,
    );
  }

  /** True once a reviewer has answered for this pair, either way. */
  isPairResolved(a: ResidentId, b: ResidentId): boolean {
    return this.findForPair(a, b) !== undefined;
  }

  /**
   * Records a finding.
   *
   * **Idempotent on the pair.** A reviewer who taps twice on a slow municipal
   * connection records one finding, and a second call with the same verdict
   * returns the first rather than appending a contradictory duplicate. A
   * *different* verdict for an already-answered pair is refused by the
   * repository, not silently applied here.
   */
  record(draft: IdentityResolutionDraft, decidedBy: StaffUserId): IdentityResolution {
    const existing = this.findForPair(draft.pair[0], draft.pair[1]);
    if (existing !== undefined) {
      return existing;
    }

    this.sequence += 1;
    const resolution: IdentityResolution = {
      id: asId<IdentityResolutionId>(`idr-${String(this.sequence).padStart(4, '0')}`),
      verdict: draft.verdict,
      canonicalResidentId: draft.canonicalResidentId,
      supersededResidentId:
        draft.verdict === 'same-person' && draft.canonicalResidentId !== null
          ? otherOf(draft.pair, draft.canonicalResidentId)
          : null,
      pair: draft.pair,
      reason: draft.reason.trim(),
      decidedBy,
      decidedAt: asIsoDateTime(new Date()),
    };

    this.resolutions = [...this.resolutions, resolution];
    return resolution;
  }

  /**
   * The record a person's identity now points at, following supersessions.
   *
   * Walks the chain, because A can be found the same as B and B later the same
   * as C. Bounded by the number of resolutions so a cycle — which the repository
   * refuses to create, but which a future API might hand us — cannot hang a
   * screen.
   */
  canonicalIdFor(residentId: ResidentId): ResidentId {
    let current = residentId;

    for (let hops = 0; hops <= this.resolutions.length; hops += 1) {
      const supersession = this.resolutions.find(
        (resolution) =>
          resolution.verdict === 'same-person' && resolution.supersededResidentId === current,
      );
      if (supersession?.canonicalResidentId === undefined) {
        return current;
      }
      if (supersession.canonicalResidentId === null) {
        return current;
      }
      current = supersession.canonicalResidentId;
    }

    return current;
  }

  /** True when this record has been superseded by another identity. */
  isSuperseded(residentId: ResidentId): boolean {
    return this.canonicalIdFor(residentId) !== residentId;
  }
}

function otherOf(pair: readonly [ResidentId, ResidentId], one: ResidentId): ResidentId {
  return pair[0] === one ? pair[1] : pair[0];
}
