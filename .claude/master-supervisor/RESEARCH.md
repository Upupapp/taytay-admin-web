# Research Record

## Standing condition of this run: no network retrieval

This environment has no outbound network access. Every external source cited by
this project was **supplied by the supervisor from prior knowledge and has not
been fetched here**.

The project handles that honestly rather than quietly, and the rule is written
into `CLAUDE.md` §6:

- Every source record carries `verifiedOn: null` until somebody actually
  retrieves it.
- The screens that render a source **say on screen** that it is unverified —
  e.g. a review window still marked `convention-pending-confirmation` shows that
  state to staff rather than presenting itself as confirmed policy.
- Decision-log entries that rest on unfetched sources label them in the entry
  itself.

This matters most for the programme responsibility records (`DL-65`), where the
claim "AICS is a DSWD programme with DSWD-disbursed funds" is doing real work:
it changes what the office tells an applicant. It is recorded as researched but
unverified, not as checked.

**A TAB that turns on the precise wording of any source below must retrieve the
primary text first.**

## Sources relied on, by domain

Recorded as given; none retrieved in this run.

### DSWD — assistance programmes and case management

| Supports | Source |
| --- | --- |
| AICS is a DSWD service | https://aics.dswd.gov.ph/aics-program/ |
| AICS/AKAP funds are agency-disbursed; LGU and legislator referrals remain subject to DSWD assessment | https://aics.dswd.gov.ph/2024/11/akap-aics-are-dswd-programs-with-agency-disbursed-funds-dswd-chief/ |
| AICS serves cases especially where LGUs cannot accommodate them | https://caraga.dswd.gov.ph/programs-and-projects/assistance-to-individuals-in-crisis-situation-aics/ |
| Screening and database cross-match, then interview and assessment by a licensed social worker | https://dswd.gov.ph/request-for-assistance-under-aics-now-easier-for-clients-dswd/ |
| Referrals remain subject to licensed social-worker assessment and validation | https://www.dswd.gov.ph/aics-and-akap-benefitted-countless-poor-pinoys-dswd-chief-dismisses-claims-the-2-programs-are-being-used-for-political-ends/ |
| Closure occurs when the client's needs are met | https://fo1.dswd.gov.ph/pwds/ |
| Aftercare / turnover once an intervention plan is completed | https://www.dswd.gov.ph/dswd-rolls-out-case-management-system-for-former-rebels-conflict-hit-families-in-zambopen/ |

### National Privacy Commission — Data Privacy Act

| Supports | Source |
| --- | --- |
| Purpose limitation, minimisation, retention only as necessary | https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/ |
| Controlled access, auditability, archival obligations in government agencies | https://privacy.gov.ph/npc-circular-16-01-security-of-personal-data-in-government-agencies/ |
| Notice duties for automated decision-making and profiling — logic and consequences | https://privacy.gov.ph/the-right-to-be-informed/ |
| LGU systems with automated decision-making require DPA compliance | https://privacy.gov.ph/npc-commends-new-dilg-issuance-enhancing-data-privacy-compliance-among-lgus/ |

The NPC sources are why the application **does not decide**: not deciding avoids
incurring the disclosure duties that attach to automated decision-making, and it
is the cheaper as well as the more defensible design.

### Statistics and thresholds

| Supports | Source |
| --- | --- |
| Poverty threshold used by the household indicators — sourced, not invented (`DL-45`/`DL-46`) | PSA official poverty statistics |

### Branding

| Supports | Source |
| --- | --- |
| Official seal and its colour language; restriction on alteration | Municipality of Taytay, Rizal — Ordinance No. 753 s. 2022 |

### Accessibility and government service patterns

| Supports | Source |
| --- | --- |
| WCAG 2.2 AA target | W3C WCAG 2.2 |
| Accessible labels, validation and status messages | W3C WAI form guidance |
| Accessible service patterns, forms, tables, data visualisation | GOV.UK Design System; U.S. Web Design System |

## Open research debt

1. **Retrieve and verify the DSWD AICS pages** — the responsibility records rest
   on them and they change what staff tell applicants.
2. **Retrieve NPC Circular 16-01 and the DPA IRR** before any TAB that sets
   retention periods or export rules (TAB 19 exports, TAB 21 governance).
3. **Confirm the review windows** currently marked
   `convention-pending-confirmation` (`DL-68`) against an office issuance.
