import { describe, expect, it } from 'vitest';

import OPENAPI from '../contract/openapi.json';
import CODE_LOCKED from './code-locked.json';
import ME_ADMIN from './me-admin.json';
import ME_RESIDENT from './me-resident.json';
import ME_STAFF from './me-staff.json';
import NOTIFICATION_READ from './notification-read.json';
import NOTIFICATIONS_PAGE_1 from './notifications-page-1.json';
import NOTIFICATIONS_PAGE_2 from './notifications-page-2.json';
import NOTIFICATIONS_READ_ALL from './notifications-read-all.json';
import RATE_LIMITED from './rate-limited.json';
import SIGNED_OUT from './signed-out.json';
import VALIDATION_FAILED from './validation-failed.json';
import VERIFICATION_APPROVED from './verification-approved.json';
import VERIFICATION_REJECTED from './verification-rejected.json';
import VERIFICATION_REQUESTS_PAGE from './verification-requests-page.json';
import OFFICES_PAGE from './offices-page.json';
import THREAD from './thread.json';
import THREAD_MESSAGES_PAGE from './thread-messages-page.json';
import THREAD_REPLY from './thread-reply.json';
import THREADS_PAGE from './threads-page.json';
import USER_OFFICE_ASSIGNED from './user-office-assigned.json';
import USER_OFFICE_ROLE_CHANGED from './user-office-role-changed.json';
import USER_ROLE_CHANGED from './user-role-changed.json';
import USERS_PAGE from './users-page.json';
import OFFICE_RESIDENT from './office-resident.json';
import OFFICE_RESIDENTS_PAGE from './office-residents-page.json';
import OFFICE_HOUSEHOLD from './office-household.json';
import OFFICE_HOUSEHOLD_CONFLICT from './office-household-conflict.json';
import OFFICE_HOUSEHOLDS_PAGE from './office-households-page.json';
import OFFICE_FAMILIES_PAGE from './office-families-page.json';
import OFFICE_FAMILY from './office-family.json';
import OFFICE_FAMILY_CONFLICT from './office-family-conflict.json';
import OFFICE_RELATIONSHIP from './office-relationship.json';
import OFFICE_RELATIONSHIP_HISTORY from './office-relationship-history.json';
import OFFICE_RESIDENT_FAMILIES from './office-resident-families.json';
import SAVED_VIEW from './saved-view.json';
import SAVED_VIEWS from './saved-views.json';
import DELETED from './deleted.json';
import HOTLINE from './hotline.json';
import HOTLINES from './hotlines.json';
import OFFICE from './office.json';
import SERVICE from './service.json';
import SERVICES_PAGE from './services-page.json';
import BANNER from './banner.json';
import BANNERS from './banners.json';
import HOME from './home.json';
import LINK from './link.json';
import LINKS from './links.json';
import MEDIA from './media.json';
import APP_CONFIG from './app-config.json';
import DIGITAL_ID_CARD from './digital-id-card.json';
import DIGITAL_ID_HOLDER from './digital-id-holder.json';
import NEWS from './news.json';
import NEWS_PAGE from './news-page.json';
import NEWS_CATEGORIES from './news-categories.json';
import AUDIT_PAGE from './audit-page.json';

/**
 * **These fixtures are composed, not recorded** — and this file is why that is acceptable.
 *
 * The Laravel fixtures they replace were captured with `curl` from a running server. Nothing on
 * this machine runs the Node API (it needs PostgreSQL and a Firebase project), so these were written
 * from the vendored spec instead. A hand-written fixture drifts toward what its author expected,
 * which is the objection TAB 05 raised; the answer here is that every one is held to the schema in
 * `contract/openapi.json` below — every required field present, no field the schema does not
 * declare, every enum value one the API can send. Re-vendoring the spec re-checks all of them.
 *
 * The data is fictional: `example.invalid` addresses and invented identifiers.
 */

const SPEC: unknown = OPENAPI;

function at(value: unknown, ...path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    current =
      current !== null && typeof current === 'object' ? Reflect.get(current, key) : undefined;
  }
  return current;
}

