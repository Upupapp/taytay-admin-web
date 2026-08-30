/**
 * Outbound mappers: domain drafts into the shapes this API actually validates.
 *
 * ## Why these are written out by hand
 *
 * `CLAUDE.md` forbids a generic recursive case-converter, *"which cannot tell a field name from a
 * key inside a free-text note"*. That rule is usually stated about reads, and the write side needs
 * it more: the difference between what this console holds and what the API accepts is **not
 * casing**. `ReleaseBatchDraft` has a `title` and a `venue`; the API validates `name` and
 * `location`. `ResidentDraft` nests `name`, `address` and `contact`; the API wants `first_name`,
 * `barangay_id` and `mobile_number` flat. No converter could infer either.
 *
 * ## The rule these follow
 *
 * **Send what the endpoint validates, and nothing else** — and name in a comment every domain field
 * that has no counterpart, with the reason.
 *
 * Laravel ignores unknown keys rather than rejecting them, so an extra field is not an error. It is
 * worse than an error: the request succeeds, the value is discarded, and the office believes it was
 * recorded. A field silently dropped by an outbound mapper is indistinguishable from a field
 * nobody filled in.
 *
 * ## Written against the handler, not the document
 *
 * The first draft of this file mapped three payloads from what the domain types and the mapping
 * notes implied, and **all three were wrong** — inventing a `followUpOn` the visit draft does not
 * have, a `basis` the disclosure plan does not have, and a send body the API does not accept. Every
 * shape here was read off the controller's `validate()` call.
 */

import type {
  AssessmentDraft,
  DocumentVersionDraft,
  EventDraft,
  FieldVisitDraft,
  SavedViewDraft,
  PostDraft,
  ReferralDraft,
  ReleaseBatchDraft,
  ResidentDraft,
  VisitOutcomeDraft,
} from '@domain/index';

/**
 * A payout session: a name, a date, a venue (`DL-90`).
 *
 * **`releaseIds` is not sent**, and that is the API's shape rather than an omission: members are
 * added through `POST admin/release-batches/{batch}/releases` afterwards, so each release joins the
 * session as its own recorded act. A batch that arrived with its membership baked in would make
 * "when did this family get scheduled" unanswerable.
 *
 * **`notes` has no counterpart** and is dropped. Recorded as a gap rather than sent hopefully: the
 * endpoint would accept the key and discard it, which reads to the office as saved.
 *
 * `status` and `opened_by` are set by the server — the session opens as `open`, and who opened it
 * is the authenticated actor rather than anything a client may assert.
 */
export function toWireReleaseBatch(draft: ReleaseBatchDraft): {
  name: string;
  scheduled_for: string;
  location: string;
} {
  return {
    name: draft.title,
    scheduled_for: draft.scheduledFor,
    location: draft.venue,
  };
}

/**
 * The end of a home visit.
 *
 * **Observations are not sent here.** They are appended through
 * `POST admin/visits/{visit}/observations` as they are recorded, because a `VisitObservation`
 * carries whose claim each line is (`DL-85`), and batching them into a closing payload would invite
 * a screen to compose them after the fact — which is exactly when a worker stops reclassifying what
 * they have already written as one paragraph.
 *
 * `next_action` and `follow_up_on` are accepted by the endpoint and this draft carries neither, so
 * neither is sent. They are not invented here: a follow-up date this console never asked anybody
 * for would appear on the record as though somebody had chosen it.
 */
export function toWireVisitOutcome(outcome: VisitOutcomeDraft): {
  status: string;
  outcome: string;
  service_needs: string | null;
  declined_reason: string | null;
} {
  return {
    status: outcome.status,
    outcome: outcome.outcome,
    service_needs: outcome.serviceNeeds,
    declined_reason: outcome.declinedReason,
  };
}

