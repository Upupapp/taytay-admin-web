import { Injectable } from '@angular/core';

import {
  REQUEST_WITHHELD_FIELDS,
  hasSensitiveSector,
  isWithinBarangayScope,
  maskDocumentNumber,
  userHasPermission,
  type AssistanceRequest,
  type AuthenticatedUser,
  type Resident,
} from '@domain/index';

import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';

/**
 * The assistance requests of this session, held once.
 *
 * Apart from the request adapter since casework phase 3 (`DL-179`): a case names the requests it
 * covers, and the case adapter has to read the same requests the request adapter files — a case
 * that could only name the seed's requests would refuse every request filed in the session. Like
 * the other stores, it lasts for the life of the tab.
 */
@Injectable({ providedIn: 'root' })
export class MockAssistanceRequestStore {
  /** Every request, drafts included. Replaced whole on each write, never edited in place. */
  requests: AssistanceRequest[] = [...MOCK_ASSISTANCE_REQUESTS];
}

/**
 * Whether a reader may open a request: their barangay scope, and for a caseload only the filed
 * requests assigned to them (`DL-178`). A case does not widen this (`DL-179`).
 */
export function inReach(user: AuthenticatedUser | null, request: AssistanceRequest): boolean {
  if (user === null || !isWithinBarangayScope(user, request.barangayId)) {
    return false;
  }
  return (
    user.scope !== 'assigned-cases' ||
    (request.referenceNumber !== '' && request.assignedTo === user.id)
  );
}

/**
 * A request as this reader may see it, redacted here rather than in a template (`DL-38`): a
 * protected request's words withheld from a reader without `request.view-sensitive`, the case study
 * from a reader without `case.view`, and document numbers masked without the grant to read them.
 */
export function discloseRequest(
  request: AssistanceRequest,
  user: AuthenticatedUser | null,
  resident: Resident | undefined,
): AssistanceRequest {
  const isProtected = resident !== undefined && hasSensitiveSector(resident);
  const masked = isProtected && !userHasPermission(user, 'request.view-sensitive');
  const withheld = masked ? [...REQUEST_WITHHELD_FIELDS] : [];
  if (!masked && !userHasPermission(user, 'case.view')) {
    withheld.push('assessment');
  }
  const caseStudyWithheld = withheld.includes('assessment');
  const fullNumbers = userHasPermission(user, 'document.view-full-number');

  return {
    ...request,
    isProtected,
    withheld,
    reasonForRequest: masked ? '' : request.reasonForRequest,
    referredBy: masked ? null : request.referredBy,
    statusHistory: masked
      ? request.statusHistory.map((change) => ({ ...change, reason: null }))
      : request.statusHistory,
    assignments: masked
      ? request.assignments.map((assignment) => ({ ...assignment, reason: null }))
      : request.assignments,
    assessment:
      request.assessment === null || !caseStudyWithheld
        ? request.assessment
        : { ...request.assessment, findings: null, recommendationReason: null },
    requirements: request.requirements.map((requirement) => ({
      ...requirement,
      remarks: masked ? null : requirement.remarks,
      applicabilityReason: masked ? null : requirement.applicabilityReason,
      document:
        requirement.document === null
          ? null
          : {
              ...requirement.document,
              versions: requirement.document.versions.map((version) => ({
                ...version,
                documentNumber: fullNumbers
                  ? version.documentNumber
                  : maskDocumentNumber(version.documentNumber),
                documentNumberMasked: !fullNumbers && version.documentNumber !== null,
                supersededReason: masked ? null : version.supersededReason,
              })),
            },
    })),
  };
}
