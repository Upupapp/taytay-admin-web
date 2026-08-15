import {
  formatProtectedName,
  gradeDuplicate,
  hasSensitiveSector,
  type DuplicateCandidate,
  type MatchAttribute,
  type MatchOutcome,
  type MatchSignal,
  type Resident,
} from '@domain/index';

/**
 * Finds registry records that may be the same person.
 *
 * The whole module is written to one constraint: **it compares values and emits
 * none of them** (`DL-73`). Every signal it produces names a field and an
 * outcome. A reviewer working the queue learns that two records agree on a
 * birth date; they do not learn the date, and the office does not disclose one
 * person's details to somebody who came to look at another's.
 *
 * When the API takes this over, the same rule applies on the server: the
 * endpoint returns signals, not the other record.
 */

/** Ignores case, accents, punctuation and repeated spaces. */
function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function compare(a: string | null, b: string | null): MatchOutcome {
  // Absence is not disagreement. One record simply not carrying a mobile number
  // says nothing about whether these are the same person, and scoring it as a
  // difference would hide real duplicates behind incomplete profiles.
  if (a === null || b === null || a.trim() === '' || b.trim() === '') {
    return 'not-comparable';
  }
  const left = normalise(a);
  const right = normalise(b);
  if (left === right) {
    return 'same';
  }
  return isNearlyTheSame(left, right) ? 'similar' : 'differs';
}

/**
 * One edit apart, or one string containing the other.
 *
 * Deliberately conservative. A looser rule turns every Cruz in the municipality
 * into a candidate, and a queue nobody can finish is a queue nobody works.
 */
function isNearlyTheSame(a: string, b: string): boolean {
  if (a.length > 2 && b.length > 2 && (a.startsWith(b) || b.startsWith(a))) {
    return true;
  }
  return editDistanceWithinOne(a, b);
}

function editDistanceWithinOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) {
    return false;
  }

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) {
      return false;
    }
    if (a.length > b.length) {
      i += 1;
    } else if (b.length > a.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }

  return edits + (a.length - i) + (b.length - j) <= 1;
}

function signal(attribute: MatchAttribute, outcome: MatchOutcome, rule: string): MatchSignal {
  return { attribute, outcome, rule };
}

/**
 * Every attribute the matcher looks at, with the rule it applied stated in
 * plain language — so a reviewer can disagree with the machine on its own
 * terms (`DL-60`, carried into identity review).
 */
export function compareRecords(a: Resident, b: Resident): readonly MatchSignal[] {
  return [
    signal('surname', compare(a.name.last, b.name.last), 'Surnames compared, ignoring case and accents.'),
    signal(
      'given-name',
      compare(a.name.first, b.name.first),
      'Given names compared, allowing one letter of difference.',
    ),
    signal(
      'birth-date',
      compare(a.birthDate, b.birthDate),
      'Dates of birth compared exactly.',
    ),
    signal('sex', compare(a.sex, b.sex), 'Recorded sex compared.'),
    signal(
      'philsys-last-four',
      compare(a.philsysLastFour, b.philsysLastFour),
      'Last four PhilSys digits compared. The digits themselves are never shown here.',
    ),
    signal(
      'barangay',
      compare(a.address.barangayId, b.address.barangayId),
      'Barangay compared.',
    ),
    signal(
      'street-address',
      compare(a.address.streetAddress, b.address.streetAddress),
      'Street addresses compared, allowing one character of difference.',
    ),
    signal(
      'mobile',
      compare(
        a.contact.mobile === null ? null : digitsOnly(a.contact.mobile),
        b.contact.mobile === null ? null : digitsOnly(b.contact.mobile),
      ),
      'Mobile numbers compared as digits only, so formatting does not matter.',
    ),
    signal(
      'household',
      compare(a.householdId, b.householdId),
      'Household linkage compared.',
    ),
  ];
}

/**
 * Candidates for one record.
 *
 * `weak` pairs are discarded rather than listed. A queue that reports every
 * shared surname in a municipality of this size is noise, and a reviewer who
 * learns to clear the queue without reading it is worse than no queue.
 */
export function candidatesFor(
  subject: Resident,
  population: readonly Resident[],
): readonly DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  for (const other of population) {
    if (other.id === subject.id || !other.isActive) {
      continue;
    }

    // Cheap gate first: without an agreeing surname nothing here can reach
    // `moderate`, and comparing nine fields across the whole registry for every
    // record is the kind of cost that only shows up in production.
    const surname = compare(subject.name.last, other.name.last);
    if (surname === 'differs' || surname === 'not-comparable') {
      continue;
    }

    const signals = compareRecords(subject, other);
    const strength = gradeDuplicate(signals);
    if (strength === 'weak') {
      continue;
    }

    candidates.push({
      residentId: subject.id,
      otherResidentId: other.id,
      residentLabel: formatProtectedName(subject.name),
      otherLabel: formatProtectedName(other.name),
      strength,
      signals,
      // Either side being a protection case raises the bar for opening the
      // comparison: the sensitivity belongs to the pair, not to one record.
      holdsSensitiveRecord: hasSensitiveSector(subject) || hasSensitiveSector(other),
    });
  }

  return candidates.sort(byStrength);
}

const STRENGTH_ORDER = { strong: 0, moderate: 1, weak: 2 } as const;

function byStrength(a: DuplicateCandidate, b: DuplicateCandidate): number {
  const delta = STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength];
  return delta !== 0 ? delta : a.otherResidentId < b.otherResidentId ? -1 : 1;
}
