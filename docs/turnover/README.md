# Turnover package: Taytay, Rizal LGU platform

This folder is deliverable **D12, "Turnover package"** (item 13 on the project's deliverables
tracker), and the procedure for deliverable **D13, "30-day corrective warranty"** (item 14). It
lists what the Local Government Unit (LGU) of Taytay, Rizal receives to own and run the platform,
where each item is, and what is still open.

Prepared on 2026-11-07. Read it with these facts in mind:

- **Production does not exist yet.** Only the staging environment runs. Everything about
  production in this package is what must be supplied and done, not what exists.
- **The launch gate is NO-GO** (`docs/integration/launch-gate.md`). Handing over this package does
  not mean the platform is ready for real residents.
- **The requirements document is not approved.** Version 1.3 of
  `docs/project/requirements-and-implementation-plan.md` is "Prepared for approval"; its §9 is
  unsigned apart from a placeholder for the owner.
- **No password, key or token is written anywhere in this package.** Credentials are handed over
  through the LGU's own channel, never in a document (requirements D12 and NFR-SEC-6).

People named here: **Michaela Angela E. Cailing**, the owner, who commissions the platform and
authorises pushes and any production deployment; and **Paul Espinas**, the project lead, who is to
supply the production infrastructure and the store-signing items.

## Files in this folder

| File                                                                         | What it is for                                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [system-overview.md](system-overview.md)                                     | What the platform does, its three parts, its modules and its design rules  |
| [repositories-and-releases.md](repositories-and-releases.md)                 | The three repositories, their latest commits, how to build and test each   |
| [environments-and-hosting.md](environments-and-hosting.md)                   | Staging as it is today, and what production needs                          |
| [operations-runbook.md](operations-runbook.md)                               | Deploy, migrate, roll back, check health, back up, rotate keys, recover    |
| [accounts-and-credentials-register.md](accounts-and-credentials-register.md) | Every account and secret the platform depends on, described without values |
| [known-limitations-and-open-items.md](known-limitations-and-open-items.md)   | What is not built, not decided, not served, or not yet proven              |
| [warranty-procedure.md](warranty-procedure.md)                               | How defects are reported, classified, fixed and closed in the warranty     |
| [acceptance-certificate.md](acceptance-certificate.md)                       | A blank turnover acceptance form (template)                                |

## Items handed over

Paths without a repository name are in `taytay-admin-web`. Fill in the last three columns at the
handover meeting. Leave a row blank, and say why in the acceptance certificate, if the item is not
received.

