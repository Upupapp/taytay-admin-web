# App settings

The Taytay app's settings, as every resident's app reads them: the LGU's **contact line** and
**support email**, the **terms** and **privacy notice** versions residents must have accepted, the
**oldest app version** allowed, and the app's **feature flags**. Read through `GET app/config`
(public — every app reads it, signed in or not) and changed through `PATCH admin/app/config`, admin
only on the server (`app-config.manage`). Built on what the Node API serves (`DL-164`, `DL-170`).

## The things to understand first

### 1. One change reaches every resident, and two kinds can stop them using the app

"Residents see this in the Taytay app" is the page's subtitle. A newer **oldest app version** can
force every resident whose app is older to update before using it — and a resident who cannot update
may be unable to use the app at all. A new **terms** or **privacy** version can make every resident
accept again. So:

- **Every change is reviewed.** "Review the change" opens a confirmation listing what it does
  (`appConfigEffects`), the changes that reach every resident first. Nothing is sent before it.
- **A change that can stop residents is acknowledged.** For those (`asksEveryResident`: a newer
  oldest version, any new terms or privacy version) the confirmation adds a box — "I understand this
  can stop residents using the app until they update it or accept again" — and the button that saves
  stays disabled until it is ticked. The method refuses without it as well.

### 2. What the server does, and what it does not

Read from the backend at `2736e28` (`src/modules/app-config/routes.ts`, `schemas.ts`,
`repository.ts`; `src/modules/users/routes.ts`):

| | |
| --- | --- |
| Enforcement | **None on the server.** Nothing refuses an old app, and nothing compares a resident's accepted version (`POST me/consents`) with these. The app is given the values and decides — the console says what a change **can** make it do, because it cannot see what the app does. |
| The privacy notice | Served by the API from its own record (version, date, text) and **changed by no route**. The screen shows its version and date beside the privacy version, says its text is not changed here, and warns when residents would be asked to accept a version other than the one the API serves — a notice they cannot read. |
| Clearing | An emptied field is sent as `null`, which clears the setting; a deleted flag is sent as `null`, which deletes it. Only what changed is sent. |
| Audit | One entry, `app.config_updated`, saying a change was made and by whom — **not which setting**, and no reason, so none is asked for. |
| Limits | Contact line as a hotline number; email up to 200; terms and privacy versions up to 32 characters; the oldest version as two to four dot-joined numbers, **up to 20 characters** (the column's check — a longer one passes the API's pattern and fails in the database); flag names `^[a-z][a-z0-9_]{0,39}$`, values 1–200 characters, at most 50 flag changes at once. All checked before the review opens. |

### 3. Feature flags are not secret

`GET app/config` is public, so the screen says so above the flags: never put a password or a key in
one. What each flag does is the app's, which this console cannot see; the effects say that much.

## After a save

The settings are read again from the server, never patched, and the outcome is announced in the
page's live region. A refusal stays in the confirmation, in the server's words.

## Access

`app-config.manage` is the API's own key, added to `PERMISSIONS` unchanged (`DL-122`): the
administrator's alone, named by no role, mutating. The route and the menu entry ask for it.

## Checks

`check:app-settings` (in `verify`): the title says residents see it; the change is sent once, from
`confirm`, which refuses outside the review and without a needed acknowledgement, and `review` sends
nothing; the confirmation lists the effects and the acknowledgement before its button, which is
disabled until the box is ticked; the effects still say a newer version can force an update and a new
version can make residents accept again, the notice's text is not changed here and the server records
no setting; `asksEveryResident` covers all three; the flags said not secret and the notice's text
never read; nothing logged or stored; the key the administrator's. Fifteen planted regressions, each
caught, every file restored byte for byte.

## Known gaps

- **The privacy notice's text cannot be changed through the API.** It is a placeholder until somebody
  edits the database; changing the privacy version alone asks residents to accept a notice whose text
  did not change.
- **The audit entry names no setting**, so the trail cannot say who raised the oldest version.
- **A minimum version longer than 20 characters** passes the API's validation and fails the column's check.
- **Not run against a live API.** Built and tested against the vendored spec and composed fixtures.