/**
 * A resident, flattened.
 *
 * This console nests `name`, `address` and `contact`; the API validates twelve **flat** fields.
 * That is the clearest case in the codebase for why a generic case-converter could not have done
 * this job, and why every mapper here is written out.
 *
 * ## The barangay travels as a code, not as a key
 *
 * `BarangayId` in this application is already the backend's `barangays.code` — `brgy-san-juan` on
 * both sides — and until now the write endpoints accepted only the auto-increment `barangay_id`,
 * which this console has never held and Article 4 keeps out of payloads anyway. The API now takes
 * either (L-15), so the identifier a response hands over is the one a request may hand back.
 *
 * ## What is deliberately not sent
 *
 * `sectors` is dropped **because it belongs elsewhere**, not because nothing accepts it. Each
 * sector rests on something somebody checked — a Senior Citizen ID, a PWD card — and the server
 * takes it as its own act with a reason, through `ResidentRepository.recordSector`. The form
 * records them after the resident exists and reports any the server refused (`DL-87`).
 *
 * `philsysLastFour`, `monthlyIncome` and `householdId` have **no counterpart at all**, and are
 * dropped rather than serialised hopefully — Laravel ignores unknown keys, so sending them would
 * succeed and discard them, which reads to an intake officer as the office losing what they typed.
 *
 * The first two are the sensitive tier (`DL-38`), and where they belong is settled doctrine rather
 * than an oversight: income is means-testing evidence and belongs to the assistance workflow;
 * PhilSys digits belong to KYC. Neither is a field to widen this payload with.
 */
export function toWireResidentDraft(draft: ResidentDraft): {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  sex: string;
  birth_date: string;
  civil_status: string;
  barangay_code: string;
  street_address: string | null;
  purok_or_sitio: string | null;
  mobile_number: string | null;
  email: string | null;
} {
  return {
    first_name: draft.name.first,
    middle_name: draft.name.middle,
    last_name: draft.name.last,
    suffix: draft.name.suffix,
    sex: draft.sex,
    birth_date: draft.birthDate,
    civil_status: draft.civilStatus,
    barangay_code: draft.address.barangayId,
    street_address: draft.address.streetAddress,
    purok_or_sitio: draft.address.purokOrSitio,
    // The API names this `mobile_number`; the domain calls it `mobile`. Neither is wrong and they
    // are not the same word, which is the entire failure mode this file exists for.
    mobile_number: draft.contact.mobile,
    email: draft.contact.email,
  };
}

/**
 * A referral out of the office.
 *
 * The one draft in this file whose shape nearly matches the endpoint, so what is worth recording is
 * the two fields that do **not** travel.
 *
 * **`followUpOn` has no counterpart on create.** The endpoint takes it on the PATCH instead, which
 * is where `reschedule` sends it. Dropped rather than sent hopefully.
 *
 * **`requestId` has no counterpart either.** The API links a referral to a `case_id` and knows
 * nothing about the assistance request behind it, which is the same case/request distinction
 * `DL-52` draws — one is the office's continuing involvement, the other one intervention inside it.
 */
export function toWireReferralDraft(draft: ReferralDraft): {
  resident_id: string;
  case_id: string | null;
  provider_id: string | null;
  destination_name: string;
  destination_type: string;
  destination_contact: string | null;
  urgency: string;
  service_requested: string;
  reason: string;
} {
  return {
    resident_id: draft.residentId,
    case_id: draft.caseId,
    provider_id: draft.providerId,
    destination_name: draft.destinationName,
    // The console's `destination` is the KIND of organisation; the API calls it the type.
    destination_type: draft.destination,
    destination_contact: draft.destinationContact,
    urgency: draft.urgency,
    service_requested: draft.serviceRequested,
    reason: draft.reason,
  };
}

/**
 * A newsfeed post, on create or update.
 *
 * ## Three fields that are not part of this payload, and none of them by accident
 *
 * **`image`** is uploaded to `POST admin/newsfeed/{post}/media` after the post exists — publication
 * is the only route to a public object (ADR 0033 §3), and the server re-encodes a rendition rather
 * than moving the upload. A URL in this payload would be asking the server to trust a client's link.
 *
 * **`scheduledFor`** travels on the status transition, not here. Scheduling is a lifecycle move
 * with a target state, and putting a date in the draft would let a post acquire a publish time
 * without ever passing through the transition that checks it is in the future.
 *
 * **`linkUrl`** has no counterpart at all. Recorded as a gap rather than serialised.
 *
 * ## Audience
 *
 * `all-residents` is the API's `municipality`; a targeted post is `barangay` plus one id. The
 * console models a **list** of barangays and the API takes one, so a post aimed at several is
 * currently unrepresentable — recorded here rather than silently sending the first, which would
 * publish to one barangay while the composer showed three.
 */
