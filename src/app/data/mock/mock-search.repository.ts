import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  ASSISTANCE_STATUS_CATALOG,
  CASE_STATUS_CATALOG,
  HITS_PER_GROUP,
  PROGRAM_STATUS_CATALOG,
  SEARCH_ENTITY_LABELS,
  SEARCH_ENTITY_ORDER,
  SEARCH_ENTITY_PERMISSIONS,
  barangayName,
  discloseResident,
  isSearchable,
  isWithinBarangayScope,
  matchesTerm,
  userHasPermission,
  type AuthenticatedUser,
  type Permission,
  type Resident,
  type SearchEntityType,
  type SearchGroup,
  type SearchHit,
  type SearchRepository,
  type SearchResults,
} from '@domain/index';

import { MockCaseStore } from './mock-case.store';
import { MockFamilyStore } from './mock-family.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';

/**
 * The search adapter.
 *
 * **It reads only what it may show** (`DL-109`). Every producer below matches
 * on names, reference numbers, barangay and status — the same fields that end
 * up on the result row. Nothing here opens a case note, an assessment, a set of
 * remarks or a reason for a request, because matching on free text discloses
 * its contents even when no snippet is rendered: type a condition, get back one
 * resident, and the office has said what is in that person's file.
 *
 * Three further rules:
 *
 *  - **Per-type permission.** A group is searched only if the account may see
 *    that record type at all, and the types that were skipped are **reported**
 *    rather than silently dropped — "no cases matched" and "you cannot see
 *    cases" are different answers.
 *  - **Scope.** Barangay scope is applied per producer, through the resident
 *    where the record does not carry one itself.
 *  - **Disclosure.** A resident's name comes from `discloseResident`, so a
 *    protection case's name is withheld here exactly as it is on their profile
 *    (`DL-38`). Search cannot show what the registry would not.
 */
