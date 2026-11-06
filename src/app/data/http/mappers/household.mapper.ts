import {
  ACTIVE_POVERTY_THRESHOLD,
  centavos,
  describeHouseholdEvent,
  FACTOR_CLASSES,
  HOUSEHOLD_BANDS,
  HOUSEHOLD_EVENT_KINDS,
  HOUSEHOLD_ROLES,
  HouseholdCompositionError,
  householdEventAction,
  VULNERABILITY_FACTOR_CODES,
  type AuditEntry,
  type AuditEntryId,
  type FactorBasis,
  type FactorClass,
  type FactorCorrection,
  type FactorState,
  type HouseholdDetail,
  type HouseholdDraft,
  type HouseholdId,
  type HouseholdMemberView,
  type HouseholdProblem,
  type HouseholdProblemCode,
  type HouseholdRecord,
  type HouseholdRole,
  type HouseholdSummary,
  type HouseholdWithheldField,
  type MembershipChange,
  type ResidentId,
  type StaffUserId,
  type VulnerabilityFactor,
  type VulnerabilityFactorCode,
  type VulnerabilitySnapshot,
} from '@domain/index';

import { toResidentView, type BarangayIndex } from './resident.mapper';
import { dateTime, field, flag, id, int, oneOf, str } from './wire';

/**
 * The office household register on the wire (`OfficeHouseholdSummary`, `OfficeHouseholdDetail`).
 *
 * | wire                                  | domain                              | if absent or unknown              |
 * | ------------------------------------- | ----------------------------------- | --------------------------------- |
 * | `household.id`, `reference_number`    | `household.id`, `referenceNumber`   | the record is not readable        |
 * | `household.barangay_id`               | `household.address.barangayId`      | the record is not readable        |
 * | `household.purok_or_sitio`, `street_address` | `household.address`          | none recorded, or withheld        |
 * | `household.head_resident_id`          | `household.headResidentId`          | the record is not readable        |
 * | `household.monthly_income_centavos`   | `household.monthlyIncome`           | none recorded, or withheld        |
 * | `household.is_indigent`, `is_protected` | `isIndigent`, `isProtected`       | the record is not readable        |
 * | `household.withheld`                  | `withheld`                          | a field it cannot name: not readable |
 * | `household.created_*`, `updated_*`    | `household.audit`                   | the record is not readable        |
 * | `head` (a list row)                   | `headName`                          | `null`: no head on file           |
 * | `member_count`, `band`, `present_factor_count` | the same                   | the row is not readable           |
 * | `members[]` (a record)                | `members`, `household.members`      | one unreadable: the record is not |
 * | `snapshot`                            | `snapshot`                          | anything unreadable: the record is not |
 * | `events[]`                            | `audit`, newest first               | one unreadable: the record is not |
 *
 * **The server has already redacted the household** (`DL-38`) — its address for a reader not
 * cleared for a protected member, its income for one not cleared for means, the indicators that
 * read them, and the trail lines about those indicators. This mapper applies no rule of its own; it
 * says what the server said, and `withheld` names what was held back so a screen never shows a
 * blank that reads as "not recorded".
 *
 * **The snapshot is read exactly or not at all.** Every factor the console knows must arrive once,
 * its class must be the console's, and the poverty threshold it was compared against must be the
 * one this console cites on screen: a band explained by a rule or a figure other than the one that
 * produced it is an explanation nobody can check (`DL-42`, `DL-46`). Money arrives as integer
 * centavos and stays integer centavos.
 *
 * **The trail is worded where the mock words it** (`describeHouseholdEvent`), so one act reads the
 * same against either adapter. The reason stays the person's own words, beside the summary.
 *
 * **Not read**: a member's `since` — the console has no field for when somebody joined, and the
 * trail already says it.
 *
 * @consumes GET office/households
 */