export function toWirePostDraft(draft: PostDraft): {
  headline: string | null;
  body: string;
  category: string;
  audience: 'municipality' | 'barangay';
  comments_enabled: boolean;
} {
  return {
    headline: draft.headline,
    body: draft.body,
    category: draft.category,
    audience: draft.audience.scope === 'all-residents' ? 'municipality' : 'barangay',
    comments_enabled: draft.commentsEnabled,
  };
}

/**
 * An event, with its venue, contact and registration policy flattened.
 *
 * Three nested value objects become fourteen flat fields. `EventVenue.barangayId` and
 * `PostDraft`'s audience list share the same problem — the console holds a barangay identifier the
 * event endpoint has no field for — so it is dropped rather than guessed at.
 *
 * **`reminders` has no counterpart**, and neither does the image: a cover is referenced by
 * `cover_file_id`, an identifier produced by an upload this draft has not performed. Sending a URL
 * where the server expects a file id would fail validation, and sending nothing is honest.
 *
 * `startsAt` and `endsAt` are required by the endpoint and nullable here, because the composer lets
 * somebody save a half-written event. The caller checks before submitting; this mapper does not
 * invent a date, because an event with a made-up start time is worse than one that fails to save.
 */
export function toWireEventDraft(draft: EventDraft): {
  title: string;
  summary: string;
  description: string;
  category: string;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string;
  venue_address: string;
  map_url: string | null;
  contact_office: string | null;
  contact_person: string | null;
  contact_number: string | null;
  registration_required: boolean;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  capacity: number | null;
  waitlist_enabled: boolean;
} {
  return {
    title: draft.title,
    summary: draft.summary,
    // The console calls the long text `details`; the API calls it the description.
    description: draft.details,
    category: draft.category,
    starts_at: draft.startsAt,
    ends_at: draft.endsAt,
    venue_name: draft.venue.name,
    venue_address: draft.venue.address,
    map_url: draft.venue.mapUrl,
    contact_office: draft.contact.office,
    contact_person: draft.contact.name,
    contact_number: draft.contact.phone,
    registration_required: draft.registration.isRequired,
    registration_opens_at: draft.registration.opensAt,
    registration_closes_at: draft.registration.closesAt,
    capacity: draft.registration.capacity,
    waitlist_enabled: draft.registration.waitlistEnabled,
  };
}

/**
 * A saved list view.
 *
 * `params` is a flat record of the URL's filter state and lands in `filters` whole. The endpoint
 * also takes `columns` and `sort`, which this console does not model separately — a saved view here
 * is the filter state and nothing else — so neither is sent rather than being split out of `params`
 * by guessing which keys are which.
 *
 * `isShared` matters more than its size suggests (`DL-111`): a personal view is a preference, and a
 * shared one is office configuration whose **name** describes a population to every colleague and
 * outlives whoever wrote it.
 */
export function toWireSavedViewDraft(draft: SavedViewDraft): {
  entity: string;
  name: string;
  filters: Readonly<Record<string, string>>;
  is_shared: boolean;
} {
  return {
    entity: draft.resource,
    name: draft.name,
    filters: draft.params,
    is_shared: draft.isShared,
  };
}

/**
 * A scheduled home visit.
 *
 * The checklist travels as `[{ code }]` — the endpoint takes the items at creation, and each is
 * later ticked one at a time through `POST admin/visits/{visit}/checklist`.
 *
 * **No coordinate, no check-in, no route** (`DL-86`). `addressVisited` is the address the office
 * already holds, written down; there is nothing here a tracking product would recognise, and this
 * mapper is one of the places that would quietly become one if a field were added without thought.
 */
export function toWireFieldVisitDraft(draft: FieldVisitDraft): {
  resident_id: string;
  case_id: string | null;
  household_id: string | null;
  purpose: string;
  assigned_to: string;
  scheduled_for: string;
  scheduled_window: string | null;
  address_visited: string;
  checklist: readonly { code: string }[];
} {
  return {
    resident_id: draft.residentId,
    case_id: draft.caseId,
    household_id: draft.householdId,
    purpose: draft.purpose,
    assigned_to: draft.assignedTo,
    scheduled_for: draft.scheduledFor,
    scheduled_window: draft.scheduledWindow,
    address_visited: draft.addressVisited,
    checklist: draft.checklist.map((item) => ({ code: item.code })),
  };
}

