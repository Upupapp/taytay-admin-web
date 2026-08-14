import type {
  AssistanceRequestStatus,
  AttentionKind,
  BarangayId,
  DashboardFilter,
  ProgramCategory,
} from '@domain/index';

export interface DrillDown {
  readonly route: string;
  readonly queryParams: Readonly<Record<string, string>>;
}

/**
 * Where each figure traces to.
 *
 * Routes live here, in the feature, rather than in the domain — the domain has
 * no business knowing this application's URLs. What it does know is the
 * *situation* (`AttentionKind`, a status, a barangay), and this module turns
 * that into a destination.
 *
 * The dashboard filter is carried into every drill-down, which is what makes
 * the acceptance rule hold: the list a metric opens is constrained exactly as
 * the metric was, so the count and the records cannot disagree.
 */
function base(filter: DashboardFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.barangayId) {
    params['barangay'] = filter.barangayId;
  }
  if (filter.category) {
    params['category'] = filter.category;
  }
  return params;
}

export function requestsDrillDown(
  filter: DashboardFilter,
  extra: Readonly<Record<string, string>> = {},
): DrillDown {
  return { route: '/assistance-requests', queryParams: { ...base(filter), ...extra } };
}

export function statusDrillDown(
  filter: DashboardFilter,
  status: AssistanceRequestStatus,
): DrillDown {
  return requestsDrillDown(filter, { status });
}

export function barangayDrillDown(filter: DashboardFilter, barangayId: BarangayId): DrillDown {
  // The row's own barangay wins over the filter's: clicking "Dolores" means
  // Dolores, even if the filter was set to something else.
  return {
    route: '/assistance-requests',
    queryParams: { ...base(filter), barangay: barangayId },
  };
}

export function categoryDrillDown(filter: DashboardFilter, category: ProgramCategory): DrillDown {
  return {
    route: '/disbursements',
    queryParams: { ...base(filter), category },
  };
}

export function disbursementsDrillDown(
  filter: DashboardFilter,
  extra: Readonly<Record<string, string>> = {},
): DrillDown {
  return { route: '/disbursements', queryParams: { ...base(filter), ...extra } };
}

/** Each attention signal opens exactly the records it counted. */
export function attentionDrillDown(kind: AttentionKind, filter: DashboardFilter): DrillDown {
  switch (kind) {
    case 'awaiting-approval':
      return statusDrillDown(filter, 'endorsed');
    case 'returned-to-applicant':
      return statusDrillDown(filter, 'returned');
    case 'missing-requirements':
      return requestsDrillDown(filter, { openOnly: 'true', missingRequirements: 'true' });
    case 'payout-due':
      return disbursementsDrillDown(filter, { status: 'scheduled' });
    case 'unclaimed-payout':
      return disbursementsDrillDown(filter, { status: 'unclaimed' });
    case 'referral-unanswered':
      return { route: '/referrals', queryParams: { ...base(filter), status: 'sent' } };
  }
}
