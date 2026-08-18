import RELEASE from './release-created.json';

/**
 * Recorded from the running API. An assistance request was walked through the
 * lifecycle to `approved` — by a **second** officer, because the first was
 * refused — and a cash release scheduled against it.
 *
 * TAB 08 owns this surface. These tests pin what was observed so that command
 * starts from evidence.
 */
describe('the release payload, as recorded', () => {
  it('carries money as integer centavos plus a currency', () => {
    // Exactly the console's `Money`. No floating point anywhere in the chain,
    // on either side — the strongest agreement on this surface.
    expect(RELEASE.data.amount_centavos).toBe(250000);
    expect(RELEASE.data.currency).toBe('PHP');
    expect(Number.isInteger(RELEASE.data.amount_centavos)).toBe(true);
  });

  it('separates goods from money, as the console does', () => {
    // `DL-93`: an in-kind release carries a description and no amount, because
    // nobody at the MSWDO priced that sack of rice and an invented figure
    // appears in reports as though somebody did.
    expect(RELEASE.data.kind).toBe('cash');
    expect(RELEASE.data.in_kind_description).toBeNull();
  });

  it('opens in a status the console cannot render — the TAB 04 divergence, live', () => {
    /*
     * `ready` is one of the three API statuses the console has no catalog entry
     * for (`ready`, `failed`, `cancelled`). Every release begins in it, so on
     * the current vocabularies **the first thing a disbursing officer would see
     * is a blank status chip** — not an edge case, the default case.
     *
     * TAB 04 step 4 recorded this from the enums. This is the same finding
     * arriving on the wire.
     */
    expect(RELEASE.data.status).toBe('ready');
  });

  it('advertises a transition the transition endpoint refuses — L-20', () => {
    /*
     * `available_transitions` includes `released`, and
     * `POST admin/releases/{id}/status` accepts only
     * `completed,failed,deferred,cancelled,ready`. Handing money over goes
     * through `POST .../confirmation` instead.
     *
     * A client doing exactly what the payload tells it gets a 422. That matters
     * more here than elsewhere: `available_transitions` is the mechanism the
     * console relies on so it never re-derives a transition map, and this is
     * the one surface where being wrong moves money.
     */
    expect(RELEASE.data.available_transitions).toContain('released');
  });
});
