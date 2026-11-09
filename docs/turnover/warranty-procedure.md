# 30-day corrective warranty: procedure

This is the procedure for deliverable **D13, "30-day corrective warranty"** (item 14 on the
deliverables tracker): defects found in the 30 days after go-live are fixed. The requirements
document accepts D13 when "the 30 days have ended, and every defect reported in them is fixed or
accepted in writing as open" (§3.1).

**This document sets no contractual terms.** The start date, the response and fix times, the
names, the contacts and the channels come from the contract between the parties. Every such item
below is a blank, "________ per contract", to be filled in from the contract and initialled by both
sides. Where the contract says something different from this procedure, the contract wins.

## Terms to fill in from the contract

| Term                                                   | Value                 |
| ------------------------------------------------------ | --------------------- |
| Warranty start date (requirements D13: "at go-live")   | ________ per contract |
| Warranty end date                                      | ________ per contract |
| Which environments are covered (production; staging?)  | ________ per contract |
| Developer's contact for defect reports                 | ________ per contract |
| Developer's backup contact                             | ________ per contract |
| LGU's contact who files and confirms reports           | ________ per contract |
| Channel for reports (for example a shared log or form) | ________ per contract |
| Channel for urgent (Critical) reports                  | ________ per contract |
| Working hours in which the times below are counted     | ________ per contract |
| Time to acknowledge a report, per severity             | ________ per contract |
| Time to fix or give a workaround, per severity         | ________ per contract |
| Where the defect log is kept, and who may read it      | ________ per contract |
| Who authorises deploying a fix to production           | ________ per contract |

Deploying to production always needs the owner's authorisation (console `CLAUDE.md` §2, rule 9),
whatever the contract names as the channel for it.

## What counts as a defect

A **defect** is the system not doing what the **approved** requirements and the **UAT cases** say
it does. The baseline is:

- the requirements document, `docs/project/requirements-and-implementation-plan.md`, in the
  version signed under its §9 (version 1.4 is not yet signed);
- the UAT test cases in `docs/uat/uat-test-scripts.md`, as they were run and signed in
  `docs/uat/uat-signoff.md`;
- the design rules in [system-overview.md](system-overview.md), which are part of the requirements.

Examples of defects:

- a screen shows a wrong figure, status or amount;
- an action the requirements allow fails, or an action they forbid succeeds (for example one role
  both approving and releasing);
- a role sees personal data it must not see;
- a record or its history is lost, or a change is not recorded with its reason;
- a message misleads staff or residents about what happened (for example "saved" when nothing was
  saved);
- the system breaks one of its own privacy or audit rules.

## What does not count as a defect

These are handled as **change requests**, through the change control in §9.1 of the requirements
document, and are not covered by the corrective warranty:

- **New features**, or a feature listed as not built in
  [known-limitations-and-open-items.md](known-limitations-and-open-items.md).
- **Changes of policy or convention:** a different review window, threshold, retention period,
  role permission, wording of the Terms of Use or privacy notice, or office procedure.
- **Data entry:** wrong or missing data typed by a user, the document catalogue, the directory,
  programmes, or account and role assignments. These are corrected by an authorised user in the
  console, with a reason where the screen asks for one.
- **Items accepted as open in writing** at UAT sign-off or at turnover.
- **Behaviour the requirements choose on purpose**, for example the console signing a user out on
  reload, or advice that does not block (see [system-overview.md](system-overview.md)).

If the two sides disagree whether something is a defect, record both views in the log and settle
it by the means ________ per contract.

## How to report a defect

One report per defect. Check the defect log first; if it is already there, add to that entry.

A report contains:

| Field                 | What to write                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Defect id             | The next number in the log: WD-001, WD-002, and so on                                                              |
| Reported by, and date | Name, position, and the date of the report                                                                         |
| When it happened      | Date and time (Philippine time)                                                                                    |
| Where                 | Production or staging; the staff console or the residents' app (with the phone's model and Android or iOS version) |
| Role                  | The role of the account used (for example intake officer). **Never a password**                                    |
| Screen                | The page's address after the site name (for example `/assistance-requests`), or the app screen's title             |
| Steps                 | Numbered, exact steps from a starting point anyone can reach                                                       |
| Expected result       | What should have happened, with the requirement id (`FR-…`, `NFR-…`) or UAT case id (`REQ-05`) where known         |
| Actual result         | What happened instead, with any message **word for word**, and its reference (request id) if one is shown          |
| How often             | Every time, sometimes, or once                                                                                     |
| Effect                | Who is held up and how; whether there is a workaround                                                              |
| Proposed severity     | Critical, Major or Minor (below)                                                                                   |
| Screenshots           | Named after the defect id, **with no personal data** (rules below)                                                 |

### Screenshots without personal data

- Reproduce the problem on **staging with test data** where possible, and take the screenshot
  there. Staging's records are fictional (surname "Halimbawa"; `docs/uat/README.md`).
