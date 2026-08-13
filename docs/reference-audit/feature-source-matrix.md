# Feature Source Matrix — Esperanza

Functional sourcing only. Nothing in this document licenses a visual or
technical choice; see [`experience-pattern-library.md`](./experience-pattern-library.md)
for design and [`decision-log.md`](./decision-log.md) for divergences.

Evidence base: `Upupapp/Esperanza-Web-Platform-frontend-` @
`f983ea4d7f8e00a19b0a50073478f240e301787b` (`main`). Paths below are relative to
that repository root.

**Reminder before using any row:** Esperanza has no controllers, models,
migrations or business logic (see [`README.md`](./README.md) finding 1). A row
citing an Esperanza view establishes _that a module exists and what it is
called_ — never how it behaves. Behaviour is this project's own decision and is
recorded in the decision log.

---

## 1. Scope boundary

Two whole areas of Esperanza are out of scope for this repository, and the
reason is the same in both cases: **this repository is the MSWDO staff console.**

| Excluded area                             | Esperanza evidence                                         | Belongs to                                                                              |
| ----------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Entire **Citizen Portal** (10 screens)    | `resources/views/citizen/*.blade.php`, routes `/citizen/*` | The resident-facing Flutter app (`Desktop\Taytay_Rizal_LGUIDS_Resident_Mobile_Flutter`) |
| All **persistence / auth / API** concerns | Absent from Esperanza by its own hard rule                 | The backend (`Desktop\Taytay_Rizal_LGUIDS_Backend`)                                     |

Building a citizen portal here would duplicate the mobile app and violate
`CLAUDE.md` §1. Citizen-side screens are still _read_ during this audit, because
they reveal what the staff side must produce — e.g. `citizen/status-guide`
tells us beneficiaries are shown a status explanation, which is why our
`StatusCatalog` carries a `description` per status.

**Esperanza is Municipality of Esperanza, Masbate (Region V), 20 barangays**
(`CLAUDE.md`, `config/esperanza.php`). This repository is Taytay, Rizal,
5 barangays. **No Esperanza reference data transfers** — not barangays, not
office names, not seeded content.

---

## 2. Matrix — modules this repository will build

Status key: **Built** (exists after TAB 01) · **Planned** (route + guard exist,
placeholder rendered) · **Deferred** (in mandate, no route yet) · **Excluded**.