/**
 * A document version, as multipart form fields.
 *
 * Everything here is a **string**, because these travel beside a file in a `FormData` body rather
 * than as JSON. That is why the mapper returns `Record<string, string>` and not a typed shape: a
 * multipart field has no other type.
 *
 * **Absent keys are omitted, never sent empty.** `document_number` missing and `document_number`
 * blank are different claims about a piece of paper, and the server stores what it is given — a
 * blank string would record that somebody looked and found no number, where the truth is that
 * nobody was asked.
 *
 * The file itself is not here. `FileTransport` appends it under `file`, which is the name the
 * endpoint reads.
 */
export function toWireDocumentVersion(draft: DocumentVersionDraft): Record<string, string> {
  const fields: Record<string, string> = { source: draft.source };

  if (draft.documentNumber !== null) fields['document_number'] = draft.documentNumber;
  if (draft.issuedOn !== null) fields['issued_on'] = draft.issuedOn;
  if (draft.expiresOn !== null) fields['expires_on'] = draft.expiresOn;
  if (draft.replacesBecause !== null) fields['replaces_because'] = draft.replacesBecause;

  return fields;
}

/*
 * ── `IntakeDraft` has no mapper here, deliberately ──────────────────────────────────────
 *
 * Two things stop it, and neither is a naming difference a mapper could absorb.
 *
 * **`category` is required by the endpoint and the draft has no field for it.** It is what decides
 * the `CaseType` — medical, educational, relief, livelihood — and an unrecognised value falls
 * through to generic assistance. The console holds a `programId`, and the category lives on the
 * *programme*, which this mapper cannot reach without a lookup. Defaulting it would classify every
 * walk-in as generic assistance: a silent misclassification of a family's situation, on the record,
 * from the first screen.
 *
 * **`channel` and `source` are different vocabularies.** The console offers `walk-in`,
 * `barangay-referral`, `encoded` and `online`; the endpoint accepts `walk-in`,
 * `barangay-referral` and `legacy-import`. Two console values have no counterpart and would be
 * refused; the third API value has no console equivalent.
 *
 * `requestedAmount`, `referredBy` and the requirement entries have no counterpart at all.
 *
 * So the intake write stays counted by `check:wire-adoption` rather than mapped. It needs a
 * decision about where the category comes from — the programme, or a field the intake form starts
 * asking for — and that is a question about what the office is recording, not about field names.
 */

/**
 * Completing an assessment: `POST admin/assistance-requests/{case}/assessment/complete`.
 *
 * ## Two of the draft's four fields have nowhere to go
 *
 * The endpoint takes `recommendation` (required), `reason` and `findings`. It has **no field**
 * for `recommendedAmount` and none for `homeVisitConducted`, so this mapper sends neither.
 * Inventing keys for them would be a 422 on every save; folding the amount into `findings` would
 * put a figure in a free-text note where no report can find it and no reviewer can trust it.
 *
 * This is `L-17`, not a gap of its own (`DL-144`). The welfare schema holds one amount column
 * anywhere — `releases.amount_centavos`, money actually handed over — so `recommendedAmount` sits
 * beside `requestedAmount` and `approvedAmount` in the single decision TAB 08 owns. And
 * `welfare_cases.needs_home_visit` is not a home for the second field: a plan is not a fact, and
 * the column is read-only in any case.
 *
 * `check:intake` requires the assessment screen to say so above the two controls **for as long as
 * this mapper drops them**, and stops requiring it the day the fields are sent.
 *
 * `reason` is omitted rather than sent empty: it is the assessor's note on *why* this
 * recommendation, and this console has never asked for one. A blank string would record that the
 * question was asked and answered with nothing.
 */
export function toWireAssessment(draft: AssessmentDraft): Record<string, unknown> {
  const fields: Record<string, unknown> = { recommendation: draft.recommendation };

  const findings = draft.findings.trim();
  if (findings !== '') fields['findings'] = findings;

  return fields;
}