- If it happens only in production, cover every name, birth date, address, phone number, ID
  number, photo, signature, amount linked to a person and free-text note **before** the file is
  saved or sent. Cropping to the part that matters is better than covering.
- Never include a password, a sign-in code, a token, a QR code from a digital ID, or a picture of
  an ID document.
- Do not attach files a resident uploaded.

### If personal data may have been exposed

A suspected disclosure of personal data is not only a defect. Tell the **Data Privacy Officer at
once**, as well as the developer, so the LGU can meet the National Privacy Commission's deadlines.
The breach procedure is go-live item GL-16 and is not written yet; the requirements document
proposes (R-8) that the developer tells the DPO within 24 hours so the 72-hour NPC deadline can be
met. Record it in the log as Critical, but put no personal data in the log.

## Severity levels

The same three levels as the UAT round (`docs/uat/README.md`), so a defect keeps its meaning
from testing to warranty.

| Severity     | Plain definition                                                                                                                                                                                                                                   | Time to acknowledge   | Time to fix or work around |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------- |
| **Critical** | Data lost or wrong, amounts of money included; a role sees personal data it must not see; a role can do what it must not (for example approve and release); or a Must requirement cannot be used at all (for example nobody in a role can sign in) | ________ per contract | ________ per contract      |
| **Major**    | A Must or Should requirement fails but a workaround exists; a rule is broken (a wrong figure or status, a missing reason, a missing warning); or a message misleads staff or residents                                                             | ________ per contract | ________ per contract      |
| **Minor**    | Wording, layout or a typo that misleads nobody                                                                                                                                                                                                     | ________ per contract | ________ per contract      |

The reporter proposes a severity; the developer and the LGU's contact agree it. If they differ,
the higher one applies until they agree.

## From report to closure

| Step                       | Who                           | What happens                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Reported                | LGU                           | The report is entered in the defect log                                                                                                                                                                                                                                |
| 2. Acknowledged            | Developer                     | Confirms receipt and the agreed severity, within the time above                                                                                                                                                                                                        |
| 3. Classified              | Developer and LGU contact     | **Defect**, **not a defect** (with the reason, and pointed to change control if it is a change), or **cannot reproduce** (with what was tried; reopened if it recurs)                                                                                                  |
| 4. Fixed                   | Developer                     | The fix is made in the repository with a test that fails without it; the local gates pass (`npm run verify` for the console, `npm test` and `npm run typecheck` for the API, `flutter analyze` and `flutter test` for the app); the commit message names the defect id |
| 5. Verified on staging     | Reporter, or the LGU's tester | The fix is deployed to staging and the reporter repeats the original steps with test data. **Passed** or **failed** (back to step 4)                                                                                                                                   |
| 6. Deployed to production  | Developer, on authorisation   | Only with the owner's authorisation. The deployed commit hash and date are recorded                                                                                                                                                                                    |
| 7. Confirmed in production | LGU contact                   | Checks the fix in production without exposing personal data                                                                                                                                                                                                            |
| 8. Closed                  | Both                          | The log entry is closed with the date and both names                                                                                                                                                                                                                   |

A defect may instead be **accepted as open**, in writing, by the owner with the LGU's contact,
with the reason. A workaround given in step 4 does not close a defect; it only lowers the
urgency until the fix is closed.

Whether a defect reported within the period but not closed by its end stays covered afterwards:
________ per contract. (The requirements' D13 criterion expects every defect reported in the period
to be fixed or accepted in writing as open.)

## Defect log

Keep one log for the whole period, in the place agreed above. One row per defect. No personal
data, passwords or tokens in it.

| Defect id | Reported (date, by) | Where (env, part, screen) | Role | Short description | Severity | Classified as | Fix commit | Verified on staging (date, by) | In production (date) | Closed (date, both names) | Notes |
| --------- | ------------------- | ------------------------- | ---- | ----------------- | -------- | ------------- | ---------- | ------------------------------ | -------------------- | ------------------------- | ----- |
| WD-001    |                     |                           |      |                   |          |               |            |                                |                      |                           |       |
| WD-002    |                     |                           |      |                   |          |               |            |                                |                      |                           |       |
| WD-003    |                     |                           |      |                   |          |               |            |                                |                      |                           |       |

## End of the warranty period

At the end date, the two sides review the log together. The warranty deliverable is accepted
when every defect reported in the period is closed or accepted as open in writing (§3.1, D13).

| Totals at the end of the period | Critical | Major | Minor |
| ------------------------------- | -------- | ----- | ----- |
| Reported                        |          |       |       |
| Closed                          |          |       |       |
| Accepted as open                |          |       |       |
| Still open                      |          |       |       |

|                            | Name | Signature | Date |
| -------------------------- | ---- | --------- | ---- |
| For the developer          |      |           |      |
| MSWDO head, for the office |      |           |      |
| LGU IT officer             |      |           |      |
| Project owner              |      |           |      |
