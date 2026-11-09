# System overview

## What the platform does, and for whom

The platform is the Municipality of Taytay's digital service for its residents and for the
Municipal Social Welfare and Development Office (MSWDO).

- **Residents** use the app "Taytay" to create an account, verify their identity, hold a digital
  ID, find municipal offices and hotlines, read Balita (news) and Tulong (help) pages, message an
  office once verified, and request documents from an office.
- **MSWDO staff and platform administrators** use the staff console in a web browser to review
  residents' IDs, run the app's content, answer the office inbox, work residents' document
  requests, and run assistance casework from intake to payout.

## The three parts

| Part                    | Repository          | Technology                                     | Who uses it                                                                                                                                   | What it does                                                                           |
| ----------------------- | ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Residents' app "Taytay" | `taytay-mobile-app` | Flutter (Android and iOS), `ph.gov.taytay.app` | Residents, as a guest, signed in but not yet verified, or verified                                                                            | Everything a resident does. It has no staff features, by design                        |
| Staff console           | `taytay-admin-web`  | Angular 22 web application                     | MSWDO staff: intake officers, social workers, the MSWDO head, release officers, barangay focal persons, auditors, and platform administrators | Everything staff do. It has no resident features, by design                            |
| API (server)            | `taytay-backend`    | Node 20, Express, PostgreSQL                   | Both apps. Nobody uses it directly                                                                                                            | Stores all data, checks every permission, and is the only authority on what is allowed |

Both apps are clients only. Neither holds a business rule that money or eligibility depends on;
the API decides, and re-checks every permission whatever the app shows.

## How the parts connect

```text
  Residents' app "Taytay"                         Staff console
  (Android / iOS)                                 (web browser)
        |                                               |
        |  1. sign in with e-mail and password          |
        +-------------------> Firebase Auth <-----------+
        |   (returns a short-lived ID token)            |
        |                                               |
        |  2. every request: HTTPS + the ID token       |
        +--------------------> API /api/v1 <------------+
                              (Node 20, Express)
                                     |
          +-------------+------------+-------------+-----------------+
          |             |                          |                 |
     PostgreSQL     File storage            Firebase Auth       E-mail (SMTP)
     (all records)  (ID pictures,           (checks each        (sign-up and
                    covers, uploads)        token; sign-in      reset codes;
                                            only)               not yet chosen)
```

- **Firebase is used for sign-in only.** No Firestore, Realtime Database or Firebase Storage. The
  API verifies the token and reads the account's role from its own database.
- **File storage** is a private Linode Object Storage bucket in production. On staging it is a
  Docker volume on the server. Files are never served from a public bucket address.
- **E-mail** sends only sign-up and password-reset codes. Staging sends none
  (`EMAIL_SENDER=mock`), and no sender has been chosen for production.
- The staff console keeps the sign-in token in memory only, never in browser storage, so
  reloading the page signs the user out. This is deliberate.

## Main modules and which part serves each

"Console" gives the console's address path. "Served" means the API answers for it today. Every
console module is served since 9 November 2026, when the newsfeed, the last that was not, was
retired in favour of Balita (`DL-194`); a module that is not served would be hidden from the
console's menu on staging and named on its "Not connected yet" page.

