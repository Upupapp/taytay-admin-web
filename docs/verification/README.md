# ID verification review

Residents who asked, from the residents' app, to have their account verified against a government ID
and a selfie — and the administrator who decides. The first module of this console built on what the
Node API actually serves (`DL-164`, `DL-167`). Before it, nobody could approve a verification at all:
the API had the queue and no screen existed.

## The two things to understand first

### 1. The images are a government ID and a face

Every request carries the front of an ID, sometimes its back, and a selfie. They are the most
sensitive things this console shows, so:

- **Nothing is loaded until the reviewer asks.** The review opens with the images closed. "Show the ID
  and the selfie" opens a warning first — whose ID it is, to open it only to decide this request,
  where nobody else can see the screen, and not to copy it — the `openDocument` precedent (`DL-77`):
  reading a sensitive file is a separate act, said before it happens.
- **Bytes, never addresses.** The model carries media ids and no URL; the port's `openImage` answers a
  `Blob`. Over HTTP it is `GET media/{id}/content` through `ApiClient.blob`, so the bearer token
  travels in the `Authorization` header and never in an address. An `<img src>` pointed at the API
  could not send that header, and would need the token in the query string.
- **Object URLs are made in one place and revoked.** `VerificationReview` turns the bytes into `blob:`
  URLs through its own `ObjectUrls` (`shared/media/object-urls.ts`, since `DL-168` the one file in
  the console that makes one) and revokes every one when the images are hidden, when another request is opened in the same
  drawer, and when the review closes or the page is left. Nothing is written to storage.
- **Nothing reaches a log.** A failure says only that the images could not be opened. The request
  carries no ID number — the API sends none — and the model is checked to keep it that way.
- **CSP.** `img-src` is exactly `'self' data: blob:` in every policy; `check:headers` rule 8 refuses a
  remote origin there, which is the structural form of "no `<img src>` to the API".

### 2. A person decides, and the resident reads a rejection

- **No verdict of the software's own.** No match score, confidence, "looks valid" or suggested
  decision on the model, the screen or anywhere in the module. Whether the selfie is the person on the
  ID is a judgement made with a reason against somebody's name.
- **Every decision goes through `StatusTransition`** and carries words: at least a sentence, at most
  the API's 1,000 characters. The API makes an approval's note optional; this console asks for one,
  because every other recorded move here carries why (`DL-54`).
- **The form names the reader before anybody types.** On an approval the note is for the office —
  the resident never sees it. On a rejection the same field is what the resident reads in the app as
  what was wrong, so its label says *Reason the resident will read*.
- **What a decision does is shown before the button**, between the choice and the confirm, and the
  confirm button is described by it. The sentences are `VERIFICATION_DECISION_EFFECTS`, in the domain,
  read from the backend's own code at `2736e28`:

| Decision | What the API does |
| --- | --- |
| Approve | Marks the account verified; a resident account becomes a verified resident (staff and admin roles unchanged); issues a digital ID with the selfie as its photo if the account is then a verified resident account, not closed, and has none; tells the resident "Your identity review was approved." Nothing in this console can undo it. |
| Reject | Puts the reason in front of the resident in the app; tells them "Your identity review was rejected."; the account stays registered and the resident may correct and resend, which returns the request to the queue. |

## The lifecycle

`pending → approved | rejected`, and `rejected → pending` when the **resident** corrects it in the app.
The office makes only the first two moves (`VERIFICATION_REVIEW_MOVES`); `approved` is terminal. The
catalog and the transitions are defined once, in `domain/verification` (rule 7). A decision on a
request that is no longer pending — a colleague got there first — is refused by the API with
`CONFLICT`, and the screen says the decision was not recorded.

## The queue

- **Pending first.** The queue opens on what is waiting; approved, rejected and every request are a
  choice away, kept in the URL (`?status=`). The server orders each status newest first and offers no
  other order; the screen says so.
- **A page at a time.** Cursor-paged with no total, so the screen says how many it shows and whether
  more are available — never "page 1 of N" (`DL-161`). "Show more" appends the next page.
- **A request the console cannot read refuses the page**, rather than being dropped: one fewer row
  would be a resident waiting for a review nobody can see is owed.
- **The review opens in a drawer.** The API has no read of one request, so there is no address a
  reload could answer. After a decision the queue is read again from the server, never patched.

## What the reviewer cannot see

The API sends a request with the account id, the ID type, the images, the dates and any message the
resident wrote — and **not** the account holder's name, birth date or address. So this review can
establish that the selfie shows the person on the ID and that the ID is legible and of the kind
stated; it cannot compare the ID with what the account says about itself. The screen says this. Whether
the review should also show the account's name and birth date is the owner's decision: it is more
personal data on the screen, for a better-grounded decision. It would need the API as well — the
vendored spec at `2736e28` has no `GET admin/users/{id}`, and `GET admin/users` omits birth dates
(`DL-168`).

## Access

`verification.review` is the API's own key (`StaffCapability`), added to `PERMISSIONS` unchanged
(`DL-122`: one vocabulary). The API grants it to `admin` alone; in this console only the system
administrator holds it, by holding every key, and no role names it. It is mutating, not a read. The
route asks for it, the menu entry mirrors the route, and the mock adapter re-checks it — none of which
is the protection: the API refuses anybody else.

## Built on what already existed

| Already there | From | How verification uses it |
| --- | --- | --- |
| `StatusTransition` | cases (`DL-54`) | Gained per-destination guidance — consequences before the button, the reason's reader in its label — and a maximum length. Default wording unchanged. |
| `Drawer`, `Modal`, `DataTable`, `AsyncContent`, `StatusBadge` | shared | Unchanged |
| `ApiClient` | `DL-165` | Gained `blob`, taught to `check:routes`, `check:response-shape` (a new `binary` envelope), `check:mapper-adoption` and `check:query-params` |
| `UNSERVED_PORTS` | `DL-167` part 1 | The port is served in the http set; `check:unserved` holds its route and menu entry to it |

## Checks

`check:verification` (in `verify`) holds the module to the above: no decision-shaped or identifying
field on the model, no deciding function, bytes not URLs, object URLs made only through `ObjectUrls`
and revoked on hide and on destroy, `openImage` called only from the warning's own button, no storage or
console, no other image source, the reason sent as `notes`, the reader named, the consequences taken
from the domain's list, and the key held by the administrator alone. Eighteen planted regressions,
each caught.

## Known gaps

- **No account details** (above) — a decision for the owner.
- **No reviewer name** on a decided request. The API sends the reviewer's account id, which this
  console cannot resolve while the staff directory is unserved; the API's audit trail records who
  decided.
- **The resident's notification is the API's.** This console does not send it and cannot change it.
- **Not run against a live API.** The adapter is built and tested against the vendored spec and
  composed fixtures; nothing on this machine runs the Node API.
