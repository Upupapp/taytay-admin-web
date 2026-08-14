# Authentication, Roles & Permission-Aware UI (TAB 05)

How this console decides who someone is, and what they may do.

Decisions: `DL-30` (enforcement), `DL-31` (non-leaking denial), `DL-32` (no
self-registration), `DL-33` (accessible authentication) in
[`../reference-audit/decision-log.md`](../reference-audit/decision-log.md).
The matrix itself is in [`permission-matrix.md`](./permission-matrix.md).

> **This is a frontend mock.** It authenticates nobody. Its value is that the
> shape, the copy and the accessibility are right, so wiring a real API changes
> the adapter and nothing else. Do not mistake any of it for a security
> boundary.

---

## 1. The three layers, and which two protect

| Layer                | Mechanism                                                           | Protects?          |
| -------------------- | ------------------------------------------------------------------- | ------------------ |
| Navigation & actions | `AppNav` filter, `*appHasPermission`, `appDisableWithoutPermission` | **No** — usability |
| Routes               | `permissionGuard(...)`, `authenticatedGuard`, `anonymousOnlyGuard`  | Yes                |
| Data                 | `denyUnless(...)` in every mock repository, via `ACCESS_CONTEXT`    | Yes                |

The acceptance rule for this TAB is that a hidden action is _also_ refused at
the logic level. That is layer 3: the adapters re-check permission **and** data
scope before returning or changing anything.

`src/app/data/mock/access-enforcement.spec.ts` is the evidence. Every case
there drives the repository directly — no component, no template, no hidden
button — so a pass means the refusal survives a bypassed UI.

### Hide or disable?

Both exist because the right answer differs:

- **Hide** (`*appHasPermission`) when the control is irrelevant to the role. A
  disbursing officer has no use for an "Assess" button.
- **Disable** (`appDisableWithoutPermission`) when the control belongs to a
  workflow the user can see and is expected to understand. A social worker
  looking at a request they endorsed should see that "Approve" exists and is not
  theirs to press — hiding it makes the workflow look broken.

---

## 2. Sign-in

A credential form: work email plus password. **No self-registration** — there is
no route, and no `register` method on the port to call (`DL-32`).

### Accessibility (`DL-33`)

WCAG 3.3.8 treats remembering a password as a cognitive function test. This
screen relies on the **Mechanism** satisfier:

- `autocomplete="username"` and `"current-password"` so password managers fill it;
- paste is never blocked — no paste handler exists anywhere in the form;
- a show-password toggle for a manually typed password.

No CAPTCHA, puzzle or transcription step, and none may be added.

### What it will not tell you

Unknown address, wrong password and deactivated account all produce **the same
message**. Anything more specific would let the page be used to discover which
municipal staff addresses exist.

`returnUrl` is sanitised by `safeReturnUrl()` to same-origin absolute paths, so
the sign-in page cannot be turned into an open redirect.

### No password is stored here

The mock has nothing to verify a password against, so committing a fixture one
would be storing a credential for no benefit. It checks that the email belongs
to an active account and that the password is well-formed. `check:access` fails
the build if a credential literal appears anywhere in `src/`.

---

## 3. Denial discloses nothing (`DL-31`)

| Situation                            | What the user gets                                        |
| ------------------------------------ | --------------------------------------------------------- |
| Action without the permission        | Fixed message + the permission name. No record detail.    |
| Record outside the user's data scope | **`null` — identical to "does not exist"**                |
| Route without the permission         | `/forbidden`, with no `returnUrl` and no route in the URL |
| Transition without the permission    | Refused **before** the record is looked up                |

The last row matters more than it looks: checking permission first means a
refused caller cannot probe which ids exist by comparing "not found" against
"not permitted".

---

## 4. Session

`SessionState` holds _who is signed in_. `SessionStore` owns the transitions
(load, sign in, sign out). They are separate because the data adapters must read
the identity to enforce permission, and the store reads the adapters to resolve
it — one class doing both is a dependency cycle (`DL-30`).

The mock session starts **anonymous**. Nothing is signed in until someone signs
in, so the application exercises its real sign-in path rather than booting into
an authenticated shell.

---

## 5. Checks

```bash
npm run check:access   # matrix doc in step with code; no registration surface; no credentials
npm test               # matrix invariants, enforcement, guards, sign-in behaviour
npm run verify         # lint, typecheck, check:brand, check:shell, check:access, tests, build
```

`tools/check-access.mjs` was validated against two deliberately introduced
regressions (a renamed permission in the doc, and a committed password literal)
before being trusted.

---

## 6. Known gaps

- **The mock authenticates nobody.** Any well-formed password signs in a seeded
  address. Real verification belongs to the API.
- **No session expiry, refresh, lockout or rate limiting.** All are server
  concerns; none can be meaningfully implemented in a front end, and stubbing
  them would only look like security.
- **`assigned-cases` scope is not yet applied to lists.** A social worker
  currently sees all requests rather than their caseload — the domain models it
  (`isWithinBarangayScope` deliberately does not filter on it), but assignment
  filtering belongs with the assistance-request TAB that owns the workflow.
- **Password reset is described, not implemented** — it is an administrator task
  with no frontend surface.
