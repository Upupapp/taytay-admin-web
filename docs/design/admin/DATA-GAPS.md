# Data gaps — board panels waiting on the API

A board panel whose data the API does not send is left out of the page, the grid around it
re-balanced, and listed here (`DL-230`). A panel the console already has keeps its empty or
not-connected state. `/match-board` adds lines; a backend change that closes one deletes it.

Checked against `openapi.json` at backend `2472fdb`. Every other row of the first table was built by
the backend (its ADR 0006) and is drawn (`DL-232`); every row of the second table is drawn.

## Not sent by the API — won't build

The backend decided these three will not be built, and why (ADR 0006). They stay out of the page.

| Board | Panel | Why the API will not send it |
|---|---|---|
| CitizensOverview | KPI row: the "compared with last month" chip on "On the residents' app" and "Active Digital IDs" | Neither a link nor a card keeps its state at an earlier instant — a relink moves a link, and a card keeps only its current status, its acts living in the audit trail — so a figure "as the period began" would be a reconstruction that could disagree with the lists. The two tiles show their figure with no comparison. |
| SectorSeniors | Needs attention: the social pension waitlist | Nothing in the registry records a waitlist; one inferred from "senior without a pension" would be a claim nobody made. |
| SectorSoloParents | Children in their care — 1, 2, 3, 4 or more (and the "Children" column) | Nothing records the children in a solo parent's care: family relationships record parentage, not care or dependency. A field for it is a registry change the office would have to ask for. The panel says so with `<app-not-connected figure="children-in-care">`. |

## Sent by the API but not shown yet (UI work only)

None. The Residents board's figures above the list (KPI row, by barangay, by age group) are not a
gap: the newer CitizenRegistry board draws the same `/residents` page without them, and Citizen
overview draws them (`DL-230`).
