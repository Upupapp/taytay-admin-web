import { ASSISTANCE_STATUS_CATALOG, type AssistanceRequestStatus } from './assistance/assistance-request';
import { CASE_STATUS_CATALOG, type CaseStatus } from './cases/social-case';
import { DISBURSEMENT_STATUS_CATALOG } from './disbursements/disbursement';
import { REFERRAL_STATUS_CATALOG, type ReferralStatus } from './referrals/referral';
import { VISIT_STATUS_CATALOG, type VisitStatus } from './visits/field-visit';
import { ENROLLMENT_STATUS_CATALOG, type EnrollmentStatus } from './beneficiaries/program-enrollment';

/**
 * TAB 04, step 4: the status vocabularies, reconciled against what the API sends.
 *
 * **The failure this prevents is the one that looks like success.** A record
 * carrying a status its screen's catalog does not hold renders blank, or throws
 * at the tone lookup, and the request that produced it returned `200` the whole
 * time. It is the specific trap the case collision sets: a 13-state assistance
 * record painted through a 7-state case catalog.
 *
 * The backend values below are transcribed from its enums as measured on
 * 18 August 2026 (`docs/access/permission-reconciliation.md` records the same
 * method for permissions). TAB 06 replaces the transcription with the generated
 * `types.ts`, vendored with a source SHA, at which point a backend enum change
 * becomes a compile error here instead of a runtime surprise.
 */

/** Exactly what `Modules\Welfare\Domain\CaseStatus` emits — the 13 ADR 0007 states. */
const BACKEND_ASSISTANCE_STATUSES: readonly AssistanceRequestStatus[] = [
  'draft',
  'submitted',
  'intake-review',
  'returned',
  'assessment',
  'endorsed',
  'approved',
  'rejected',
  'scheduled',
  'released',
  'completed',
  'cancelled',
  'expired',
];

/**
 * `Modules\Welfare\Domain\ReleaseStatus` — six states, and **not** the console's
 * nine. Typed as strings rather than `DisbursementStatus` precisely because
 * three of them are not console statuses at all.
 */
const BACKEND_RELEASE_STATUSES: readonly string[] = [
  'ready',
  'released',
  'completed',
  'failed',
  'deferred',
  'cancelled',
];

const BACKEND_REFERRAL_STATUSES: readonly ReferralStatus[] = [
  'draft',
  'sent',
  'acknowledged',
  'in-progress',
  'waiting-requirements',
  'served',
  'declined',
  'closed',
];

const BACKEND_VISIT_STATUSES: readonly VisitStatus[] = [
  'scheduled',
  'completed',
  'not-found',
  'refused',
  'cancelled',
];

const BACKEND_ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = ['active', 'suspended', 'exited'];

function catalogKeys<T extends string>(catalog: Record<T, unknown>): readonly string[] {
  return Object.keys(catalog).sort();
}

describe('every status the API can send is in the screen catalog that renders it', () => {
  it('assistance requests — the 13 states ADR 0007 made canonical', () => {
    for (const status of BACKEND_ASSISTANCE_STATUSES) {
      expect(ASSISTANCE_STATUS_CATALOG[status]).toBeDefined();
    }

    // And nothing extra: a catalog entry with no backend state behind it is a
    // status no record can ever have, which reads on screen as a stage of the
    // process that never happens.
    expect(catalogKeys(ASSISTANCE_STATUS_CATALOG)).toEqual([...BACKEND_ASSISTANCE_STATUSES].sort());
  });

  it('referrals, visits and enrolments already agree exactly', () => {
    // Three of the four vocabularies TAB 04 asks about needed no reconciliation
    // at all: the strings are identical on both sides.
    expect(catalogKeys(REFERRAL_STATUS_CATALOG)).toEqual([...BACKEND_REFERRAL_STATUSES].sort());
    expect(catalogKeys(VISIT_STATUS_CATALOG)).toEqual([...BACKEND_VISIT_STATUSES].sort());
    expect(catalogKeys(ENROLLMENT_STATUS_CATALOG)).toEqual([...BACKEND_ENROLLMENT_STATUSES].sort());
  });

  it('referrals', () => {
    for (const status of BACKEND_REFERRAL_STATUSES) {
      expect(REFERRAL_STATUS_CATALOG[status]).toBeDefined();
    }
  });

  it('field visits', () => {
    for (const status of BACKEND_VISIT_STATUSES) {
      expect(VISIT_STATUS_CATALOG[status]).toBeDefined();
    }
  });

  it('enrolments', () => {
    for (const status of BACKEND_ENROLLMENT_STATUSES) {
      expect(ENROLLMENT_STATUS_CATALOG[status]).toBeDefined();
    }
  });
});