| #   | Item                              | What it is                                                                                                                                             | Where it is                                                                                                                                                                                                              | Handed over? | Received by | Date |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ----------- | ---- |
| 1   | Source code: staff console        | Angular 22 web application used by MSWDO staff and platform administrators                                                                             | https://github.com/Upupapp/taytay-admin-web, branch `main`                                                                                                                                                               |              |             |      |
| 2   | Source code: API                  | Node 20 / Express / PostgreSQL service; the retired Laravel code survives only at the tag `laravel-archive`                                            | https://github.com/Upupapp/taytay-backend, branch `main`                                                                                                                                                                 |              |             |      |
| 3   | Source code: residents' app       | Flutter app "Taytay", package `ph.gov.taytay.app`, for Android and iOS                                                                                 | https://github.com/Upupapp/taytay-mobile-app, branch `main`                                                                                                                                                              |              |             |      |
| 4   | Requirements and plan             | Requirements and implementation plan, version 1.3, **not approved**                                                                                    | `docs/project/requirements-and-implementation-plan.md`                                                                                                                                                                   |              |             |      |
| 5   | Design decisions                  | Why the platform behaves as it does: decision log entries (`DL-…`) and architecture decision records                                                   | `CLAUDE.md` in each repository · `docs/reference-audit/decision-log.md` · `docs/adr/` · `taytay-backend/docs/adr/` · `taytay-mobile-app/docs/mobile-ui-decision-log.md`                                                  |              |             |      |
| 6   | API reference                     | The OpenAPI document (also served by the API at `GET /docs`) and the endpoint notes                                                                    | `taytay-backend/openapi/openapi.json` · `taytay-backend/docs/api/endpoints.md`                                                                                                                                           |              |             |      |
| 7   | System overview                   | Plain-language description for the LGU and a successor developer                                                                                       | [system-overview.md](system-overview.md)                                                                                                                                                                                 |              |             |      |
| 8   | Repositories and build guide      | Repository list, commits as of 2026-11-07, build and test commands, local quality gates                                                                | [repositories-and-releases.md](repositories-and-releases.md)                                                                                                                                                             |              |             |      |
| 9   | Environments                      | Staging as deployed; production requirements and who supplies each                                                                                     | [environments-and-hosting.md](environments-and-hosting.md)                                                                                                                                                               |              |             |      |
| 10  | Runbooks                          | Day-to-day operations, and the source runbooks they are taken from                                                                                     | [operations-runbook.md](operations-runbook.md) · `taytay-backend/deploy/staging-shared-linode/README.md` · `taytay-backend/docs/deploy-linode.md` · `taytay-mobile-app/docs/release.md` · `docs/integration/rollback.md` |              |             |      |
| 11  | Accounts and credentials register | Every account and secret, who holds it, where it is kept, how to rotate it. **No values**                                                              | [accounts-and-credentials-register.md](accounts-and-credentials-register.md)                                                                                                                                             |              |             |      |
| 12  | Credentials themselves            | Handed over in person or through the LGU's own secure channel, one by one against the register                                                         | Not in any document or repository                                                                                                                                                                                        |              |             |      |
| 13  | Test evidence: UAT pack           | 151 user acceptance test cases in 14 areas (v1.1 added Document Request), instructions, and a blank sign-off sheet. **No round has been run**          | `docs/uat/README.md` · `docs/uat/uat-test-scripts.md` · `docs/uat/uat-signoff.md`                                                                                                                                        |              |             |      |
| 14  | Test evidence: automated tests    | Unit, component and contract tests and repository checks, run locally before every push                                                                | Each repository (see [repositories-and-releases.md](repositories-and-releases.md)) · `docs/qa/README.md`                                                                                                                 |              |             |      |
| 15  | Test evidence: launch gate        | Engineering assessment of go-live conditions. Measured 2026-08-29, **NO-GO**; lines 13 and 18 updated for staging on 2026-11-07; due to be re-measured | `docs/integration/launch-gate.md`                                                                                                                                                                                        |              |             |      |
| 16  | Orientation records               | Guides and attendance records for deliverables D8 to D11 (being written in parallel with this package)                                                 | [docs/orientation/](../orientation/)                                                                                                                                                                                     |              |             |      |
| 17  | Open items                        | Everything not built, not served, not decided or not proven                                                                                            | [known-limitations-and-open-items.md](known-limitations-and-open-items.md)                                                                                                                                               |              |             |      |
| 18  | Warranty procedure                | How the 30-day corrective warranty works. Its contractual terms are blanks                                                                             | [warranty-procedure.md](warranty-procedure.md)                                                                                                                                                                           |              |             |      |
| 19  | Acceptance certificate            | The form the LGU signs to acknowledge receipt (template)                                                                                               | [acceptance-certificate.md](acceptance-certificate.md)                                                                                                                                                                   |              |             |      |

## What this package does not do

- It does not approve the requirements document. That needs §9 of that document signed.
- It does not accept the platform. That is the UAT round and its sign-off (deliverable D6,
  `docs/uat/uat-signoff.md`).
- It does not authorise a production deployment. That needs the owner's separate written
  authorisation (deliverable D7; console `CLAUDE.md` §2, rule 9).
- It does not set contractual terms. The warranty's start date, response times, contacts and
  channels are blanks to be filled from the contract.
