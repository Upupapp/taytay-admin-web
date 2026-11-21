# Data gaps — board panels waiting on the API

A board panel whose data the API does not send is left out of the page, the grid around it
re-balanced, and listed here (`DL-230`). A panel the console already has keeps its empty or
not-connected state. `/match-board` adds lines; a backend change that closes one deletes it.

Checked against `openapi.json` at console `1eadbc0`.

## Not sent by the API

| Board | Panel | Needs |
|---|---|---|
| Main | Requests received — weekly line, last 8 weeks, "this week / on last week" | `GET office/dashboard`: `requests.received_by_week[]` |
| Main | Releases handed over — by day, last 7 days | `GET office/dashboard`: `payouts.handed_over_by_day[]` |
| VerificationQueue | KPI row: awaiting review (the list sends cursors and no total, `DL-161`), oldest waiting with its sent time, decided last 7 days (approved / rejected), sent last 7 days by day | `GET admin/verification-requests` `meta.stats { pending, oldest_pending_at, decided_7d { approved, rejected }, sent_by_day[7] }` |
| CitizensOverview | Citizens on the registry — 12-month line | `GET office/residents/summary`: `residents.by_month[]` |
| CitizensOverview | From the registry to a Digital ID — funnel under the page filter | summary: `funnel { on_registry, on_app, verified, active_ids }` |
| CitizensOverview | This month — turning 60, leaving the children's count, Solo Parent IDs due, PWD IDs expiring | summary: `this_month {}` |
| CitizensOverview | KPI row: "On the residents' app" and "Active Digital IDs" under the page filter | summary: `app_accounts { current, previous, verified }`, `digital_ids { active, previous }` |
| CitizensOverview | Age and sex: female and male totals under the pyramid | summary: `by_age_sex.total_by_sex { female, male }`, taken before suppression |
| SectorSeniors / PWD / SoloParents | Needs attention — milestone birthdays, centenarians, pension waitlist, no sector ID on file | summary with `sector=`: `attention[]` |
| SectorSeniors / PWD / SoloParents, CitizenRegistry | "App and Digital ID" column per row | `OfficeResident`: `app_account { verified, digital_id_status }` |
| CitizenRegistry | "Household" column per row | `OfficeResident`: `household_reference` |
| SectorSeniors / PWD / SoloParents | Benefits and IDs (IDs and services, IDs and support) — sector ID on file, social pension, on the app, Digital ID, each of the sector | summary with `sector=`: `coverage { sector_id_on_file, social_pension, app_accounts, digital_ids }` |
| SectorPWD | Type of disability — count per type | summary with `sector=pwd`: `by_disability_type[]` |
| SectorSoloParents | Children in their care — 1, 2, 3, 4 or more | summary with `sector=solo-parent`: `by_children_in_care[]` |
| CitizenIDs | From sign-up to card — signed up on the app, sent an ID for review (oldest waiting), verified residents, ahead of the card stages | `GET admin/digital-ids` `meta.funnel { app_accounts, pending_verification, oldest_pending_at, verified }` |
| CitizenIDs | "Verified, no card" tab, its count and its rows, each with "Issue a card" | `GET admin/digital-ids?status=no-card` (verified accounts holding no card) or `GET admin/users?verified=true&card=none`, with a count in `meta.counts` |
| CitizenIDs | Email under the holder's name; "Verified" column | `DigitalIdListItem.holder { email, verified_at }` |
| CitizenIDRecord | Facts: card photo (approved selfie or card photo), times checked | `GET admin/users/{id}/digital-id`: `photo_source`, `checks_count` |
| CitizenIDRecord | Card history — checked, issued, suspended, replaced, with when and by whom (the panel keeps its not-connected state) | `GET admin/digital-ids/{id}/events[]` from the app audit trail |
| CitizenIDRecord | Under the name: purok, verified date and the ID type verified with | `GET admin/users/{id}/digital-id`: `holder { purok_or_sitio, verified_at, id_type }` |
| CitizenImport | "Where is the list from?" — RBI or census, OSCA, PDAO, solo parent, 4Ps, another spreadsheet (the upload panel takes the row) | `POST office/imports` multipart: `source` (the API takes `file` only) |
| CitizenImport | "Barangay this list covers" under the file | `POST office/imports` multipart: `barangay_id` |
| CitizenImport | Past imports: Source column | `GET office/imports` item: `source` |

## Sent by the API but not shown yet (UI work only)

| Board | Panel | Already in |
|---|---|---|
| SectorSeniors / PWD / SoloParents | KPI row, by barangay, age bands | `GET office/residents/summary?sector=` (`residents`, `by_barangay`, `by_age_sex`) |
| SectorSeniors / PWD / SoloParents | Sector ID, social pension, disability type, validity columns | `OfficeResident.sector_details[]` |
| CitizensOverview | Recent imports | `GET office/imports` |
| CitizenRegistry | A count on each sector tab | `GET office/residents/summary` (`by_sector`) |
| CitizenRegistry | Purok under the barangay; birth date and sex under the name; "Updated" column | `OfficeResident` (`purok_or_sitio`, `birth_date`, `sex`, `updated_at`) |
| Residents | Above the list: KPI row (active records, senior citizens, persons with disability, solo parents), active records by barangay, active records by age group. The newer CitizenRegistry board draws the same `/residents` page without them, and Citizens overview shows them | `GET office/residents/summary` (`residents`, `by_sector`, `by_barangay`, `by_age_sex`) |
