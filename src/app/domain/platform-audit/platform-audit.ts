import type { IsoDateTime, PlatformAuditEntryId } from '../shared/ids';

/**
 * One row of the Node API's audit trail (`DL-171`), read from `GET admin/audit` at `2736e28`
 * (`src/modules/audit`).
 *
 * **Who, what, which record, when — and nothing else.** The API stores no old value, no new value,
 * no reason and no detail, and this model has no field that could hold one (`DL-114`: a row says
 * what changed, never what it changed to). The actor and the record are **ids as the API gives
 * them**: nothing is looked up beside a row, so the trail discloses no name, email or record content
 * to the person reading it.
 *
 * **Not the governance audit trail** (`AuditRow`), which is a separate read (`office/audit`,
 * `DL-191`): the casework and staff-account rows said in words, beside which what this API does not
 * record — field names, values, reasons — is said not to be recorded.
 */
export interface PlatformAuditEntry {
  readonly id: PlatformAuditEntryId;
  /** The account that acted, or `null` when the API recorded none. */
  readonly actorId: string | null;
  /** The API's dotted code, as given — `user.role_changed`. */
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string | null;
  readonly at: IsoDateTime;
}

/**
 * Every action the API records at `2fd0566`, in words. Read from the backend's
 * `audit.record(...)` calls; a code not here is shown as given and said to have no description in
 * this console, never dropped or guessed at.
 */