function resolve(schema: unknown): unknown {
  const ref = at(schema, '$ref');
  return typeof ref === 'string'
    ? resolve(at(SPEC, ...ref.replace(/^#\//, '').split('/')))
    : schema;
}

function typesOf(schema: unknown): readonly string[] {
  const type = at(schema, 'type');
  if (typeof type === 'string') return [type];
  return Array.isArray(type) ? type.filter((t): t is string => typeof t === 'string') : [];
}

function kindOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

/**
 * `allOf` is one object written in parts (`VerificationRequestStaff` is the citizen view plus
 * `notes`, `DL-167`): its properties and required fields are the union of the parts'. Checked
 * part by part instead, each closed part would refuse the other's fields; skipped, as it was before
 * this existed, a fixture against it was checked against nothing at all.
 */
function flatten(raw: unknown): unknown {
  const schema = resolve(raw);
  const parts = at(schema, 'allOf');
  if (!Array.isArray(parts)) {
    return schema;
  }
  const flat = parts.map(flatten);
  const properties: Record<string, unknown> = {};
  const required = new Set<string>();
  for (const part of flat) {
    const own = at(part, 'properties');
    if (own !== null && typeof own === 'object') Object.assign(properties, own);
    const needs = at(part, 'required');
    for (const key of Array.isArray(needs) ? needs : []) {
      if (typeof key === 'string') required.add(key);
    }
  }
  return { type: 'object', properties, required: [...required] };
}

/** What is wrong with `value` against `schema`, as sentences. Empty when it conforms. */
function problems(value: unknown, raw: unknown, where: string): readonly string[] {
  const schema = flatten(raw);
  // `oneOf` is read as `anyOf` — one branch must fit. The Node spec writes a nullable reference that
  // way (`office_role`, `scope`, `DL-173`), and skipping it would wave through any value at all.
  const anyOf = at(schema, 'anyOf') ?? at(schema, 'oneOf');

  if (Array.isArray(anyOf)) {
    return anyOf.some((branch) => problems(value, branch, where).length === 0)
      ? []
      : [`${where} matches none of its alternatives`];
  }

  const types = typesOf(schema);
  const kind = kindOf(value);

  if (
    types.length > 0 &&
    !types.includes(kind) &&
    !(kind === 'integer' && types.includes('number'))
  ) {
    return [`${where} is ${kind}, the schema says ${types.join(' | ')}`];
  }

  const allowed = at(schema, 'enum');
  if (Array.isArray(allowed) && !allowed.includes(value)) {
    return [`${where} is ${JSON.stringify(value)}, which the schema does not list`];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      problems(item, at(schema, 'items'), `${where}[${index}]`),
    );
  }

  if (value === null || typeof value !== 'object') {
    return [];
  }

  const found: string[] = [];
  const properties = at(schema, 'properties');
  const additional = at(schema, 'additionalProperties');
  const required = at(schema, 'required');

  for (const key of Array.isArray(required) ? required : []) {
    if (typeof key === 'string' && !(key in value)) found.push(`${where}.${key} is required`);
  }

  for (const [key, child] of Object.entries(value)) {
    const declared = at(properties, key);
    if (declared !== undefined) {
      found.push(...problems(child, declared, `${where}.${key}`));
    } else if (additional !== undefined && additional !== false) {
      found.push(...problems(child, additional, `${where}.${key}`));
    } else if (properties !== undefined) {
      found.push(`${where}.${key} is not declared by the schema`);
    }
  }

  return found;
}

const schema = (name: string): unknown => at(SPEC, 'components', 'schemas', name);

describe('the Node fixtures, held to the vendored spec', () => {
  it.each([
    ['me-staff', ME_STAFF, 'UserProfileEnvelope'],
    ['me-admin', ME_ADMIN, 'UserProfileEnvelope'],
    ['me-resident', ME_RESIDENT, 'UserProfileEnvelope'],
    ['notifications-page-1', NOTIFICATIONS_PAGE_1, 'NotificationListEnvelope'],
    ['notifications-page-2', NOTIFICATIONS_PAGE_2, 'NotificationListEnvelope'],
    ['notification-read', NOTIFICATION_READ, 'NotificationEnvelope'],
    ['notifications-read-all', NOTIFICATIONS_READ_ALL, 'UpdatedEnvelope'],
    ['signed-out', SIGNED_OUT, 'SignedOutEnvelope'],
    ['validation-failed', VALIDATION_FAILED, 'ErrorEnvelope'],
    ['rate-limited', RATE_LIMITED, 'ErrorEnvelope'],
    ['code-locked', CODE_LOCKED, 'ErrorEnvelope'],
    ['verification-requests-page', VERIFICATION_REQUESTS_PAGE, 'VerificationStaffListEnvelope'],
    ['verification-approved', VERIFICATION_APPROVED, 'VerificationStaffEnvelope'],
    ['verification-rejected', VERIFICATION_REJECTED, 'VerificationStaffEnvelope'],
    ['threads-page', THREADS_PAGE, 'ThreadListEnvelope'],
    ['thread', THREAD, 'ThreadEnvelope'],
    ['thread-messages-page', THREAD_MESSAGES_PAGE, 'MessageListEnvelope'],
    ['thread-reply', THREAD_REPLY, 'ThreadMessageEnvelope'],
    ['offices-page', OFFICES_PAGE, 'OfficeListEnvelope'],
    ['users-page', USERS_PAGE, 'UserListEnvelope'],
    ['office-residents-page', OFFICE_RESIDENTS_PAGE, 'OfficeResidentListEnvelope'],
    ['office-resident', OFFICE_RESIDENT, 'OfficeResidentEnvelope'],
    ['office-households-page', OFFICE_HOUSEHOLDS_PAGE, 'OfficeHouseholdListEnvelope'],
    ['office-household', OFFICE_HOUSEHOLD, 'OfficeHouseholdEnvelope'],
    ['office-household-conflict', OFFICE_HOUSEHOLD_CONFLICT, 'ErrorEnvelope'],
    ['office-families-page', OFFICE_FAMILIES_PAGE, 'OfficeFamilyListEnvelope'],
    ['office-family', OFFICE_FAMILY, 'OfficeFamilyEnvelope'],
    ['office-resident-families', OFFICE_RESIDENT_FAMILIES, 'OfficeFamilySummaryArrayEnvelope'],
    ['office-relationship', OFFICE_RELATIONSHIP, 'OfficeRelationshipEnvelope'],
    ['office-relationship-history', OFFICE_RELATIONSHIP_HISTORY, 'OfficeFamilyEventListEnvelope'],
    ['office-family-conflict', OFFICE_FAMILY_CONFLICT, 'ErrorEnvelope'],
    ['saved-views', SAVED_VIEWS, 'SavedViewListEnvelope'],
    ['saved-view', SAVED_VIEW, 'SavedViewEnvelope'],
    ['user-role-changed', USER_ROLE_CHANGED, 'UserListItemEnvelope'],
    ['user-office-assigned', USER_OFFICE_ASSIGNED, 'UserListItemEnvelope'],
    ['user-office-role-changed', USER_OFFICE_ROLE_CHANGED, 'UserListItemEnvelope'],
    ['office', OFFICE, 'OfficeEnvelope'],
    ['services-page', SERVICES_PAGE, 'ServiceListEnvelope'],
    ['service', SERVICE, 'ServiceEnvelope'],
    ['hotlines', HOTLINES, 'HotlineListEnvelope'],
    ['hotline', HOTLINE, 'HotlineEnvelope'],
    ['deleted', DELETED, 'DeletedEnvelope'],
    ['banners', BANNERS, 'BannerListEnvelope'],
    ['banner', BANNER, 'BannerEnvelope'],
    ['links', LINKS, 'LinkListEnvelope'],
    ['link', LINK, 'LinkEnvelope'],
    ['home', HOME, 'HomeEnvelope'],
    ['media', MEDIA, 'MediaEnvelope'],
    ['app-config', APP_CONFIG, 'AppConfigEnvelope'],
    ['digital-id-card', DIGITAL_ID_CARD, 'DigitalIdAdminEnvelope'],
    ['digital-id-holder', DIGITAL_ID_HOLDER, 'DigitalIdHolderEnvelope'],
    ['news', NEWS, 'NewsEnvelope'],
    ['news-page', NEWS_PAGE, 'NewsListEnvelope'],
    ['news-categories', NEWS_CATEGORIES, 'NewsCategoryListEnvelope'],
    ['audit-page', AUDIT_PAGE, 'AuditListEnvelope'],
  ] as const)('%s conforms to %s', (_name, fixture, envelope) => {
    expect(schema(envelope)).toBeDefined();
    expect(problems(fixture, schema(envelope), 'body')).toEqual([]);
  });

  it('holds a composed schema to every part of it, not to none', () => {
    const drifted = {
      ...VERIFICATION_APPROVED,
      data: { ...VERIFICATION_APPROVED.data, status: 'verified', match_score: 0.97 },
    };
    const missing = Object.fromEntries(
      Object.entries(VERIFICATION_APPROVED.data).filter(([key]) => key !== 'selfie_media_id'),
    );

    expect(problems(drifted, schema('VerificationStaffEnvelope'), 'body')).toEqual([
      'body.data.status is "verified", which the schema does not list',
      'body.data.match_score is not declared by the schema',
    ]);
    expect(
      problems({ data: missing, meta: {} }, schema('VerificationStaffEnvelope'), 'body'),
    ).toEqual(['body.data.selfie_media_id is required']);
  });

  it('catches a fixture that drifts, so a green run means something', () => {
    const drifted = {
      ...ME_STAFF,
      data: { ...ME_STAFF.data, role: 'auditor', scope: 'everywhere', data_scope: 'all-barangays' },
    };

    expect(problems(drifted, schema('UserProfileEnvelope'), 'body')).toEqual([
      'body.data.role is "auditor", which the schema does not list',
      'body.data.scope matches none of its alternatives',
      'body.data.data_scope is not declared by the schema',
    ]);
  });
});
