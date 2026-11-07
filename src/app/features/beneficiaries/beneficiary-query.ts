import {
  BENEFICIARY_ROLES,
  TAYTAY_BARANGAYS,
  asIsoDate,
  type BarangayId,
  type BeneficiaryFilter,
  type BeneficiaryRole,
  type ProgramId,
} from '@domain/index';

/**
 * The URL is the filter (`DL-36`), exactly as on the resident registry.
 *
 * Malformed parameters degrade to *no filter* rather than throwing or guessing.
 * That matters more here than on most screens: a date this parser silently
 * misread would produce a shorter history, and a shorter history reads as "this
 * family has had less help than they have".
 *
 * There is no page and no sort in it: the list follows a cursor from its first
 * page, in the registry's own order (`DL-161`, `DL-187`).
 */
export interface BeneficiaryQuery {
  readonly filter: BeneficiaryFilter;
}

export interface ParamReader {
  get(name: string): string | null;
}

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

export function readBeneficiaryQuery(params: ParamReader): BeneficiaryQuery {
  return { filter: readBeneficiaryFilter(params) };
}

/**
 * The filter as bare query params — what a saved view stores: "recipients in
 * Dolores this year" is a population, not a scroll position.
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