export const PLATFORM_AUDIT_ACTIONS: Readonly<Record<string, string>> = {
  'account.closed': 'A resident closed their own account',
  'app.config_updated': 'Changed the app’s settings',
  'banner.created': 'Added a home screen banner',
  'banner.deleted': 'Deleted a home screen banner',
  'banner.updated': 'Changed a home screen banner',
  'digital_id.issued': 'Issued a digital ID',
  'digital_id.reissued': 'Replaced a digital ID with a new one',
  'digital_id.revoked': 'Revoked a digital ID',
  'digital_id.scanned': 'Checked a resident’s digital ID',
  'digital_id.suspended': 'Suspended a digital ID',
  'hotline.created': 'Added a hotline',
  'hotline.deleted': 'Deleted a hotline',
  'hotline.updated': 'Changed a hotline',
  // Residents' document requests (`DL-184`), read from `taytay-backend` `2fd0566`: the catalogue's
  // three acts, and each act on a request — who did what to which request, never what it said.
  'issuance_type.created': 'Added a document to an office’s catalogue, with a reason',
  'issuance_type.updated': 'Changed a document in an office’s catalogue, with a reason',
  'issuance_type.retired':
    'Retired a document from an office’s catalogue, with a reason; it is kept',
  'issuance_request.submitted': 'A resident requested a document from an office',
  'issuance_request.resubmitted': 'A resident sent what the office asked for on a document request',
  'issuance_request.cancelled': 'A resident cancelled their document request',
  'issuance_request.under_review': 'Started reviewing a resident’s document request',
  'issuance_request.needs_info': 'Asked a resident for more on a document request',
  'issuance_request.approved': 'Approved a resident’s document request',
  'issuance_request.rejected': 'Refused a resident’s document request, with a reason',
  'issuance_request.ready_for_pickup':
    'Marked a requested document ready to claim, with when and where',
  'issuance_request.released': 'Recorded a requested document as handed to the resident',
  'issuance_request.attachment_access_granted':
    'Was given a single-use grant to open a file sent with a document request',
  'issuance_request.attachment_opened': 'Opened a file sent with a document request',
  'link.created': 'Added a home screen link',
  'link.deleted': 'Deleted a home screen link',
  'link.updated': 'Changed a home screen link',
  'news.created': 'Wrote a Balita article',
  'news.pinned': 'Pinned a Balita article',
  'news.unpinned': 'Unpinned a Balita article',
  'news.updated': 'Changed a Balita article',
  'office.created': 'Added an office to the directory',
  'office.deleted': 'Deleted an office from the directory',
  'office.updated': 'Changed an office in the directory',
  'office_family.formed': 'Recorded a family with the office',
  'office_family.role_changed': 'Changed a member’s role in a family',
  'office_family.transferred': 'Moved a resident between families',
  'office_household.correction_withdrawn': 'Withdrew a correction of a household’s indicator',
  'office_household.factor_corrected': 'Corrected a household’s vulnerability indicator',
  'office_household.membership_changed': 'Changed who lives in a household',
  'office_household.registered': 'Registered a household with the office',
  // Casework phase 3 (`DL-179`): each case event is also an audit row — who did what to which case,
  // never what it said.
  'office_case.opened': 'Opened a case on a person, with a reason',
  'office_case.status_changed': 'Moved a case on, with a reason',
  'office_case.assigned': 'Assigned a case to a social worker, with a reason',
  'office_case.unassigned': 'Took a case off a social worker’s caseload, with a reason',
  'office_case.note_added': 'Added a note to a case’s running record',
  'office_case.task_added': 'Added a task to a case, with a reason',
  'office_case.task_completed': 'Completed a task on a case, with its outcome',
  'office_case.task_reassigned': 'Handed a task on a case to somebody else, with a reason',
  'office_case.task_rescheduled': 'Moved a task’s due date on a case, with a reason',
  'office_case.task_cancelled': 'Cancelled a task on a case, with a reason; the task is kept',
  'office_case.request_linked': 'Named an assistance request as part of a case, with a reason',
  'office_case.request_unlinked':
    'Ended an assistance request’s link to a case, with a reason; the link stays in its history',
  'office_duplicate_pair.detection_run':
    'Ran a search for possible duplicate records; each pair found waits for a person',
  'office_identity_finding.recorded':
    'Recorded whether two records are one person, with a reason; nothing was merged',
  'office_referral.drafted': 'Drafted a referral to another office; nothing was disclosed',
  'office_referral.basis_recorded': 'Recorded the lawful basis for a referral, with its reason',
  'office_referral.field_shared':
    'Chose one more field for a referral to carry, with the need for it',
  'office_referral.sent': 'Sent a referral to another office, under its recorded basis',
  'office_referral.status_changed': 'Moved a referral on, with a reason',
  'office_referral.outcome_recorded': 'Recorded what the receiving office did with a referral',
  'office_referral.follow_up_moved': 'Moved the date to chase a referral, with a reason',
  'office_referral.note_added': 'Added a note between offices to a referral',
  'office_referral.summary_composed': 'Composed a referral summary sheet, to print or send',
  'office_release.prepared': 'Prepared a release for an approved request — an amount or the goods',
  'office_release.scheduled': 'Scheduled a release into a payout session',
  'office_release.released': 'Recorded a release as handed over',
  'office_release.self_released':
    'Handed over a release for a request the same person approved — recorded, not refused',
  'office_release.acknowledged': 'Recorded how a beneficiary acknowledged a release',
  'office_release.deferred': 'Recorded that the office could not release when the beneficiary came',
  'office_release.status_changed': 'Moved a release on, with a reason',
  'office_release_batch.opened': 'Opened a payout session with the releases planned for it',
  'office_release_batch.manifest_composed': 'Composed the payout list for a session, to print',
  'office_report.exported': 'Exported a report as a file, its conditions written inside it',
  'office_report.person_level_read': 'Opened the report that names residents',
  'office_report.person_level_exported': 'Exported the report that names residents, as a file',
  // Events (DL-192): each reason is kept beside the act, in office_event_acts.
  'office_event.created': 'Created an event as a draft',
  'office_event.updated': 'Edited a draft event',
  // DL-195: a published event is corrected, never silently edited.
  'office_event.corrected':
    'Corrected a published event before it started, with a reason; its earlier details are kept, and anybody holding a place was told if its date, time, venue or who may register changed',
  'office_event.published': 'Published an event to the residents’ app, with a reason',
  'office_event.cancelled':
    'Cancelled an event, with a reason; everybody holding a place was told in the residents’ app',
  'office_event.completed': 'Completed an event, declaring its attendance final, with a reason',
  'office_event.archived': 'Archived an event, with a reason',
  'office_event.registration_moved':
    'Moved a resident’s registration for an event, with a reason; the resident was told in the app',
  'office_event.attendance_marked': 'Recorded whether a registrant came to an event',
  'office_event.registrants_exported':
    'Exported an event’s registrant list as a file, its handling notice inside it',
  // Governance (DL-191): opening what the trail recorded about one entry is itself recorded.
  'office_audit.detail_read': 'Opened what the trail records about one entry',
  'office_program.created': 'Recorded a programme in the office catalogue',
  'office_program.updated': 'Changed a programme in the office catalogue',
  'office_request.draft_created': 'Began an intake for an assistance request',
  'office_request.draft_updated': 'Changed an unfinished intake',
  'office_request.filed': 'Filed an assistance request and issued its control number',
  'office_request.note_added': 'Added a note to an assistance request',
  'office_request.status_changed': 'Moved an assistance request on, with a reason',
  'office_request.assigned': 'Assigned an assistance request to a social worker, with a reason',
  'office_request.assessment_opened': 'Opened an assessment form on an assistance request',
  'office_request.assessment_answered': 'Answered questions on an assessment form',
  'office_request.assessment_completed':
    'Completed a case study, with findings and a recommendation — which decides nothing',
  'office_request.requirement_reviewed': 'Reviewed a document presented for an assistance request',
  'office_request.requirement_ruled': 'Ruled whether a conditional document applies, with a reason',
  'office_request.document_recorded':
    'Recorded a document for an assistance request — a replaced version is kept',
  'office_request.document_access_granted': 'Was given a single-use grant to open a document',
  'office_request.document_opened': 'Opened a document presented for an assistance request',
  'office_request.document_requested': 'Recorded that an applicant was asked to bring a document',
  'office_request.document_request_withdrawn':
    'Withdrew a request for a document, with a reason — the request is kept',
  'office_requirement_template.created': 'Recorded a requirement template for the catalogue',
  'office_requirement_template.retired': 'Retired a requirement template from the catalogue',
  'office_requirement_template.updated': 'Changed a requirement template in the catalogue',
  'office_relationship.ended': 'Ended a relationship between two residents',
  'office_relationship.recorded': 'Recorded a relationship between two residents',
  'office_resident.created': 'Recorded a resident in the office registry',
  'office_resident.deactivated': 'Retired a resident’s registry record',
  'office_resident.reactivated': 'Restored a resident’s registry record',
  'office_resident.sector_ended': 'Ended a resident’s sector membership',
  'office_resident.sector_recorded': 'Recorded a resident’s sector membership',
  'office_resident.updated': 'Changed a resident’s registry record',
  'office_visit.scheduled': 'Scheduled a home visit',
  'office_visit.observation_recorded': 'Recorded what was found on a home visit',
  'office_visit.checklist_item_set': 'Ticked or cleared a line of a home visit’s checklist',
  'office_visit.closed': 'Closed a home visit with its outcome',
  'password.reset_completed': 'Reset their password',
  'saved_view.created': 'Saved a view of a list',
  'saved_view.removed': 'Took away a saved view of a list',
  'service.created': 'Added a Tulong page',
  'service.deleted': 'Deleted a Tulong page',
  'service.updated': 'Changed a Tulong page',
  'session.revoked': 'Signed out everywhere',
  'thread.closed': 'Closed a conversation with a resident',
  'user.office_assigned': 'Changed a staff account’s office',
  'user.office_role_changed': 'Changed a staff account’s office role',
  'user.name_corrected':
    'Corrected a verified account’s name after seeing an ID that shows it; the earlier name is kept',
  'user.role_changed': 'Changed an account’s role',
  // Governance (DL-191): the reason is kept beside the act, in account_status_changes.
  'user.deactivated':
    'Switched a staff account off, with a reason; its session stops at its next request',
  'user.reactivated': 'Switched a staff account back on, with a reason',
  // No account acts here, so the row has no actor: the command run on the server did it (DL-188).
  'user.role_granted_by_bootstrap_command':
    'Made an account an administrator, by the bootstrap command run on the server',
  'verification.approved': 'Approved a resident’s ID verification',
  'verification.rejected': 'Rejected a resident’s ID verification',
};

/** The action in words, or `null` when this console has none for the code. */
export function describeAuditAction(code: string): string | null {
  return Object.hasOwn(PLATFORM_AUDIT_ACTIONS, code)
    ? (PLATFORM_AUDIT_ACTIONS[code] ?? null)
    : null;
}

/** What a row of this trail does not hold, said on the screen once rather than implied. */
export const PLATFORM_AUDIT_LIMITS: readonly string[] = [
  'A row says who acted, what they did, to which record and when. The API keeps no earlier or later value, and no reason.',
  'People and records are shown by their IDs, as the API records them. Nothing is looked up about them here.',
  'A change to the app’s settings is recorded without saying which setting.',
];
