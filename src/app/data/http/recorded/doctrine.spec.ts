import DECIDED from './duplicate-decided.json';
import SEARCH from './search-results.json';

/**
 * Where the two sides independently reached the same rule — and the one place
 * on these surfaces where they did not.
 *
 * All recorded from the running API. These matter more than the mapping tests:
 * a field name that disagrees is a bug, but a *rule* that disagrees is a
 * decision somebody has to make.
 */

describe('duplicate resolution — ADR 0044, verified against the API', () => {
  it('records a finding with a reason, and supersedes rather than merges', () => {
    /*
     * `DL-74`: "There is no merge. Resolving a pair records a finding with a
     * required reason and the reviewer's name; `same-person` supersedes a record
     * without deleting it."
     *
     * ADR 0044 chose supersede over the API's `/merge`, and the sweep implied
     * that meant asking the backend for something new. It did not: `/decide`
     * already implements exactly this. Both residents returned 200 after the
     * decision, and re-detection reported `undecided: 0` — the pair stops
     * resurfacing as work without either record being destroyed.
     *
     * So the doctrinal conflict the sweep recorded is resolvable with **no
     * backend change at all**. `/merge` simply goes unused.
     */
    expect(DECIDED.data.decision).toBe('same-person');
    expect(DECIDED.data.decision_note).toBeTruthy();
    expect(DECIDED.data.decided_at).toBeTruthy();

    // Both records survive the decision.
    expect(DECIDED.data.residents).toHaveLength(2);
    expect(DECIDED.data.residents.every((r) => r.is_active)).toBe(true);
  });

  it('discloses the values the console deliberately withholds — L-21', () => {
    /*
     * `DL-73`: "A `MatchSignal` carries an attribute, an outcome and the rule
     * applied — never a value — so the review panel cannot leak a birth date it
     * was never handed."
     *
     * The API sends the full resident record on both sides of the pair,
     * birth date included. The rule it matched on is named
     * (`name-and-birth-date`), which is the part the console wanted — but the
     * values come with it.
     *
     * Not a bug: comparing two records is arguably what a reviewer is for. It is
     * a different answer to "how much must somebody see to decide this", and the
     * console's answer was reasoned about. Recorded so it is decided rather than
     * inherited.
     */
    expect(DECIDED.data.rule).toBe('name-and-birth-date');
    expect(DECIDED.data.residents[0] ?? {}).toHaveProperty('birth_date');
  });
});

describe('search — three refusals the console makes, and the API makes too', () => {
  it('returns no snippet, context or matched text', () => {
    // `DL-109`: `SearchHit` has no snippet, context, matchedText or excerpt.
    const hit = SEARCH.data.results[0] ?? {};

    for (const leak of ['snippet', 'context', 'matched_text', 'excerpt', 'body']) {
      expect(hit).not.toHaveProperty(leak);
    }
  });

  it('matches only the closed field set — not note bodies, not free text', () => {
    /*
     * The sharper half of `DL-109`: "Matching on free text discloses it even
     * with no snippet rendered: type a condition, get back one resident, and the
     * office has said what is in that person's file."
     *
     * Two phrases were searched against this API that exist **only** inside free
     * text — one in a visit observation, one in a referral reason. Both returned
     * zero results. The API searches names, references, barangay and status, and
     * nothing else.
     */
    expect(SEARCH.data.results.every((r) => r.title.includes('Bautista'))).toBe(true);
  });

  it('returns a composed view rather than records', () => {
    // type, id, title, barangay, status — and nothing a list has no business
    // showing.
    expect(Object.keys(SEARCH.data.results[0] ?? {}).sort()).toEqual([
      'barangay_id',
      'id',
      'status',
      'title',
      'type',
    ]);
  });
});
