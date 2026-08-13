import type { AssistanceRequestStatus } from '../assistance/assistance-request';
import type { BarangayId } from '../shared/ids';
import type { Money } from '../shared/money';
import type { ProgramCategory } from '../programs/program';

export interface StatusCount {
  readonly status: AssistanceRequestStatus;
  readonly count: number;
}

export interface BarangayCount {
  readonly barangayId: BarangayId;
  readonly count: number;
}

export interface CategoryTotal {
  readonly category: ProgramCategory;
  readonly amount: Money;
  readonly count: number;
}

export interface DashboardSummary {
  readonly generatedAt: string;
  readonly openRequests: number;
  readonly awaitingApproval: number;
  readonly scheduledPayouts: number;
  readonly residentsServedThisMonth: number;
  readonly disbursedThisMonth: Money;
  readonly requestsByStatus: readonly StatusCount[];
  readonly requestsByBarangay: readonly BarangayCount[];
  readonly disbursedByCategory: readonly CategoryTotal[];
}
