/**
 * One user intent, carried across however many attempts it takes.
 *
 * Created **at the moment the officer commits** — pressing Release, submitting an intake — and
 * held while the request is retried. The API replays the stored response for the same key, and
 * answers `409` if the same key arrives with a different body, which is what makes a double-click,
 * a flaky connection and a browser retry all resolve to one act.
 *
 * ## Why this lives in the domain
 *
 * It looks like a transport concern and is not. The key identifies **an intent a person formed**,
 * not a request a client sent — which is exactly why it cannot be minted inside the adapter. An
 * adapter that generated a key per call would give a retry a *new* key, and a new key is a new
 * intent: the API would accept it and a family would be paid twice.
 *
 * So the port asks for one, the screen creates it, and the type system carries the requirement
 * from the button that was pressed all the way to the header.
 *
 * `TAB 08` requires it on every money write.
 *
 * ## What carries it today: nothing
 *
 * The replay behaviour above was the retired Laravel API's. The Node API that replaced it
 * implements no idempotency key and its CORS policy would refuse the header, so the transport sends
 * none and no money write is served over HTTP (`DL-165`, enforced by `check:money`). Screens still
 * hold an intent across retries: it is what they owe whichever server takes those writes next, and
 * a screen that minted a key per press would be wrong again the day one does.
 */
export class WriteIntent {
  readonly key: string;

  constructor(key?: string) {
    this.key = key ?? crypto.randomUUID();
  }
}
