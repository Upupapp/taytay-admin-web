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

import type { ResidentDraft, ReleaseBatchDraft, VisitOutcomeDraft } from '@domain/index';

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