@Injectable()
export class MockSearchRepository implements SearchRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly residents = inject(MockResidentStore);
  private readonly cases = inject(MockCaseStore);
  private readonly families = inject(MockFamilyStore);

  search(term: string): Observable<SearchResults> {
    const user = this.access.currentUser();
    const trimmed = term.trim();

    if (!isSearchable(trimmed)) {
      return this.latency.respond({
        term: trimmed,
        groups: [],
        total: 0,
        withheldTypes: [],
      });
    }

    const withheldTypes: SearchEntityType[] = [];
    const groups: SearchGroup[] = [];

    for (const type of SEARCH_ENTITY_ORDER) {
      if (!userHasPermission(user, SEARCH_ENTITY_PERMISSIONS[type])) {
        withheldTypes.push(type);
        continue;
      }
      const hits = this.hitsFor(type, trimmed, user);
      if (hits.length > 0) {
        groups.push(this.toGroup(type, hits, trimmed));
      }
    }

    return this.latency.respond({
      term: trimmed,
      groups,
      total: groups.reduce((sum, group) => sum + group.total, 0),
      withheldTypes,
    });
  }

  private toGroup(
    type: SearchEntityType,
    hits: readonly SearchHit[],
    term: string,
  ): SearchGroup {
    const shown = hits.slice(0, HITS_PER_GROUP);
    return {
      type,
      label: SEARCH_ENTITY_LABELS[type],
      hits: shown,
      total: hits.length,
      isTruncated: hits.length > shown.length,
      seeAllLink: SEE_ALL_LINKS[type],
      seeAllParams: { search: term },
    };
  }

  private hitsFor(
    type: SearchEntityType,
    term: string,
    user: AuthenticatedUser | null,
  ): readonly SearchHit[] {
    switch (type) {
      case 'resident':
        return this.residentHits(term, user);
      case 'household':
        return this.householdHits(term, user);
      case 'family':
        return this.familyHits(term, user);
      case 'case':
        return this.caseHits(term, user);
      case 'assistance-request':
        return this.requestHits(term, user);
      case 'program':
        return this.programHits(term);
    }
  }

  private residentHits(term: string, user: AuthenticatedUser | null): readonly SearchHit[] {
    return this.residents
      .all()
      .filter((resident) => isWithinBarangayScope(user, resident.address.barangayId))
      .flatMap((resident) => {
        // Disclosed first, then matched: a name this account may not read is a
        // name it may not search on either.
        const view = this.disclose(resident, user);
        if (!matchesTerm(view.listedName, term)) {
          return [];
        }
        return [
          {
            key: `resident:${resident.id}`,
            type: 'resident' as const,
            title: view.listedName,
            reference: null,
            barangayLabel: barangayName(resident.address.barangayId),
            statusLabel: resident.isActive ? 'Active' : 'Inactive',
            routerLink: ['/residents', resident.id],
          },
        ];
      });
  }

  private householdHits(term: string, user: AuthenticatedUser | null): readonly SearchHit[] {
    return this.residents
      .allHouseholds()
      .filter((household) => isWithinBarangayScope(user, household.address.barangayId))
      .filter((household) => matchesTerm(household.referenceNumber, term))
      .map((household) => ({
        key: `household:${household.id}`,
        type: 'household' as const,
        title: household.referenceNumber,
        reference: null,
        barangayLabel: barangayName(household.address.barangayId),
        statusLabel: null,
        routerLink: ['/households', household.id],
      }));
  }

  private familyHits(term: string, user: AuthenticatedUser | null): readonly SearchHit[] {
    return this.families
      .allFamilies()
      .filter(
        (family) => matchesTerm(family.name, term) || matchesTerm(family.referenceNumber, term),
      )
      .flatMap((family) => {
        // A family has no barangay of its own, so scope comes from wherever its
        // members live: if none of them are visible, neither is the family.
        const visible = this.residents
          .all()
          .some(
            (resident) =>
              resident.householdId !== null &&
              isWithinBarangayScope(user, resident.address.barangayId),
          );
        if (!visible) {
          return [];
        }
        return [
          {
            key: `family:${family.id}`,
            type: 'family' as const,
            title: family.name,
            reference: family.referenceNumber,
            barangayLabel: null,
            statusLabel: null,
            routerLink: ['/families', family.id],
          },
        ];
      });
  }

  private caseHits(term: string, user: AuthenticatedUser | null): readonly SearchHit[] {
    return this.cases
      .allCases()
      .filter((record) => isWithinBarangayScope(user, record.barangayId))
      .filter(
        (record) =>
          user?.scope !== 'assigned-cases' ||
          record.assignedTo === null ||
          record.assignedTo === user.id,
      )
      .flatMap((record) => {
        const subject = this.residents.find(record.subjectResidentId);
        const subjectName =
          subject === undefined ? null : this.disclose(subject, user).listedName;
        // Reference or the subject's disclosed name. Never the case notes.
        if (!matchesTerm(record.referenceNumber, term) && !matchesTerm(subjectName, term)) {
          return [];
        }
        return [
          {
            key: `case:${record.id}`,
            type: 'case' as const,
            title: subjectName ?? record.referenceNumber,
            reference: record.referenceNumber,
            barangayLabel: barangayName(record.barangayId),
            statusLabel: CASE_STATUS_CATALOG[record.status].label,
            routerLink: ['/cases', record.id],
          },
        ];
      });
  }

  private requestHits(term: string, user: AuthenticatedUser | null): readonly SearchHit[] {
    return MOCK_ASSISTANCE_REQUESTS.filter((request) =>
      isWithinBarangayScope(user, request.barangayId),
    ).flatMap((request) => {
      const resident = this.residents.find(request.residentId);
      const residentName =
        resident === undefined ? null : this.disclose(resident, user).listedName;
      // The control number or the applicant's disclosed name. Never
      // `reasonForRequest`, which is a sentence somebody wrote about a family.
      if (!matchesTerm(request.referenceNumber, term) && !matchesTerm(residentName, term)) {
        return [];
      }
      return [
        {
          key: `assistance-request:${request.id}`,
          type: 'assistance-request' as const,
          title: residentName ?? request.referenceNumber,
          reference: request.referenceNumber,
          barangayLabel: barangayName(request.barangayId),
          statusLabel: ASSISTANCE_STATUS_CATALOG[request.status].label,
          routerLink: ['/assistance-requests', request.id],
        },
      ];
    });
  }

  private programHits(term: string): readonly SearchHit[] {
    // Programmes are office reference data — no resident, so no scope.
    return MOCK_PROGRAMS.filter(
      (program) => matchesTerm(program.name, term) || matchesTerm(program.code, term),
    ).map((program) => ({
      key: `program:${program.id}`,
      type: 'program' as const,
      title: program.name,
      reference: program.code,
      barangayLabel: null,
      statusLabel: PROGRAM_STATUS_CATALOG[program.status].label,
      routerLink: ['/programs', program.id],
    }));
  }

  /** The registry's own disclosure rules, so search cannot show what a profile would not. */
  private disclose(resident: Resident, user: AuthenticatedUser | null) {
    return discloseResident(resident, (permission: Permission) =>
      userHasPermission(user, permission),
    );
  }
}

/** Where "see all" goes, carrying the term into that list's own search filter. */
const SEE_ALL_LINKS: Readonly<Record<SearchEntityType, readonly string[]>> = {
  resident: ['/residents'],
  household: ['/households'],
  family: ['/families'],
  case: ['/cases'],
  'assistance-request': ['/assistance-requests'],
  program: ['/programs'],
};
