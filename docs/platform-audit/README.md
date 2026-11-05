# App audit trail

The Node API's own audit trail: **who did what, to which record, and when**, through the Taytay
app's API — staff and administrators in this console, residents in the app. Read through
`GET admin/audit` (cursor-paged, newest first), administrators only on the server (`audit.view`).
Built on what the Node API serves (`DL-164`, `DL-171`). One route, `/app-audit`. Read-only: the
trail has no write, and neither has the screen.

## The things to understand first

### 1. A row holds six things, and the screen shows those six

`id`, `actor_id`, `action`, `subject_type`, `subject_id`, `created_at` — everything the API returns
and everything the mapper reads. **No earlier or later value, no reason, no detail**: the API stores
none, and `PlatformAuditEntry` has no field that could hold one (`DL-114`: a row says what changed,
never what it changed to). The page says so above the table.

### 2. Ids as given, and nothing looked up beside them

The account that acted and the record acted on are shown **by their ids**, as the API records them.
The page reads one port and no other: no name, email or record is fetched to decorate a row, so the
trail discloses nothing it does not hold. An administrator who needs to know whose id it is can find
the account under Users and roles; a Balita draft named here can be opened by its ID on the Balita
page.

### 3. The action in words, and the code either way

Every action the API records at `2736e28` — thirty-three codes, read from its `audit.record(...)`
calls — has a sentence in `PLATFORM_AUDIT_ACTIONS`. The code is shown beneath it as given. A code
this console does not know is shown as given and said to have no description here — never dropped,
never guessed at.

Worth knowing when reading it: `digital_id.scanned` is a member of staff **checking** a resident's
card; `account.closed`, `password.reset_completed` and `session.revoked` are a person acting on their
own account; `app.config_updated` does not say which setting changed.

### 4. Newest first, a page at a time

Fifty at a time, the API's largest page; "more available" and "Show older entries", never "page 1 of
N" (`DL-161`). "Read from the newest" reads it again from the top.

## Not the governance trail

The console's governance module has its own audit page (`AuditRow`, `/administration/audit`) built
for a trail this API does not keep — summaries, field sensitivity, sources, recorded values behind
`audit.view-detail`. It stays unserved (`DL-164`). This screen has its own model, port and route, and
`check:platform-audit` fails if the module names the governance trail's.

## Access

`audit.view` is the API's key and was already the console's (the governance trail's). The server
gives it to administrators alone. In the mock the MSWDO head and the auditor also hold it — for the
governance page, where `DL-114` put it — so in `local-mock` they open this screen too; against the API
only an administrator receives the key. The route and the menu entry ask for it.

## Checks

`check:platform-audit` (in `verify`): a row holds exactly the six things; the mapper reads exactly
the six fields; the page injects one port; the module names neither the governance trail's port nor
its rows; an undescribed code is said to be so and every code is shown; the page says no value is
kept; nothing in web storage or the console; the route and menu ask for `audit.view`. Planted
regressions, each caught, every file restored.

## Known gaps (the backend's)

- **No values and no reasons** in the trail — by design here, but it means the trail cannot answer
  "what was the role before?" or "why was this card suspended?".
- **No filter** by actor, action, record or date: the trail is read from the newest down.
- **`app.config_updated` names no setting** (`DL-170`).
- **Not run against a live API.** Built and tested against the vendored spec and composed fixtures.