| Module                                                     | Residents' app                                          | Staff console                                  | Served by the API        |
| ---------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------- | ------------------------ |
| Account, sign-in, registration                             | Yes                                                     | —                                              | Yes                      |
| ID verification                                            | Submits ID and selfie                                   | `/verification`                                | Yes                      |
| Digital ID                                                 | Holds and shows the card                                | `/digital-ids` (check a card, suspend, revoke) | Yes                      |
| Directory: offices, hotlines, Tulong pages                 | Reads                                                   | `/directory`                                   | Yes                      |
| Home screen and app settings, Terms of Use, privacy notice | Reads, accepts                                          | `/home-screen`, `/app-settings`                | Yes                      |
| Balita (news)                                              | Reads                                                   | `/balita`                                      | Yes                      |
| Office inbox                                               | Verified residents write                                | `/inbox`                                       | Yes                      |
| In-app notifications                                       | Yes                                                     | `/notifications`                               | Yes (no push sender yet) |
| Users and roles                                            | —                                                       | `/users`                                       | Yes                      |
| The app's audit trail                                      | —                                                       | `/app-audit`                                   | Yes                      |
| Residents' document requests                               | Catalogue, form, "My document requests"                 | `/resident-documents`                          | Yes                      |
| Office registry: residents, households, families           | —                                                       | `/residents`, `/households`, `/families`       | Yes                      |
| Programmes                                                 | —                                                       | `/programs`                                    | Yes                      |
| Assistance requests, intake to release                     | Not offered (applying from the app waits on a decision) | `/assistance-requests`                         | Yes                      |
| Cases                                                      | —                                                       | `/cases`                                       | Yes                      |
| Releases and payout sessions                               | —                                                       | `/releases`                                    | Yes                      |
| Referrals and field visits                                 | —                                                       | `/referrals`, `/visits`                        | Yes                      |
| Dashboard                                                  | —                                                       | `/dashboard`                                   | Yes                      |
| Beneficiary registry and duplicate review                  | —                                                       | `/beneficiaries`                               | Yes (`DL-187`)           |
| Work queues                                                | —                                                       | `/work`                                        | Yes (`DL-189`)           |
| Reports                                                    | —                                                       | `/reports`                                     | Yes (`DL-190`)           |
| Search                                                     | —                                                       | `/search`                                      | Yes (`DL-189`)           |
| Governance: staff, the audit trail, retention, corrections | —                                                       | `/administration`                              | Yes (`DL-191`)           |
| Events                                                     | Reads, registers                                        | `/events`                                      | Yes (`DL-192`)           |
| Newsfeed                                                   | —                                                       | Retired (`DL-194`); news is Balita             | —                        |

Sample data runs only in the console's `local-mock` configuration, for design and demonstration,
and never stands in for a missing server on staging or production. What the API does not serve is
listed in `UNSERVED_HTTP_PORTS` in `src/app/data/http/unserved-repositories.ts`, which is empty.

## Design rules, in plain words

These rules are deliberate. Each is recorded in a decision (`DL-…`) and most are enforced by a
repository check that fails the build if the code breaks them. A successor developer should not
"fix" them without a new, recorded decision.

### The software never decides eligibility

The platform shows evidence; a person decides. Intake checks for duplicates and previous
assistance, household vulnerability indicators, programme guidelines, requirement checklists and
office alerts all advise and never block. None of them carries a score, an "eligible" flag or a
recommendation (`DL-42`, `DL-60`, `DL-66`, `DL-78`, `DL-98`). The system also invents no office
policy: review windows, the small-count threshold, retention periods and service standards are
the office's to supply, and the screens say so until they are.

### Money is in whole centavos

Every amount is held as a whole number of centavos and formatted only when it is shown. There is
no decimal arithmetic on money anywhere. Goods handed over are counted, never given an invented
value (`DL-93`). A release is tracked, not posted: there is no ledger, chart of accounts or bank
link (`DL-89`). No single office role can both approve a request and release its money, and the
server enforces that (`DL-173`).

### Records are added to, with reasons, not overwritten

A material change to a case, a document, a relationship or a field visit is recorded as a new
entry with who, when and why; earlier entries are kept. A closed case stays closed, and a
recurring situation is a new case that names the old one (`DL-53`, `DL-54`). Replacing a
document keeps the old version and asks for a reason (`DL-77`). A correction to a record is
raised, considered and answered, never applied silently (`DL-117`).

### Privacy under the Data Privacy Act of 2012 (RA 10173)

- **Only what is needed** is collected, and every field has a stated purpose.
- **PhilSys (RA 11055):** only the last four digits of a PhilSys number are ever held or shown.
- **Sensitive records** (for example survivors of violence against women and children, RA 9262,
  and children in conflict with the law, RA 9344) are withheld by the server from roles without
  the right permission, so a screen cannot show what it never received (`DL-38`).
- **No personal data in logs**, error messages or analytics; the API redacts its logs.
- **The audit trail says what changed, not what it changed to.** The old and new values are a
  separate read for the auditor (`DL-114`).
- **Reports withhold small counts** that could identify a person (`DL-105`).
- **Anything that leaves the building** (a referral summary, a payout list, an export) is
  composed to the minimum, and a referral cannot be sent without a recorded lawful basis
  (`DL-81`, `DL-92`, `DL-106`, `DL-140`).
- **Staging holds test data only** (requirement NFR-PRIV-15). It shares a server with other
  systems and keeps its backups on that machine.

The legal duties themselves (privacy notice, Data Privacy Officer, registration with the National
Privacy Commission, retention schedule, breach procedure) belong to the LGU. They are listed in
§5.1 of the requirements document and in
[known-limitations-and-open-items.md](known-limitations-and-open-items.md).
