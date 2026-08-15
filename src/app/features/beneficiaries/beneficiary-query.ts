import {
  BENEFICIARY_ROLES,
  DEFAULT_PAGE_SIZE,
  TAYTAY_BARANGAYS,
  asIsoDate,
  type BarangayId,
  type BeneficiaryFilter,
  type BeneficiaryRole,
  type BeneficiarySortField,
  type PageRequest,
  type ProgramId,
  type SortDirection,
} from '@domain/index';

/**
 * The URL is the filter (`DL-36`), exactly as on the resident registry.
 *
 * Malformed parameters degrade to *no filter* rather than throwing or guessing.
 * That matters more here than on most screens: a date this parser silently
 * misread would produce a shorter history, and a shorter history reads as "this
 * family has had less help than they have".
 */
export interface BeneficiaryQuery {
  readonly filter: BeneficiaryFilter;
  readonly page: PageRequest<BeneficiarySortField>;
}

export interface ParamReader {
  get(name: string): string | null;
}

const SORT_FIELDS: readonly BeneficiarySortField[] = [
  'name',
  'barangay',
  'lastAssistanceAt',
  'totalReleased',
  'assistanceEventCount',
];

export const DEFAULT_BENEFICIARY_SORT = { field: 'name', direction: 'asc' } as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readDate(params: ParamReader, name: string): string | null {
  const value = params.get(name)?.trim();
  if (!value || !ISO_DATE.test(value)) {
    return null;
  }
  // A shape that parses but is not a real day — 2026-02-31 — is discarded too.
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(value) ? null : value;
}

export function readBeneficiaryFilter(params: ParamReader): BeneficiaryFilter {
  const filter: {
    search?: string;
    barangayId?: BarangayId;
    programId?: ProgramId;
    role?: BeneficiaryRole;
    receivedFrom?: ReturnType<typeof asIsoDate>;
    receivedTo?: ReturnType<typeof asIsoDate>;
    withOpenDuplicateReview?: boolean;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }

  const barangay = params.get('barangay');
  if (barangay && TAYTAY_BARANGAYS.some((candidate) => candidate.id === barangay)) {
    filter.barangayId = barangay as BarangayId;
  }

  // Not validated against the catalog: programmes are data and the list is
  // loaded asynchronously, so an unknown id simply matches nothing rather than
  // being silently dropped and showing everyone.
  const programId = params.get('programme')?.trim();
  if (programId) {
    filter.programId = programId as ProgramId;
  }

  const role = params.get('standing');
  if (role && (BENEFICIARY_ROLES as readonly string[]).includes(role)) {
    filter.role = role as BeneficiaryRole;
  }

  const from = readDate(params, 'from');
  if (from) {
    filter.receivedFrom = asIsoDate(from);
  }

  const to = readDate(params, 'to');
  if (to) {
    filter.receivedTo = asIsoDate(to);
  }

  if (params.get('duplicates') === 'true') {
    filter.withOpenDuplicateReview = true;
  }

  return filter;
}

export function readBeneficiaryPage(params: ParamReader): PageRequest<BeneficiarySortField> {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  const sortParam = params.get('sort');
  const directionParam = params.get('direction');

  const field: BeneficiarySortField =
    sortParam && (SORT_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as BeneficiarySortField)
      : DEFAULT_BENEFICIARY_SORT.field;
  const direction: SortDirection = directionParam === 'desc' ? 'desc' : 'asc';

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: { field, direction },
  };
}

export function readBeneficiaryQuery(params: ParamReader): BeneficiaryQuery {
  return { filter: readBeneficiaryFilter(params), page: readBeneficiaryPage(params) };
}

/**
 * The filter as bare query params — what a saved view stores. Page and sort are
 * excluded: "recipients in Dolores this year" is a population, not a scroll
 * position.
 */
export function beneficiaryFilterParams(filter: BeneficiaryFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.search) {
    params['q'] = filter.search;
  }
  if (filter.barangayId) {
    params['barangay'] = filter.barangayId;
  }
  if (filter.programId) {
    params['programme'] = filter.programId;
  }
  if (filter.role) {
    params['standing'] = filter.role;
  }
  if (filter.receivedFrom) {
    params['from'] = filter.receivedFrom;
  }
  if (filter.receivedTo) {
    params['to'] = filter.receivedTo;
  }
  if (filter.withOpenDuplicateReview) {
    params['duplicates'] = 'true';
  }
  return params;
}
