import {
  HOUSEHOLD_BANDS,
  TAYTAY_BARANGAYS,
  type BarangayId,
  type HouseholdBand,
  type HouseholdFilter,
} from '@domain/index';

/**
 * The URL is the filter here too (`DL-36`), so a barangay-level snapshot is a
 * link somebody can paste into an email rather than a set of clicks they have
 * to describe.
 *
 * There is no page and no sort in it: the API orders households by reference
 * number and pages by cursor, and a cursor is where a reading stopped, not an
 * address somebody could share (`DL-161`).
 */
export interface HouseholdQuery {
  readonly filter: HouseholdFilter;
}

export interface ParamReader {
  get(name: string): string | null;
}

export function readHouseholdFilter(params: ParamReader): HouseholdFilter {
  const filter: {
    search?: string;
    barangayId?: BarangayId;
    indigentOnly?: boolean;
    minimumBand?: HouseholdBand;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }

  const barangay = params.get('barangay');
  if (barangay && TAYTAY_BARANGAYS.some((candidate) => candidate.id === barangay)) {
    filter.barangayId = barangay as BarangayId;
  }

  const band = params.get('band');
  // `none` is not a filter — every household is at least `none`, so accepting
  // it would produce a control that appears to do something and does not.
  if (band && band !== 'none' && (HOUSEHOLD_BANDS as readonly string[]).includes(band)) {
    filter.minimumBand = band as HouseholdBand;
  }

  if (params.get('indigent') === 'true') {
    filter.indigentOnly = true;
  }

  return filter;
}

export function readHouseholdQuery(params: ParamReader): HouseholdQuery {
  return { filter: readHouseholdFilter(params) };
}

export function householdFilterParams(filter: HouseholdFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.search) {
    params['q'] = filter.search;
  }
  if (filter.barangayId) {
    params['barangay'] = filter.barangayId;
  }
  if (filter.minimumBand) {
    params['band'] = filter.minimumBand;
  }
  if (filter.indigentOnly) {
    params['indigent'] = 'true';
  }
  return params;
}

export function isHouseholdFilterActive(filter: HouseholdFilter): boolean {
  return (
    Boolean(filter.search) ||
    filter.barangayId !== undefined ||
    filter.minimumBand !== undefined ||
    filter.indigentOnly === true
  );
}