describe('releases — the one vocabulary that does not agree', () => {
  /*
   * PINNED, NOT PAPERED OVER.
   *
   * The console has nine release states and the API six, and only three are
   * shared. This is not a naming slip: the console's set encodes a rule its own
   * decision log defends. `DL-94` holds that **deferred is the office's failing
   * and unclaimed is nobody's** — funds that have not arrived, a missing
   * countersignature, a voucher error, against a household that simply did not
   * come. Mapping `unclaimed` onto the API's `failed` would blame a family for
   * the office's paperwork, and the record would read that way to every worker
   * afterwards.
   *
   * TAB 08 owns the reconciliation, because it is the command that settles the
   * noun (`disbursement` v `release`) and maps the state machines transition by
   * transition. These tests exist so the gap cannot widen quietly in the
   * meantime, and so nobody wires the two together believing they match.
   */
  const shared = ['released', 'completed', 'deferred'];

  it('shares exactly three states with the API', () => {
    const overlap = BACKEND_RELEASE_STATUSES.filter(
      (status) => catalogKeys(DISBURSEMENT_STATUS_CATALOG).includes(status),
    ).sort();

    expect(overlap).toEqual([...shared].sort());
  });

  it('has no catalog entry for three states the API can send', () => {
    // `ready`, `failed`, `cancelled`. A release arriving in any of them today
    // would render blank or throw at the tone lookup.
    const unrenderable = BACKEND_RELEASE_STATUSES.filter(
      (status) => !catalogKeys(DISBURSEMENT_STATUS_CATALOG).includes(status),
    ).sort();

    expect(unrenderable).toEqual(['cancelled', 'failed', 'ready']);
  });

  it('draws six distinctions the API cannot express', () => {
    const consoleOnly = catalogKeys(DISBURSEMENT_STATUS_CATALOG).filter(
      (status) => !BACKEND_RELEASE_STATUSES.includes(status),
    );

    expect(consoleOnly).toHaveLength(6);
    // The two that matter most, and must survive TAB 08 in some form.
    expect(consoleOnly).toContain('unclaimed');
    expect(consoleOnly).toContain('needs-correction');
  });
});

describe('the case vocabulary is not the assistance vocabulary', () => {
  it('holds seven states, and shares exactly one with the assistance lifecycle', () => {
    /*
     * THE TRAP, ASSERTED.
     *
     * The backend adopted the console's 13-state assistance lifecycle verbatim
     * (ADR 0007) and served it at `admin/cases`, while the console's `case` is a
     * different entity with a 7-state lifecycle of its own. Pointing
     * `CaseRepository` at that route compiles, typechecks, returns 200 and
     * renders — and every status falls outside this catalog.
     *
     * And they are not disjoint: **`assessment` appears in both**, which makes
     * the trap worse rather than better. A `CaseRepository` pointed at the
     * assistance route would render that one status correctly and blank the
     * other twelve — and a screen that is partly right is far more convincing
     * than one that is obviously broken. Somebody would reasonably conclude the
     * data was incomplete rather than that the wiring was wrong.
     *
     * Pinned at exactly one. If a second state ever coincides, the overlap has
     * grown and this must be a deliberate decision rather than a coincidence of
     * two teams reaching for the same English word.
     */
    const caseStatuses = catalogKeys(CASE_STATUS_CATALOG);

    expect(caseStatuses).toHaveLength(7);

    const overlap = caseStatuses.filter((status) =>
      (BACKEND_ASSISTANCE_STATUSES as readonly string[]).includes(status),
    );

    expect(overlap).toEqual(['assessment']);
  });

  it('keeps closure terminal', () => {
    // `DL-53`. A recurrence is a new case naming the old; there is no reopen,
    // and TAB 04 must not introduce one.
    expect(CASE_STATUS_CATALOG['closed' as CaseStatus]).toBeDefined();
  });
});