export function toHouseholdSummary(
  wire: unknown,
  barangays: BarangayIndex,
): HouseholdSummary | null {
  const record = readHousehold(field(wire, 'household'), barangays);
  const head = readHead(field(wire, 'head'), barangays);
  const memberCount = int(field(wire, 'member_count'));
  const band = oneOf(field(wire, 'band'), HOUSEHOLD_BANDS);
  const presentFactorCount = int(field(wire, 'present_factor_count'));

  if (
    record === null ||
    head === null ||
    memberCount === null ||
    band === null ||
    presentFactorCount === null
  ) {
    return null;
  }

  return {
    household: record.household,
    withheld: record.withheld,
    isProtected: record.isProtected,
    headName: head === NO_HEAD ? NO_HEAD_NAME : head.listedName,
    memberCount,
    band,
    presentFactorCount,
  };
}

/**
 * A household, everyone in it, its indicators and its trail.
 *
 * @consumes GET office/households/{id}
 * @consumes POST office/households
 * @consumes POST office/households/{id}/membership
 * @consumes POST office/households/{id}/corrections
 * @consumes POST office/households/{id}/corrections/{code}/withdraw
 */
export function toHouseholdDetail(wire: unknown, barangays: BarangayIndex): HouseholdDetail | null {
  const record = readHousehold(field(wire, 'household'), barangays);
  const members = readMembers(field(wire, 'members'), barangays);
  const snapshot = readSnapshot(field(wire, 'snapshot'));
  const events = readEvents(field(wire, 'events'));

  if (record === null || members === null || snapshot === null || events === null) {
    return null;
  }

  const householdId = record.household.id;
  // Placed in the household they were read from: the resident record itself does not say.
  const placed = members.map((member) => ({
    ...member,
    view: { ...member.view, resident: { ...member.view.resident, householdId } },
  }));

  return {
    household: {
      ...record.household,
      members: placed.map((member) => ({ residentId: member.view.resident.id, role: member.role })),
    },
    withheld: record.withheld,
    isProtected: record.isProtected,
    members: placed,
    snapshot,
    audit: events.map((event) => ({ ...event, entityType: 'household', entityId: householdId })),
  };
}

/* ── the household itself ──────────────────────────────────────────────────── */

interface ReadHousehold {
  readonly household: HouseholdRecord;
  readonly withheld: readonly HouseholdWithheldField[];
  readonly isProtected: boolean;
}

