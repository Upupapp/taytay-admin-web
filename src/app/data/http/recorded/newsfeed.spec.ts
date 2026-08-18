import PUBLISHED from './post-published.json';
import ALT_TEXT_REFUSAL from './alt-text-refusal.json';

/**
 * Recorded from the running API. A post was drafted, published, and then probed
 * for every way back.
 *
 * TAB 10 owns this surface. These are the console's three sharpest rules about
 * speaking outward, checked against what the server will actually allow.
 */
describe('newsfeed — publication is irreversible on both sides', () => {
  it('offers archive and nothing else once published — DL-124', () => {
    /*
     * "`published → archived` and nothing else: no unpublish, no retract, no
     * unsend: archiving removes a post from the feed **going forward** and
     * reaches nobody who already read it."
     *
     * Probed directly against the running API after publishing:
     *   published → draft        409  (invalid state transition)
     *   published → scheduled    422  (not a value it accepts)
     *   published → unpublished  422
     *   published → retracted    422
     *
     * The console's rule is not something it has to enforce alone. The server
     * will not let a post be taken back either.
     */
    expect(PUBLISHED.data.status).toBe('published');
    expect(PUBLISHED.data.available_transitions).toEqual(['archived']);
  });

  it('stamps the moment it went out', () => {
    // What makes archiving honest about its limits: there is a time after which
    // people have read it, and it is recorded.
    expect(PUBLISHED.data.published_at).toBeTruthy();
  });
});

describe('newsfeed — alt text', () => {
  it('is required to attach an image, unless it is decorative — DL-125', () => {
    /*
     * Posting media without alt text is refused:
     *
     *   "The alt text field is required when is decorative is not present."
     *
     * The console's `PostImage.altText` is a required string with **no
     * decorative concept**, so the API is the more nuanced of the two here: an
     * image that carries no meaning should have empty alt text, not invented
     * alt text describing a divider.
     *
     * Recorded as a small console gap rather than a divergence — nothing breaks,
     * but the console cannot express a distinction the API and WCAG both make.
     */
    expect(ALT_TEXT_REFUSAL.error.code).toBe('VALIDATION_FAILED');
    expect(ALT_TEXT_REFUSAL.error.details.alt_text).toEqual([
      'The alt text field is required when is decorative is not present.',
    ]);
  });
});

/*
 * ── DL-126, recorded in the ledger rather than asserted here ──────────────────
 *
 * "Reach is counts … no method anywhere that could answer *which* residents
 * reacted, read or shared."
 *
 * The whole API surface for reactions is `POST /newsfeed/{post}/reaction` and
 * `DELETE /newsfeed/{post}/reaction` — a resident acting on their own — and
 * `admin/newsfeed-metrics` returns counts of posts by status, not reach by
 * person. So the question is unanswerable at the API, exactly as the console
 * leaves it unanswerable at the port.
 *
 * There is deliberately no test for it. What it asserts is the **absence of a
 * route**, and this repository holds no copy of the router to assert against —
 * a test here could only compare a hand-written list to itself and pass forever.
 * TAB 06's contract suite is where an absence on the API becomes checkable from
 * this side; until then it is a recorded observation, which is what it is.
 */
