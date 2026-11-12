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
import VERIFICATION_SUPERSEDED from './verification-superseded.json';
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
import OFFICE_PROGRAM from './office-program.json';
import OFFICE_PROGRAM_REFUSAL from './office-program-refusal.json';
import OFFICE_PROGRAM_TEMPLATES from './office-program-templates.json';
import OFFICE_PROGRAMS_PAGE from './office-programs-page.json';
import OFFICE_REQUEST from './office-request.json';
import OFFICE_REQUEST_ADVISORY from './office-request-advisory.json';
import OFFICE_REQUEST_NOTES from './office-request-notes.json';
import OFFICE_REQUEST_REFUSAL from './office-request-refusal.json';
import OFFICE_REQUESTS_PAGE from './office-requests-page.json';
import OFFICE_REQUEST_CASEWORK from './office-request-casework.json';
import OFFICE_DOCUMENT_REQUESTS from './office-document-requests.json';
import OFFICE_ASSESSMENT_TEMPLATES from './office-assessment-templates.json';
import OFFICE_OPEN_ASSESSMENT from './office-open-assessment.json';
import OFFICE_SOCIAL_WORKERS from './office-social-workers.json';
import OFFICE_CASES_PAGE from './office-cases-page.json';
import OFFICE_CASE from './office-case.json';
import OFFICE_CASE_CASELOAD from './office-case-caseload.json';
import OFFICE_CASE_CLOSED_REFUSAL from './office-case-closed-refusal.json';
import OFFICE_CASE_QUEUE_COUNTS from './office-case-queue-counts.json';
import OFFICE_CASE_ASSIGNEES from './office-case-assignees.json';
import OFFICE_RELEASES_PAGE from './office-releases-page.json';
import OFFICE_RELEASE from './office-release.json';
import OFFICE_RELEASE_BATCHES from './office-release-batches.json';
import OFFICE_RELEASE_MANIFEST from './office-release-manifest.json';
import OFFICE_RELEASE_INTENT_REFUSAL from './office-release-intent-refusal.json';
import OFFICE_REFERRALS_PAGE from './office-referrals-page.json';
import OFFICE_REFERRAL from './office-referral.json';
import OFFICE_REFERRAL_SUMMARY from './office-referral-summary.json';
import OFFICE_REFERRAL_NO_BASIS_REFUSAL from './office-referral-no-basis-refusal.json';
import OFFICE_SERVICE_PROVIDERS from './office-service-providers.json';
import OFFICE_VISITS_PAGE from './office-visits-page.json';
import OFFICE_VISIT from './office-visit.json';
import OFFICE_DASHBOARD from './office-dashboard.json';
import OFFICE_DASHBOARD_INTAKE from './office-dashboard-intake.json';
import OFFICE_BENEFICIARIES_PAGE from './office-beneficiaries-page.json';
import OFFICE_BENEFICIARY from './office-beneficiary.json';
import OFFICE_DUPLICATE_PAIRS_PAGE from './office-duplicate-pairs-page.json';
import OFFICE_IDENTITY_FINDING from './office-identity-finding.json';
import OFFICE_IDENTITY_PREVIEW from './office-identity-preview.json';
import OFFICE_ASSISTANCE_HISTORY from './office-assistance-history.json';
import OFFICE_ASSISTANCE_HISTORY_WITHHELD from './office-assistance-history-withheld.json';
import OFFICE_PROGRAM_UTILIZATION from './office-program-utilization.json';
import OFFICE_PROGRAM_UTILIZATION_WITHHELD from './office-program-utilization-withheld.json';
import OFFICE_SEARCH_RESULTS from './office-search-results.json';
import OFFICE_SEARCH_RESULTS_CASELOAD from './office-search-results-caseload.json';
import OFFICE_WORK_MINE from './office-work-mine.json';
import OFFICE_WORK_TEAM from './office-work-team.json';
import OFFICE_WORK_ALERTS from './office-work-alerts.json';
import OFFICE_REPORTS from './office-reports.json';
import OFFICE_STAFF from './office-staff.json';
import OFFICE_STAFF_SWITCHED from './office-staff-switched.json';
import OFFICE_AUDIT_PAGE from './office-audit-page.json';
import OFFICE_AUDIT_DETAIL from './office-audit-detail.json';
import OFFICE_CLASSIFICATIONS from './office-governance-classifications.json';
import OFFICE_RETENTION from './office-governance-retention.json';
import OFFICE_CORRECTIONS from './office-governance-corrections.json';
import OFFICE_EVENTS from './office-events.json';
import OFFICE_EVENT from './office-event.json';
import OFFICE_EVENT_CAPACITY from './office-event-capacity.json';
import OFFICE_EVENT_METRICS from './office-event-metrics.json';
import OFFICE_EVENT_REGISTRANTS from './office-event-registrants.json';
import OFFICE_EVENT_REGISTRANT from './office-event-registrant.json';
import OFFICE_EVENT_EXPORT from './office-event-export.json';
import OFFICE_EVENT_HISTORY from './office-event-history.json';
import OFFICE_REPORT_COMPLETENESS from './office-report-data-completeness.json';
import OFFICE_REPORT_EXPORT from './office-report-export.json';
import OFFICE_REPORT_PROGRAMS from './office-report-program-utilisation.json';
import OFFICE_REPORT_VULNERABILITY from './office-report-vulnerability-indicators.json';
import OFFICE_DOCUMENT_GRANT from './office-document-grant.json';
import ISSUANCE_TYPES from './issuance-types.json';
import OFFICE_ISSUANCE_TYPE_RETIRED from './office-issuance-type-retired.json';
import OFFICE_ISSUANCE_REQUESTS_PAGE from './office-issuance-requests-page.json';
import OFFICE_ISSUANCE_REQUEST from './office-issuance-request.json';
import ISSUANCE_FILE_GRANT from './issuance-file-grant.json';
import OFFICE_REQUIREMENT_TEMPLATE from './office-requirement-template.json';
import OFFICE_REQUIREMENT_TEMPLATE_REFUSAL from './office-requirement-template-refusal.json';
import OFFICE_REQUIREMENT_TEMPLATES from './office-requirement-templates.json';
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
    ['verification-superseded', VERIFICATION_SUPERSEDED, 'VerificationStaffEnvelope'],
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
    ['office-programs-page', OFFICE_PROGRAMS_PAGE, 'OfficeProgramListEnvelope'],
    ['office-program', OFFICE_PROGRAM, 'OfficeProgramEnvelope'],
    ['office-program-templates', OFFICE_PROGRAM_TEMPLATES, 'OfficeRequirementTemplateListEnvelope'],
    ['office-program-refusal', OFFICE_PROGRAM_REFUSAL, 'ErrorEnvelope'],
    [
      'office-requirement-templates',
      OFFICE_REQUIREMENT_TEMPLATES,
      'OfficeRequirementTemplateCatalogEnvelope',
    ],
    [
      'office-requirement-template',
      OFFICE_REQUIREMENT_TEMPLATE,
      'OfficeRequirementTemplateEnvelope',
    ],
    ['office-requirement-template-refusal', OFFICE_REQUIREMENT_TEMPLATE_REFUSAL, 'ErrorEnvelope'],
    ['office-requests-page', OFFICE_REQUESTS_PAGE, 'OfficeRequestListEnvelope'],
    ['office-request', OFFICE_REQUEST, 'OfficeRequestEnvelope'],
    ['office-request-advisory', OFFICE_REQUEST_ADVISORY, 'OfficeRequestAdvisoryEnvelope'],
    ['office-request-notes', OFFICE_REQUEST_NOTES, 'OfficeRequestNoteListEnvelope'],
    ['office-request-refusal', OFFICE_REQUEST_REFUSAL, 'OfficeRequestRefusalEnvelope'],
    ['office-request-casework', OFFICE_REQUEST_CASEWORK, 'OfficeRequestEnvelope'],
    ['office-document-requests', OFFICE_DOCUMENT_REQUESTS, 'OfficeDocumentRequestListEnvelope'],
    [
      'office-assessment-templates',
      OFFICE_ASSESSMENT_TEMPLATES,
      'OfficeAssessmentTemplateListEnvelope',
    ],
    ['office-open-assessment', OFFICE_OPEN_ASSESSMENT, 'OfficeOpenAssessmentEnvelope'],
    ['office-social-workers', OFFICE_SOCIAL_WORKERS, 'OfficeSocialWorkerListEnvelope'],
    ['office-document-grant', OFFICE_DOCUMENT_GRANT, 'OfficeDocumentGrantEnvelope'],
    ['issuance-types', ISSUANCE_TYPES, 'IssuanceTypeListEnvelope'],
    ['office-issuance-type-retired', OFFICE_ISSUANCE_TYPE_RETIRED, 'IssuanceTypeEnvelope'],
    [
      'office-issuance-requests-page',
      OFFICE_ISSUANCE_REQUESTS_PAGE,
      'OfficeIssuanceRequestListEnvelope',
    ],
    ['office-issuance-request', OFFICE_ISSUANCE_REQUEST, 'OfficeIssuanceRequestEnvelope'],
    ['issuance-file-grant', ISSUANCE_FILE_GRANT, 'IssuanceFileGrantEnvelope'],
    ['office-cases-page', OFFICE_CASES_PAGE, 'OfficeCaseListEnvelope'],
    ['office-case', OFFICE_CASE, 'OfficeCaseEnvelope'],
    ['office-case-caseload', OFFICE_CASE_CASELOAD, 'OfficeCaseEnvelope'],
    ['office-case-closed-refusal', OFFICE_CASE_CLOSED_REFUSAL, 'ErrorEnvelope'],
    ['office-case-queue-counts', OFFICE_CASE_QUEUE_COUNTS, 'OfficeCaseQueueCountListEnvelope'],
    ['office-case-assignees', OFFICE_CASE_ASSIGNEES, 'OfficeCaseAssigneeListEnvelope'],
    ['office-releases-page', OFFICE_RELEASES_PAGE, 'OfficeReleaseListEnvelope'],
    ['office-release', OFFICE_RELEASE, 'OfficeReleaseEnvelope'],
    ['office-release-batches', OFFICE_RELEASE_BATCHES, 'OfficeReleaseBatchListEnvelope'],
    ['office-release-manifest', OFFICE_RELEASE_MANIFEST, 'OfficeReleaseManifestEnvelope'],
    ['office-release-intent-refusal', OFFICE_RELEASE_INTENT_REFUSAL, 'ErrorEnvelope'],
    ['office-referrals-page', OFFICE_REFERRALS_PAGE, 'OfficeReferralListEnvelope'],
    ['office-referral', OFFICE_REFERRAL, 'OfficeReferralEnvelope'],
    ['office-referral-summary', OFFICE_REFERRAL_SUMMARY, 'OfficeReferralSummaryEnvelope'],
    ['office-referral-no-basis-refusal', OFFICE_REFERRAL_NO_BASIS_REFUSAL, 'ErrorEnvelope'],
    ['office-service-providers', OFFICE_SERVICE_PROVIDERS, 'OfficeServiceProviderListEnvelope'],
    ['office-visits-page', OFFICE_VISITS_PAGE, 'OfficeVisitListEnvelope'],
    ['office-visit', OFFICE_VISIT, 'OfficeVisitEnvelope'],
    ['office-dashboard', OFFICE_DASHBOARD, 'OfficeDashboardEnvelope'],
    ['office-dashboard-intake', OFFICE_DASHBOARD_INTAKE, 'OfficeDashboardEnvelope'],
    ['office-beneficiaries-page', OFFICE_BENEFICIARIES_PAGE, 'OfficeBeneficiaryListEnvelope'],
    ['office-beneficiary', OFFICE_BENEFICIARY, 'OfficeBeneficiaryEnvelope'],
    [
      'office-duplicate-pairs-page',
      OFFICE_DUPLICATE_PAIRS_PAGE,
      'OfficeDuplicateCandidateListEnvelope',
    ],
    ['office-identity-finding', OFFICE_IDENTITY_FINDING, 'OfficeIdentityFindingEnvelope'],
    ['office-identity-preview', OFFICE_IDENTITY_PREVIEW, 'OfficeIdentityPreviewEnvelope'],
    [
      'office-assistance-history',
      OFFICE_ASSISTANCE_HISTORY,
      'OfficeAssistanceHistoryReadingEnvelope',
    ],
    [
      'office-assistance-history-withheld',
      OFFICE_ASSISTANCE_HISTORY_WITHHELD,
      'OfficeAssistanceHistoryReadingEnvelope',
    ],
    [
      'office-program-utilization',
      OFFICE_PROGRAM_UTILIZATION,
      'OfficeProgramUtilizationListEnvelope',
    ],
    [
      'office-program-utilization-withheld',
      OFFICE_PROGRAM_UTILIZATION_WITHHELD,
      'OfficeProgramUtilizationListEnvelope',
    ],
    ['office-search-results', OFFICE_SEARCH_RESULTS, 'OfficeSearchResultsEnvelope'],
    [
      'office-search-results-caseload',
      OFFICE_SEARCH_RESULTS_CASELOAD,
      'OfficeSearchResultsEnvelope',
    ],
    ['office-work-mine', OFFICE_WORK_MINE, 'OfficeWorkQueueEnvelope'],
    ['office-work-team', OFFICE_WORK_TEAM, 'OfficeTeamWorkEnvelope'],
    ['office-work-alerts', OFFICE_WORK_ALERTS, 'OfficeAlertListEnvelope'],
    ['office-reports', OFFICE_REPORTS, 'OfficeReportDefinitionListEnvelope'],
    [
      'office-report-vulnerability-indicators',
      OFFICE_REPORT_VULNERABILITY,
      'OfficeReportResultEnvelope',
    ],
    ['office-report-program-utilisation', OFFICE_REPORT_PROGRAMS, 'OfficeReportResultEnvelope'],
    ['office-report-data-completeness', OFFICE_REPORT_COMPLETENESS, 'OfficeReportResultEnvelope'],
    ['office-report-export', OFFICE_REPORT_EXPORT, 'OfficeReportExportEnvelope'],
    ['office-staff', OFFICE_STAFF, 'OfficeStaffAccountListEnvelope'],
    ['office-staff-switched', OFFICE_STAFF_SWITCHED, 'OfficeStaffAccountEnvelope'],
    ['office-audit-page', OFFICE_AUDIT_PAGE, 'OfficeAuditEntryPage'],
    ['office-audit-detail', OFFICE_AUDIT_DETAIL, 'OfficeAuditEntryDetailEnvelope'],
    [
      'office-governance-classifications',
      OFFICE_CLASSIFICATIONS,
      'OfficeClassifiedRecordTypeListEnvelope',
    ],
    ['office-governance-retention', OFFICE_RETENTION, 'OfficeRetentionRuleListEnvelope'],
    ['office-governance-corrections', OFFICE_CORRECTIONS, 'OfficeCorrectionRequestListEnvelope'],
    ['office-events', OFFICE_EVENTS, 'OfficeEventListEnvelope'],
    ['office-event', OFFICE_EVENT, 'OfficeEventEnvelope'],
    ['office-event-capacity', OFFICE_EVENT_CAPACITY, 'OfficeEventCapacityEnvelope'],
    ['office-event-metrics', OFFICE_EVENT_METRICS, 'OfficeEventMetricsEnvelope'],
    ['office-event-registrants', OFFICE_EVENT_REGISTRANTS, 'OfficeEventRegistrantListEnvelope'],
    ['office-event-registrant', OFFICE_EVENT_REGISTRANT, 'OfficeEventRegistrantEnvelope'],
    ['office-event-export', OFFICE_EVENT_EXPORT, 'OfficeEventRegistrantExportEnvelope'],
    ['office-event-history', OFFICE_EVENT_HISTORY, 'OfficeEventHistoryListEnvelope'],
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
