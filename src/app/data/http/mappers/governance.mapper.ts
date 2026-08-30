import {
  asId,
  CLASSIFICATION_CATALOG,
  SAVED_VIEW_RESOURCES,
  type ClassifiedRecordType,
  type DataClassification,
  type RetentionRule,
  type SavedView,
  type SavedViewId,
  type SavedViewResource,
} from '@domain/index';

import { bool, int, str, text } from './wire';

/**
 * Three governance reads, all of which were asking for an array and getting an object.
 *
 * Every one used `collection<T>`, which hands back `response.data` untouched. All three endpoints
 * answer `ApiResponse::item`, so `data` is an object wrapping the list under a key — `categories`,
 * `views` — and the screens showed nothing at all (`DL-156`).
 *
 * @consumes GET admin/privacy/classifications
 * @consumes GET admin/privacy/retention
 * @consumes GET admin/saved-views
 */

/* ── classifications ──────────────────────────────────────────────────────── */

const CLASSIFICATIONS = Object.keys(CLASSIFICATION_CATALOG) as readonly DataClassification[];

/**
 * `{ categories: [...], approved, notice }`.
 *
 * A category the office has not classified arrives with `classification: null` and
 * `unclassified: true`, and the server names it rather than leaving a null somebody reads as
 * "public" — its own comment says so. The console keeps that: an unclassified category is read as
 * **`sensitive-personal`**, the most protective value, because a record type nobody has ruled on is
 * one nothing should be relaxed about. It is not dropped, because a missing row reads as "there is
 * no such record type" (`DL-105`'s rule about withholding rather than omitting).
 */
export function toClassifiedRecordTypes(wire: unknown): readonly ClassifiedRecordType[] {
  const rows = arrayUnder(wire, 'categories');

  return rows.flatMap((entry): ClassifiedRecordType[] => {
    const row = asObject(entry);
    const key = str(row['key']);
    if (key === null) return [];

    const declared = str(row['classification']);
    const classification = CLASSIFICATIONS.find((candidate) => candidate === declared);

    return [
      {
        key,
        // The wire carries no label. The key is what the office named the record series.
        label: key,
        classification: classification ?? 'sensitive-personal',
        holds: text(row['holds'], ''),
      },
    ];
  });
}

/* ── retention ────────────────────────────────────────────────────────────── */

const DAYS_IN_YEAR = 365;

/**
 * `{ approved, approved_by, approved_on, categories: { key: days }, legal_bases, notice }`.
 *
 * `categories` is a **flat map**, not a list of objects — different in shape from the categories on
 * `/classifications`, which is a list. A `collection<T>` read of this was wrong twice over.
 *
 * ## The periods are read and the screen still withholds them, on purpose
 *
 * The server holds real numbers — 2555 days for an account, 3650 for a resident — and reports
 * `approved: false` with a notice calling them placeholders pending review, adding that no
 * scheduled deletion occurs while that is true.
 *
 * So `periodInYears` carries what the server holds and `provenance` carries whether anybody
 * approved it, and `describeRetention` prints "No schedule recorded" for an unapproved period.
 * That division is right and was already there: **an unapproved draft is not a schedule**, and
 * showing "Kept for 7 years" beside a record series is the invented policy `DL-113` refuses — the
 * one an office cannot undo once it has acted on it. The data layer reports what exists; the domain
 * decides what may be said.
 *
 * When the DPO approves, `approved` flips and the periods appear with no code change. That is what
 * makes carrying them now correct rather than premature.
 */
export function toRetentionRules(wire: unknown): readonly RetentionRule[] {
  const row = asObject(wire);
  const categories = asObject(row['categories']);
  const approved = bool(row['approved']);

  return Object.keys(categories)
    .sort()
    .map((key): RetentionRule => {
      const days = int(categories[key]);

      return {
        recordTypeKey: key,
        label: key,
        /*
         * The retention payload says nothing about classification, and `/classifications` is a
         * separate read behind the same grant. Assuming `personal` for everything would understate
         * a sensitive series, so the most protective value stands until the two are joined.
         */
        classification: 'sensitive-personal',
        periodInYears: days === null ? null : Math.round(days / DAYS_IN_YEAR),
        provenance: approved ? 'office-policy' : 'awaiting-office-policy',
        basis: null,
        disposalNote: null,
      };
    });
}

/* ── saved views ──────────────────────────────────────────────────────────── */

/**
 * `{ views: [...], grammar: [...] }`.
 *
 * `ownerId` is `null` for every view, and that is the API being careful rather than incomplete: it
 * publishes `is_shared` and `is_mine` and deliberately withholds `owner_subject_id`, so a reader
 * cannot see **who** owns a shared view they do not own. `DL-111` makes sharing a view a separate
 * grant because its *name* describes a population to every colleague; not naming its author is the
 * same instinct, and this console is not going to reconstruct it.
 *
 * A view for a resource this console has no screen for is dropped rather than rendered: the name
 * would be a link to nowhere.
 */
export function toSavedViews(wire: unknown): readonly SavedView[] {
  return arrayUnder(wire, 'views').flatMap((entry): SavedView[] => {
    const row = asObject(entry);
    const id = str(row['id']);
    const resource = SAVED_VIEW_RESOURCES.find(
      (candidate): candidate is SavedViewResource => candidate === str(row['entity']),
    );

    if (id === null || resource === undefined) return [];

    const filters = asObject(row['filters']);
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'string') params[key] = value;
      else if (typeof value === 'number' || typeof value === 'boolean') params[key] = String(value);
    }

    return [
      {
        id: asId<SavedViewId>(id),
        resource,
        name: text(row['name']),
        params,
        isShared: bool(row['is_shared']),
        // Withheld by the API on purpose — see above.
        ownerId: null,
        audit: { createdAt: EPOCH, createdBy: null, updatedAt: EPOCH, updatedBy: null },
      },
    ];
  });
}

const EPOCH = '1970-01-01T00:00:00.000Z' as SavedView['audit']['createdAt'];

/* ── helpers ──────────────────────────────────────────────────────────────── */

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayUnder(wire: unknown, key: string): readonly unknown[] {
  const under = asObject(wire)[key];
  return Array.isArray(under) ? under : [];
}