| Id     | Our module                | Our route                  | Esperanza source                                                                                                                               | Relationship             | Status   |
| ------ | ------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------- |
| FSM-01 | Dashboard                 | `/dashboard`               | `resources/views/admin/dashboard.blade.php`                                                                                                    | Adopted, re-scoped       | Built    |
| FSM-02 | Residents registry        | `/residents`               | `admin/constituents.blade.php` + `admin/constituents/view-individuals.blade.php`                                                               | Adopted, renamed         | Built    |
| FSM-03 | Households & families     | `/residents` (sub-views)   | `admin/constituents/view-households.blade.php`, `view-families.blade.php`, `modal-household-detail.blade.php`, `modal-family-detail.blade.php` | Adopted, partial         | Deferred |
| FSM-04 | Resident profiling        | `/residents` (tab)         | `admin/constituents/tab-profiling.blade.php`, route `admin.resident-profiling`                                                                 | Adopted                  | Deferred |
| FSM-05 | Data quality & de-duping  | `/residents` (tab)         | `admin/constituents/tab-data-quality.blade.php`, `modal-dq-detail.blade.php`, `modal-merge.blade.php`                                          | Adopted                  | Deferred |
| FSM-06 | Record lifecycle          | `/residents` (action)      | `admin/constituents/modal-lifecycle.blade.php`                                                                                                 | Adopted                  | Deferred |
| FSM-07 | Assistance requests       | `/assistance-requests`     | `admin/assistance-requests.blade.php`                                                                                                          | Adopted, redesigned      | Planned  |
| FSM-08 | Programs                  | `/programs`                | _No Esperanza equivalent_                                                                                                                      | Our own addition         | Planned  |
| FSM-09 | Disbursements             | `/disbursements`           | _Not `admin/payments.blade.php`_ — see FSM-16                                                                                                  | Our own addition         | Planned  |
| FSM-10 | Referrals                 | `/referrals`               | _No Esperanza equivalent_                                                                                                                      | Our own addition         | Planned  |
| FSM-11 | Reports & analytics       | `/reports`                 | `admin/reports.blade.php`, routes `admin.reports` / `admin.analytics`                                                                          | Adopted                  | Planned  |
| FSM-12 | Staff, roles, permissions | `/administration/staff`    | `admin/users.blade.php`, `components/admin/permission-tree.blade.php`, routes `admin.users/roles/permissions`                                  | Adopted                  | Planned  |
| FSM-13 | Audit trail               | `/administration/audit`    | route `admin.audit-logs` (`admin/settings.blade.php`, tab `audit-logs`)                                                                        | Adopted, promoted        | Planned  |
| FSM-14 | Settings                  | `/administration/settings` | `admin/settings.blade.php` (tabs `general`, `branding`)                                                                                        | Adopted, reduced         | Planned  |
| FSM-15 | Disaster response         | _no route yet_             | `admin/sakuna.blade.php` + 10 tabs under `admin/partials/sakuna/`                                                                              | Adopted — see DL-11      | Deferred |
| FSM-16 | Payments (citizen→LGU)    | —                          | `admin/payments.blade.php`                                                                                                                     | **Excluded** — see DL-09 | Excluded |
| FSM-17 | Document requests         | —                          | `admin/document-requests.blade.php`                                                                                                            | **Excluded** — see DL-10 | Excluded |
| FSM-18 | Communications / balita   | —                          | `admin/communications.blade.php` (tabs `balita`, `offices`)                                                                                    | **Excluded** — see DL-10 | Excluded |
| FSM-19 | Internal office forms     | —                          | `admin/internal-forms.blade.php`                                                                                                               | **Excluded** — see DL-10 | Excluded |
| FSM-20 | Access-restricted screen  | `/forbidden`               | `components/admin/access-restricted.blade.php`                                                                                                 | Adopted                  | Built    |

Every row is either traceable to an Esperanza path or explicitly marked as this
project's own decision with a `DL-*` reference. There are no unsourced modules.

---

## 3. Field- and control-level detail worth carrying

Extracted from the Esperanza admin views. These are _candidate_ fields for the
TABs that build each module — each still has to pass the `CLAUDE.md` §6 data
minimisation test before it enters a domain model.

### Assistance requests (`admin/assistance-requests.blade.php`)

List columns: **Reference · Citizen · Assistance Type · Barangay · Handling
Office · Status · Submitted**, with a **Review** row action, 5 stat cards above
the table, and 2 modals.

- `Reference`, `Citizen`, `Barangay`, `Status`, `Submitted` → already modelled
  in TAB 01 as `referenceNumber`, `residentId`, `barangayId`, `status`,
  `submittedAt`.
- `Assistance Type` → modelled as `programId` (a stronger, catalogued form).
- **`Handling Office` is not yet modelled.** Esperanza routes a request to an
  owning office. Worth adopting when the assistance-request TAB runs — it is how
  a real LGU splits AICS between MSWDO, the Mayor's office and a hospital's
  medical social-welfare unit. Recorded as an open question, not yet a field.

### Constituents (`admin/constituents.blade.php`)

- **Verification state**: `Verified`, `Partially Verified`, `Unverified`,
  `For Validation`. Not modelled in TAB 01 — our `Resident` has only `isActive`.
  Strong candidate for a `StatusCatalog` of its own (see DL-12).
- **Sector tags**: `Senior Citizen`, `Solo Parent`, `Child`, `Youth` — a subset
  of our `VulnerabilitySector` union, which already covers these plus PWD, 4Ps,
  VAWC, CICL and others.
- **Filters**: All Barangays · All Tags · All Verification. Our residents list
  currently filters by barangay and free-text only; the tag and verification
  filters are the natural next additions.

### Dashboard (`admin/dashboard.blade.php`)

