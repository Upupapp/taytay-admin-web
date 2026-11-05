# Digital IDs

A resident's **digital ID** is a municipal card the Taytay app shows with a QR code. Staff **check**
the card a resident shows (`POST digital-id/verify`, `digital-id.verify` — every staff account and
administrators on the server); an administrator **keeps** the cards — reads an account's current
card, issues one, suspends, revokes or replaces it (`admin/users/{id}/digital-id`,
`admin/digital-ids/{id}/…`, `digital-id.manage`, administrators alone). Built on what the Node API
serves (`DL-164`, `DL-171`). One route, `/digital-ids`, with a section for each grant.

## The things to understand first

### 1. A check is a lookup, kept as small as the API makes it

- **No camera.** The page says so: a scanner that types into the field, or the code's text copied
  from a scanning app, is enough. Nothing in the module asks for the camera or a barcode detector.
- **The code is a short-lived pass, not a note.** The field is emptied the moment the code is sent;
  the answer lives in one signal and is gone when another code is checked, the answer is cleared, or
  the page is left. Nothing is logged, stored or cached.
- **What the API answers, and nothing beside it.** Name, the card's status, whether it has expired,
  the barangay's name — and the photo, **only on request, after a warning**, as bytes through the
  data layer, revoked on hide and on leave (`DL-167`'s pattern).
- **No verdict.** The screen repeats the API and says what that settles is the checker's decision.
- **Said before the button:** a code is accepted for two minutes after the app shows it; the API
  records every successful check under the checker's account (`digital_id.scanned`); this console
  keeps nothing.

### 2. A card is found through its account

The API has no list of cards, only an account's current card. So the administrator's section reads
the app accounts a page at a time (fifty, the API's largest) and shows the **verified residents among
them**, saying how many accounts that was and whether more are available — never presenting a
filtered page as the registry (`DL-161`). Opening one shows its card beside the list.

### 3. Every act says what it does to the card in the app, before it is done

Read from the backend at `2736e28` (`src/modules/digital-id/routes.ts`, `repository.ts`,
`src/digital-id/signer.ts`) and held in `DIGITAL_ID_EFFECTS`:

| Act     | What the API does                                                                                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue   | A card valid for 365 days with a new number; the photo is the resident's latest approved verification selfie (this console names no other). Refused unless the account is a verified resident, open, with no current card. |
| Suspend | Active cards only. The app shows no QR code. **No route makes a suspended card active again** — afterwards it can only be revoked or replaced.                                                                             |
| Revoke  | Active or suspended. The card stops working for good, and the administrator's read never returns it again: the API keeps no list of revoked cards.                                                                         |
| Replace | Revokes the card and issues a new one in the same act: new number, same photo, 365 days. Refused — and the old card left as it was — if the account is no longer a verified resident or is closed.                         |

Every act is recorded in the API's audit trail under the administrator's account, with **no
reason**: the routes take no body that could carry one, so none is asked for. Choosing an act opens a
confirmation; its effects stand above its only button. After an act the card is read again from the
server; a refusal stays in the confirmation in the API's words.

## Access

`digital-id.verify` and `digital-id.manage` are the API's own keys, added to `PERMISSIONS` unchanged
(`DL-122`). The server gives the first to every staff account, so every role holds it in the mock
too, and it is classified **read-only** — a check changes nothing on the card, which keeps the
auditor a read-only role. The second is the administrator's alone, named by no role, mutating. The
route and the menu entry open for either; each section is offered only to its own grant. Keeping
cards also reads the app accounts (`user.view` on the server, also the administrator's).

## Checks

`check:digital-ids` (in `verify`): residents told and no camera said; no camera, storage or log in
the module; the code sent once, from `check()`, with the field emptied first; the photo fetched only
from the warning's own button, revoked when the component goes; every act through `commit`, whose one
button is inside the confirmation after the act's effects, and called by nothing else; the effects
still say the card stops working, a suspension cannot be lifted, a replacement has a new number, and
a check is recorded by the API and kept by nobody here; no QR read and a check read for its five
fields; the server's keys. Fifteen planted regressions, each caught, every file restored.

## Known gaps (the backend's)

- **No reason is kept** for suspending, revoking or replacing a card; the audit entry says only who.
- **No way to lift a suspension.** A card suspended by mistake can only be replaced, with a new number.
- **No list of cards**, nor of revoked ones: a card is found only through its account.
- **No photo can be chosen** from the console: the API takes a media id the resident uploaded, and no
  route lists a resident's media.
- **Not run against a live API.** Built and tested against the vendored spec and composed fixtures.
- In `local-mock`, a sample code is `SAMPLE-QR.card-0001` (active) or `SAMPLE-QR.card-0002`
  (suspended) — never a signed token, and a `check:bundle` marker.
