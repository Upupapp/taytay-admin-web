import {
  REFERRAL_DESTINATION_LABELS,
  REFERRAL_STATUS_CATALOG,
  REFERRAL_URGENCY_LABELS,
  type ReferralDestination,
  type ReferralFilter,
  type ReferralStatus,
  type ReferralUrgency,
} from '@domain/index';

/**
 * The URL is the filter (`DL-36`), as on every other list here.
 *
 * The vocabularies are validated against the domain catalogs rather than
 * against literal lists, so a status added to the catalog is filterable
 * immediately and one removed stops being accepted — without this file being
 * remembered.
 */
/**
 * What the URL says about the list: its filters. Not a page number and not a sort — the API pages by
 * cursor, newest drafted first, and sends no total (`DL-161`, `DL-181`).
 */
export interface ReferralQuery {
  readonly filter: ReferralFilter;
}

export interface ParamReader {
  get(name: string): string | null;
}

export function readReferralFilter(params: ParamReader): ReferralFilter {
  const filter: {
    search?: string;
    status?: ReferralStatus;
    destination?: ReferralDestination;
    urgency?: ReferralUrgency;
    overdueOnly?: boolean;
    openOnly?: boolean;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }

  const status = params.get('status');
  if (status && status in REFERRAL_STATUS_CATALOG) {
    filter.status = status as ReferralStatus;
  }

  const destination = params.get('destination');
  if (destination && destination in REFERRAL_DESTINATION_LABELS) {
    filter.destination = destination as ReferralDestination;
  }

  const urgency = params.get('urgency');
  if (urgency && urgency in REFERRAL_URGENCY_LABELS) {
    filter.urgency = urgency as ReferralUrgency;
  }

  if (params.get('overdue') === 'true') {
    filter.overdueOnly = true;
  }
  if (params.get('open') === 'true') {
    filter.openOnly = true;
  }

  return filter;
}

export function readReferralQuery(params: ParamReader): ReferralQuery {
  return { filter: readReferralFilter(params) };
}
