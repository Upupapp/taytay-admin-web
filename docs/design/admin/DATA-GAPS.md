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
| VerificationQueue | KPI row: oldest waiting, decided last 7 days (approved / rejected), sent last 7 days by day | `GET admin/verification-requests` `meta.stats` |
| CitizensOverview | Citizens on the registry — 12-month line | `GET office/residents/summary`: `residents.by_month[]` |
| CitizensOverview | From the registry to a Digital ID — funnel under the page filter | summary: `funnel { on_registry, on_app, verified, active_ids }` |
| CitizensOverview | This month — turning 60, leaving the children's count, Solo Parent IDs due, PWD IDs expiring | summary: `this_month {}` |
| SectorSeniors / PWD / SoloParents | Needs attention — milestone birthdays, centenarians, pension waitlist, no sector ID on file | summary with `sector=`: `attention[]` |
| SectorSeniors / PWD / SoloParents, CitizenRegistry | "App and Digital ID" column per row | `OfficeResident`: `app_account { verified, digital_id_status }` |

## Sent by the API but not shown yet (UI work only)

| Board | Panel | Already in |
|---|---|---|
| SectorSeniors / PWD / SoloParents | KPI row, by barangay, age bands | `GET office/residents/summary?sector=` (`residents`, `by_barangay`, `by_age_sex`) |
| SectorSeniors / PWD / SoloParents | Sector ID, social pension, disability type, validity columns | `OfficeResident.sector_details[]` |
| CitizensOverview | KPI deltas (↑ / ↓ beside each figure) | summary `residents.current/previous`, `registered.current/previous` |
| CitizensOverview | Recent imports | `GET office/imports` |