Tiles and regions: **Total Requests · Active Cases · Requests by Barangay ·
Key Alerts · Recent Activity**, plus **Export Report**, and module shortcuts
named **"Dokyu"** (documents) and **"Tulong"** (assistance).

- `Total Requests`, `Active Cases`, `Requests by Barangay` → already implemented
  in TAB 01's `DashboardSummary`.
- `Key Alerts` and `Recent Activity` → not yet modelled; `Recent Activity` maps
  naturally onto our existing `AuditEntry`.
- **Filipino module naming** (`Dokyu`, `Tulong`, `Sakuna`, `Balita`) is a real
  usability signal for LGU staff. Not adopted yet — see DL-18.

---

## 4. Esperanza's status vocabulary vs ours

Esperanza's `CLAUDE.md` mandates one universal 14-status set. Ours is a
per-workflow `StatusCatalog`. The mapping is recorded so that any later
integration or data migration has a reference:

| Esperanza status     | Our `AssistanceRequestStatus` | Note                                        |
| -------------------- | ----------------------------- | ------------------------------------------- |
| Draft                | `draft`                       | Same                                        |
| Submitted            | `submitted`                   | Same                                        |
| Pending Review       | `submitted`                   | We do not split "filed" from "queued"       |
| Under Verification   | `intake-review`               | Renamed for what the officer actually does  |
| Assigned             | `assessment`                  | We name the work, not the act of assigning  |
| Processing           | `assessment`                  | Collapsed                                   |
| Waiting Requirements | `returned`                    | Ours re-enters at `intake-review`           |
| —                    | `endorsed`                    | **Added by us** — see DL-04                 |
| Approved             | `approved`                    | Same                                        |
| Rejected             | `rejected`                    | Same (terminal)                             |
| Ready for Release    | `scheduled`                   | Ours carries a date and channel — see DL-05 |
| Released             | `released`                    | Same                                        |
| Completed            | `completed`                   | Same (terminal)                             |
| Cancelled            | `cancelled`                   | Same (terminal)                             |
| Archived             | —                             | Not adopted — see DL-06                     |
| —                    | `expired`                     | **Added by us** — see DL-06                 |

---

## 5. Get Hired — features considered and **not** imported

Recorded explicitly to satisfy the acceptance criterion that no feature is taken
from Get Hired merely because it exists there. Get Hired is a recruitment
product; none of the following has an MSWDO mandate.

| Get Hired feature      | Evidence (`src/app/…`)                                            | Why not imported                                                               |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Job posting & listings | `job/`, `jobs/`, `views/`                                         | No MSWDO mandate to advertise jobs. Employment referral goes to PESO (FSM-10). |
| Employer panel         | `employer-panel/` (155 files)                                     | No employer counterparty exists in social welfare.                             |
| Applicant panel        | `applicant/`, `applicant-panel/`                                  | The beneficiary-facing surface is the Flutter app.                             |
| Company profiles       | `company/`, `companies/`                                          | No analogue.                                                                   |
| Interview scheduling   | `interview/`                                                      | No analogue. Home visits are modelled on `SocialWorkerAssessment` instead.     |
| Video CV / recorder    | `recorder/`, `shared/components/video-preview`                    | Recording indigent residents would fail RA 10173 data minimisation outright.   |
| Subscriptions/billing  | `subscriptions/`                                                  | Government services are not monetised.                                         |
| Org chart              | `shared/components/reusable-org-chart`                            | Interesting, but no MSWDO need identified.                                     |
| Google Maps / address  | `@angular/google-maps`, `shared/components/google-address-search` | Sends resident addresses to a third party. Would need a DPA assessment first.  |
| Talent-proof badge     | `shared/components/talent-proof-badge`                            | Gamified credentialing; inappropriate for welfare claims.                      |
| Language selection     | `shared/components/language-selection`, `@ngx-translate`          | Deferred, not rejected — Filipino/English is a real LGU need. See DL-18.       |

The one Get Hired _concept_ that is adopted — application completeness — is
adopted as an **interaction pattern**, not as a feature import: see `EPL-04` and
`DL-13`.