function readHousehold(value: unknown, barangays: BarangayIndex): ReadHousehold | null {
  const householdId = id<HouseholdId>(field(value, 'id'));
  const referenceNumber = str(field(value, 'reference_number'));
  const barangayId = barangays.toConsole(str(field(value, 'barangay_id')));
  const headResidentId = id<ResidentId>(field(value, 'head_resident_id'));
  const isIndigent = flag(field(value, 'is_indigent'));
  const isProtected = flag(field(value, 'is_protected'));
  const withheld = toWithheld(field(value, 'withheld'));
  const createdAt = dateTime(field(value, 'created_at'));
  const updatedAt = dateTime(field(value, 'updated_at'));

  if (
    householdId === null ||
    referenceNumber === null ||
    barangayId === null ||
    headResidentId === null ||
    isIndigent === null ||
    isProtected === null ||
    withheld === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  const income = int(field(value, 'monthly_income_centavos'));

  return {
    household: {
      id: householdId,
      referenceNumber,
      headResidentId,
      address: {
        barangayId,
        purokOrSitio: str(field(value, 'purok_or_sitio')),
        streetAddress: str(field(value, 'street_address')),
      },
      monthlyIncome: income === null ? null : centavos(income),
      isIndigent,
      audit: {
        createdAt,
        createdBy: id<StaffUserId>(field(value, 'created_by')),
        updatedAt,
        updatedBy: id<StaffUserId>(field(value, 'updated_by')),
      },
    },
    withheld,
    isProtected,
  };
}

const WITHHELD: Readonly<Record<string, HouseholdWithheldField>> = {
  exact_address: 'exactAddress',
  monthly_income: 'monthlyIncome',
};

/** What the server held back, or `null` when it names something this console cannot say. */
function toWithheld(value: unknown): HouseholdWithheldField[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const fields = value.map((entry) => {
    const name = str(entry);
    return name !== null && Object.hasOwn(WITHHELD, name) ? (WITHHELD[name] ?? null) : null;
  });
  return fields.every((entry): entry is HouseholdWithheldField => entry !== null) ? fields : null;
}

/** Said in the list when the API sends no head — never an empty cell that reads as a name withheld. */
const NO_HEAD_NAME = 'No head recorded';
const NO_HEAD = 'none';

function readHead(
  value: unknown,
  barangays: BarangayIndex,
): typeof NO_HEAD | { readonly listedName: string } | null {
  if (value === null) {
    return NO_HEAD;
  }
  return toResidentView(value, barangays);
}

function readMembers(value: unknown, barangays: BarangayIndex): HouseholdMemberView[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const members = value.map((entry): HouseholdMemberView | null => {
    const view = toResidentView(field(entry, 'resident'), barangays);
    const role = oneOf<HouseholdRole>(field(entry, 'role'), HOUSEHOLD_ROLES);
    const isHead = flag(field(entry, 'is_head'));
    return view === null || role === null || isHead === null ? null : { view, role, isHead };
  });
  return members.every((member): member is HouseholdMemberView => member !== null) ? members : null;
}

/* ── the vulnerability snapshot ────────────────────────────────────────────── */

const FACTOR_STATES: readonly FactorState[] = ['present', 'absent', 'unknown', 'withheld'];
const RECORDED_STATES: readonly FactorState[] = ['present', 'absent', 'unknown'];
const FACTOR_CLASS_NAMES: readonly FactorClass[] = ['primary', 'contributing'];
const ORIGINS: readonly VulnerabilityFactor['origin'][] = ['computed', 'corrected'];

/** An act by an account the server could put no name to — a correction here, a family change there. */
export const UNNAMED_ACTOR = 'A staff account with no name on record';

function readSnapshot(value: unknown): VulnerabilitySnapshot | null {
  const computedAt = dateTime(field(value, 'computed_at'));
  const band = oneOf(field(value, 'band'), HOUSEHOLD_BANDS);
  const memberCount = int(field(value, 'member_count'));
  const factors = readFactors(field(value, 'factors'));
  const perCapita = int(field(field(value, 'poverty_threshold'), 'annual_per_capita_centavos'));

  if (
    computedAt === null ||
    band === null ||
    memberCount === null ||
    factors === null ||
    perCapita !== ACTIVE_POVERTY_THRESHOLD.annualPerCapita.centavos
  ) {
    return null;
  }
  return { computedAt, factors, band, memberCount };
}

/** Every factor the console knows, once each, in the console's order — or `null`. */
function readFactors(value: unknown): VulnerabilityFactor[] | null {
  if (!Array.isArray(value) || value.length !== VULNERABILITY_FACTOR_CODES.length) {
    return null;
  }
  const read = value.map(readFactor);
  const ordered = VULNERABILITY_FACTOR_CODES.map(
    (code) => read.find((factor) => factor?.code === code) ?? null,
  );
  return ordered.every((factor): factor is VulnerabilityFactor => factor !== null) ? ordered : null;
}

function readFactor(value: unknown): VulnerabilityFactor | null {
  const code = oneOf<VulnerabilityFactorCode>(field(value, 'code'), VULNERABILITY_FACTOR_CODES);
  const factorClass = oneOf(field(value, 'class'), FACTOR_CLASS_NAMES);
  const state = oneOf(field(value, 'state'), FACTOR_STATES);
  const origin = oneOf(field(value, 'origin'), ORIGINS);
  const basis = readBasis(field(value, 'basis'));
  const rawComputed = field(value, 'computed_state');
  const computedState = rawComputed === null ? null : oneOf(rawComputed, FACTOR_STATES);
  const rawCorrection = field(value, 'correction');

  if (
    code === null ||
    factorClass === null ||
    state === null ||
    origin === null ||
    basis === null ||
    factorClass !== FACTOR_CLASSES[code] ||
    (rawComputed !== null && computedState === null)
  ) {
    return null;
  }

  const correction = rawCorrection === null ? null : readCorrection(rawCorrection, code);
  if (rawCorrection !== null && correction === null) {
    return null;
  }

  return { code, class: factorClass, state, basis, origin, computedState, correction };
}

function readBasis(value: unknown): FactorBasis | null {
  const observed = int(field(value, 'observed'));
  const residentIds = field(value, 'resident_ids');
  if (observed === null || !Array.isArray(residentIds)) {
    return null;
  }
  const ids = residentIds.map((entry) => id<ResidentId>(entry));
  if (!ids.every((entry): entry is ResidentId => entry !== null)) {
    return null;
  }
  const amount = int(field(value, 'amount_centavos'));
  return {
    observed,
    outOf: int(field(value, 'out_of')),
    threshold: int(field(value, 'threshold')),
    amount: amount === null ? null : centavos(amount),
    residentIds: ids,
  };
}

function readCorrection(value: unknown, code: VulnerabilityFactorCode): FactorCorrection | null {
  const state = oneOf(field(value, 'state'), RECORDED_STATES);
  const reason = str(field(value, 'reason'));
  const correctedAt = dateTime(field(value, 'corrected_at'));
  if (state === null || reason === null || correctedAt === null) {
    return null;
  }
  return {
    code,
    state,
    reason,
    actorId: id<StaffUserId>(field(value, 'actor_id')),
    actorName: str(field(value, 'actor_name')) ?? UNNAMED_ACTOR,
    correctedAt,
  };
}

/* ── the trail ─────────────────────────────────────────────────────────────── */

type TrailLine = Omit<AuditEntry, 'entityType' | 'entityId'>;

/** Every event, in the server's order — newest first — or `null` when one cannot be read. */
function readEvents(value: unknown): TrailLine[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const lines = value.map(readEvent);
  return lines.every((line): line is TrailLine => line !== null) ? lines : null;
}

function readEvent(value: unknown): TrailLine | null {
  const eventId = id<AuditEntryId>(field(value, 'id'));
  const kind = oneOf(field(value, 'kind'), HOUSEHOLD_EVENT_KINDS);
  const occurredAt = dateTime(field(value, 'occurred_at'));
  if (eventId === null || kind === null || occurredAt === null) {
    return null;
  }
  const summary = describeHouseholdEvent({
    kind,
    residentId: id<ResidentId>(field(value, 'resident_id')),
    role: oneOf<HouseholdRole>(field(value, 'role'), HOUSEHOLD_ROLES),
    factorCode: oneOf<VulnerabilityFactorCode>(
      field(value, 'factor_code'),
      VULNERABILITY_FACTOR_CODES,
    ),
    factorState: oneOf(field(value, 'factor_state'), RECORDED_STATES),
  });
  if (summary === null) {
    return null;
  }
  return {
    id: eventId,
    action: householdEventAction(kind),
    summary,
    reason: str(field(value, 'reason')),
    actorId: id<StaffUserId>(field(value, 'actor_id')),
    actorName: str(field(value, 'actor_name')) ?? UNNAMED_ACTOR,
    occurredAt,
  };
}

/* ── refusals ──────────────────────────────────────────────────────────────── */

const PROBLEM_CODES = {
  'no-members': true,
  'no-head': true,
  'several-heads': true,
  'head-not-a-member': true,
  'duplicate-member': true,
  'member-not-found': true,
  'already-a-member': true,
  'member-in-another-household': true,
  'head-cannot-be-removed': true,
  'outside-your-barangay': true,
} satisfies Record<HouseholdProblemCode, true>;

function isProblemCode(key: string): key is HouseholdProblemCode {
  return Object.hasOwn(PROBLEM_CODES, key);
}

/**
 * A refused composition, in the domain's terms — or `null` when the failure is not one.
 *
 * The API answers a refused composition with a 409 whose `details` name each problem by the
 * console's `HouseholdProblemCode`, with the residents it is about. Every code read becomes a
 * `HouseholdCompositionError` the screens already word. A conflict naming a code this console has
 * no words for, or none at all ("no correction of that factor stands to withdraw"), is the server's
 * own sentence instead: a refusal is never dropped for being unfamiliar, and never re-worded into
 * a rule it did not state.
 */
export function toHouseholdRefusal(failure: unknown): Error | null {
  if (field(failure, 'code') !== 'CONFLICT') {
    return null;
  }
  const message =
    str(field(failure, 'message')) ?? 'The server refused that change to the household.';
  const details = field(failure, 'details');
  if (details === null || typeof details !== 'object' || Array.isArray(details)) {
    return new Error(message);
  }
  const problems: HouseholdProblem[] = [];
  const entries = Object.entries(details);
  for (const [key, residents] of entries) {
    if (!isProblemCode(key) || !Array.isArray(residents)) {
      return new Error(message);
    }
    const named = residents.map((entry) => id<ResidentId>(entry));
    if (!named.every((entry): entry is ResidentId => entry !== null)) {
      return new Error(message);
    }
    if (named.length === 0) {
      problems.push({ code: key, residentId: null });
    }
    for (const residentId of named) {
      problems.push({ code: key, residentId });
    }
  }
  return problems.length === 0 ? new Error(message) : new HouseholdCompositionError(problems);
}

/* ── writes ────────────────────────────────────────────────────────────────── */

/**
 * What `POST office/households` reads (`OfficeHouseholdCreate`), and nothing else: the body is
 * strict. Flat, where `HouseholdDraft` nests nothing either — but named the API's way, mapped field
 * by field.
 */
export interface HouseholdDraftWire {
  readonly barangay_id: string;
  readonly purok_or_sitio: string | null;
  readonly street_address: string;
  readonly head_resident_id: string;
  /** Integer centavos, as `Money` holds them: a decimal point is refused, never rounded. */
  readonly monthly_income_centavos: number | null;
  readonly is_indigent: boolean;
}

/** `barangayId` is the API's id for the draft's barangay, resolved through `BarangayIndex`. */
export function toWireHouseholdDraft(
  draft: HouseholdDraft,
  barangayId: string,
): HouseholdDraftWire {
  const purok = draft.purokOrSitio?.trim() ?? '';
  return {
    barangay_id: barangayId,
    purok_or_sitio: purok.length > 0 ? purok : null,
    street_address: draft.streetAddress.trim(),
    head_resident_id: draft.headResidentId,
    monthly_income_centavos: draft.monthlyIncome === null ? null : draft.monthlyIncome.centavos,
    is_indigent: draft.isIndigent,
  };
}

/** One intent, as `OfficeHouseholdMembershipChange` names it. */
export type MembershipChangeWire =
  | { readonly kind: 'add-member'; readonly resident_id: string; readonly role: HouseholdRole }
  | { readonly kind: 'remove-member'; readonly resident_id: string }
  | { readonly kind: 'change-role'; readonly resident_id: string; readonly role: HouseholdRole }
  | { readonly kind: 'set-head'; readonly resident_id: string };

/** What `POST office/households/{id}/membership` reads: intents, never a replacement list. */
export interface MembershipWire {
  readonly changes: readonly MembershipChangeWire[];
  readonly reason: string;
}

export function toWireMembership(
  changes: readonly MembershipChange[],
  reason: string,
): MembershipWire {
  return {
    changes: changes.map((change): MembershipChangeWire => {
      switch (change.kind) {
        case 'add-member':
          return { kind: 'add-member', resident_id: change.residentId, role: change.role };
        case 'remove-member':
          return { kind: 'remove-member', resident_id: change.residentId };
        case 'change-role':
          return { kind: 'change-role', resident_id: change.residentId, role: change.role };
        case 'set-head':
          return { kind: 'set-head', resident_id: change.residentId };
      }
    }),
    reason: reason.trim(),
  };
}

/** What `POST office/households/{id}/corrections` reads (`OfficeHouseholdCorrection`). */
export interface CorrectionWire {
  readonly code: VulnerabilityFactorCode;
  readonly state: FactorState;
  readonly reason: string;
}

export function toWireCorrection(
  code: VulnerabilityFactorCode,
  state: FactorState,
  reason: string,
): CorrectionWire {
  return { code, state, reason: reason.trim() };
}
