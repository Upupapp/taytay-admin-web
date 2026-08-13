import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  asIsoDateTime,
  isTerminalAssistanceStatus,
  sumMoney,
  ZERO_PESOS,
  type AssistanceRequestStatus,
  type BarangayCount,
  type CategoryTotal,
  type DashboardRepository,
  type DashboardSummary,
  type ProgramCategory,
  type StatusCount,
} from '@domain/index';

import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_DISBURSEMENTS } from './seed/disbursements.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { MockLatency } from './mock-latency';

/**
 * Derives dashboard figures from the same seed the list screens use, so the
 * headline numbers and the tables can never disagree in a demo.
 */
@Injectable()
export class MockDashboardRepository implements DashboardRepository {
  private readonly latency = inject(MockLatency);

  summary(): Observable<DashboardSummary> {
    const requests = MOCK_ASSISTANCE_REQUESTS;
    const releasedDisbursements = MOCK_DISBURSEMENTS.filter(
      (disbursement) => disbursement.status === 'released' || disbursement.status === 'claimed',
    );

    const statusCounts = new Map<AssistanceRequestStatus, number>();
    const barangayCounts = new Map<string, number>();

    for (const request of requests) {
      statusCounts.set(request.status, (statusCounts.get(request.status) ?? 0) + 1);
      barangayCounts.set(request.barangayId, (barangayCounts.get(request.barangayId) ?? 0) + 1);
    }

    const requestsByStatus: StatusCount[] = [...statusCounts.entries()].map(([status, count]) => ({
      status,
      count,
    }));

    const requestsByBarangay: BarangayCount[] = [...barangayCounts.entries()].map(
      ([barangayId, count]) => ({ barangayId: barangayId as BarangayCount['barangayId'], count }),
    );

    const categoryTotals = new Map<ProgramCategory, CategoryTotal>();
    for (const disbursement of releasedDisbursements) {
      const request = requests.find((candidate) => candidate.id === disbursement.requestId);
      const program = MOCK_PROGRAMS.find((candidate) => candidate.id === request?.programId);
      if (!program) {
        continue;
      }
      const existing = categoryTotals.get(program.category);
      categoryTotals.set(program.category, {
        category: program.category,
        amount: sumMoney([existing?.amount ?? ZERO_PESOS, disbursement.amount]),
        count: (existing?.count ?? 0) + 1,
      });
    }

    const summary: DashboardSummary = {
      generatedAt: asIsoDateTime(new Date()),
      openRequests: requests.filter((request) => !isTerminalAssistanceStatus(request.status))
        .length,
      awaitingApproval: requests.filter((request) => request.status === 'endorsed').length,
      scheduledPayouts: MOCK_DISBURSEMENTS.filter(
        (disbursement) => disbursement.status === 'scheduled',
      ).length,
      residentsServedThisMonth: new Set(releasedDisbursements.map((d) => d.residentId)).size,
      disbursedThisMonth: sumMoney(releasedDisbursements.map((d) => d.amount)),
      requestsByStatus,
      requestsByBarangay,
      disbursedByCategory: [...categoryTotals.values()],
    };

    return this.latency.respond(summary);
  }
}
