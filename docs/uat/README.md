# User Acceptance Testing (UAT): Taytay, Rizal LGU platform

This pack is deliverable D6, "Testing and LGU UAT" (item 7 on the project tracker). Office staff and
resident testers use it to test the platform on the staging site and sign it off before production.

- [uat-test-scripts.md](uat-test-scripts.md): 201 test cases in 19 areas.
- [uat-signoff.md](uat-signoff.md): the sign-off sheets, the defect summary and the acceptance.
- [dry-run-2026-11-09.md](dry-run-2026-11-09.md): the developer's dry run of 9 November 2026 on a
  local copy, before the office's round: the result of each case it touched, the three cases it
  corrected (version 1.8), and the product defects it found.
- The workbook, "Taytay - UAT test scripts (staging).xlsx": the same cases, with columns to record
  each result and a "Defects" tab. It is **not kept in this repository**. It is generated from these
  Markdown files and handed out with the pack.

**The Markdown files are the source.** A change to a case is made here first, and the workbook is
generated again before the next round, so the two never disagree. If they do, these files win.

The staff website is https://taytay.139-162-51-165.sslip.io. The residents' app is the staging build
of the Taytay app for Android, supplied by the developer.

## Who tests what

| Code        | Test account                         | Areas and cases                                                                                                                                                                         |
| ----------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADMIN       | System administrator                 | ACC-01 to 03, REG-09 to 11, ID-04 to 07, DIR-05 to 12, DSH-07, NFR-04, GOV-01, 05, 07, 08, EVT-05 (set-up)                                                                              |
| HEAD        | MSWDO head                           | DSH, REQ-02, 07, 16 to 19, CAS-09, 11, REL-10, REF-01 to 08, NEWS-01 to 03, DOC-01, 02, SRCH-01, 02, WRK-04 to 06, RPT-02, 04 to 06, 08, 09, GOV-02 to 04, EVT-01, 02, 04, 05, 07 to 11 |
| SW1, SW2    | Two social workers                   | REQ-08, 09, 13, 15, CAS-03 to 08, REF-09 to 12, WRK-01, 02, GOV-06 (SW1), 08 (SW2), EVT-06 (SW1)                                                                                        |
| INTAKE      | Intake officer                       | ROS, REQ-01, 03 to 06, 10 to 14, CAS-01, 02, 07, NEWS-05, 06, DOC-05 to 09, 11, 14, NFR, SRCH-03, RPT-10                                                                                |
| RELEASE     | Release officer                      | REL-01 to 08, ACC-07, DOC-08                                                                                                                                                            |
| BLINK       | Barangay link, working in San Juan   | ROS-05, ID-08, ACC-05, ACC-10, DOC-14                                                                                                                                                   |
| AUDITOR     | Auditor                              | AUD, ACC-08, DOC-13, 14, RPT-03, 07, GOV-02, 03, EVT-06, 10                                                                                                                             |
| RES-A, B, C | Resident testers with Android phones | REG, ID-01, DIR-01 to 04, NEWS-05, DOC-03, 04, 07 to 12, EVT-03 to 05, 08, 09, 11                                                                                                       |
| GUEST       | The app, not signed in               | REG-01, DIR-01 to 04, NEWS-04, DOC-01 to 03, EVT-02                                                                                                                                     |

Cases that name several roles (ROS-12, DSH-05, SRCH-04, WRK-03, RPT-01, GOV-02, ACC-04, AUD-06,
DOC-14) are run by each of those accounts.

## Test accounts

- One staff account per code above is **issued separately by the administrator**. No password is
  written in this pack, the workbook, a defect or a screenshot.
- The administrator gives each account its role, office and office role on "Users and roles"
  (ACC-01, ACC-02). INTAKE is assigned to the MSWDO office, so it can answer the office inbox.
  HEAD and RELEASE are assigned to it too: only staff at an office work residents' document
  requests (DOC).
- Each resident tester uses a test email inbox that no other Taytay account uses.

## Test data

- **Staging holds test data only (NFR-PRIV-15).** Never type a real resident's name, birth date,
  address, phone number, ID number, photo or story, not even to "try it out".
- People in the registry are fictional, with the surname **Halimbawa**: Ana, Ben, Carmen, Dante and
  Elisa. Resident testers register as fictional Halimbawas too.
- Mobile numbers are 0917 000 00NN, addresses "UAT 1 Test Street", birth dates in 1980.
- ID pictures are a printed sample card marked "SAMPLE", never a real ID. The selfie is a photo of a
  printed sample face, not of a person.
- Uploaded files are test PDFs and photos with no personal content.
- Document types and their fees are test examples marked "(test)", never the LGU's real documents
  or fees.
- Every reason, note or message you type starts with "UAT:", so test records can be told apart.
- Print the payout list and the referral sheet to PDF only, and delete those files after the round.

## How to run a case

1. Do what "Set up first" asks. Then follow the steps in order, using the exact names in quotes.
2. Compare what you see with the expected result, all of it.
3. Record **Pass**, **Fail** or **Blocked**, with your name and the date. A Fail needs a defect id;
   a Blocked case needs the reason in Notes.

Run the areas in this order, because later cases use the records of earlier ones: ACC-01 and
ACC-02, ROS, REG, ID, DIR, DOC, REQ, CAS, REL, REF, NEWS, EVT, DSH, SRCH, WRK, RPT, GOV, AUD, then
NFR. REQ-19 runs after REL-01 and before REL-06. The set-up of NFR-06 (Carmen Halimbawa, "VAWC
survivor", with a case) is done before SRCH, WRK and RPT, which use her record. In EVT, the second
test event starts 45 minutes after it is created and ends an hour later (EVT-08, EVT-09), and
EVT-11 runs after the other cases on the first one: it cancels it, and RES-B and RES-C are told in
the app. EVT-12 to EVT-20 run after EVT-11, in order, mostly on a fourth test event. GOV-08 runs
last in GOV: it switches SW2's account off and back on, so tell SW2 before it starts.

**Staging needs at least one document type before the DOC cases run.** The head or an
administrator creates it with case DOC-01 ("UAT Certificate of Indigency (test)"). Until it exists,
residents have nothing to request and the DOC cases cannot start.

## Known limits on staging

- **No email.** Staging sends no email, so the 6-digit codes never arrive. REG-04 to REG-07 and
  REG-12 are **Blocked until email sending is set up** (requirements GL-3). Until then REG-08 puts
  an ID in the review queue, so the staff review cases can still run.
- **Events in the app need a new build.** The resident steps of EVT need a staging build of the
  app that includes events (decision D-191 in the app's decision log). Until the developer
  supplies one, EVT-03 to EVT-05, EVT-08, EVT-09, EVT-11, EVT-14 to EVT-19 (EVT-17 to EVT-19 use
  the registrations of EVT-14) and step 8 of EVT-02 are Blocked. The "Who can register" checks
  (EVT-03, EVT-14) and the correction notices (EVT-15, EVT-16) need a build that also includes
  D-194.
- **Android only.** No iOS build exists yet.
- **Defects found before the round.** The developer's dry run
  ([dry-run-2026-11-09.md](dry-run-2026-11-09.md)) found twelve product defects. All are fixed in
  the code (see its "Fixed" notes), but the office meets them on staging until staging is
  redeployed: a barangay link or a release officer cannot open a resident's record (ROS-05,
  NFR-06), a barangay link's footer reads "Unknown barangay" (ACC-02, ACC-04), and RPT-01 and EVT-18
  fail on one step each. Ask whether staging has been redeployed before the round; if it has not,
  log them as defects as usual.
- **A reload signs you out of the staff website.** This is by design (NFR-03). Move around with the
  menu and the links.

## Recording a defect

Use the workbook's "Defects" tab, one row per defect, and put its id in the case's Notes. Once the
developer has fixed it on staging, the tester runs the case again and records the re-test there.

- **Defect id**: DEF-001, DEF-002, and so on.
- **Case id**, the **role** used, and the **steps** that show the problem.
- **Expected** (from the case) and **actual** (what happened, with any message word for word).
- **Screenshot**: a file named after the defect id, showing test data only.
- **Severity**:
  - **Critical**: data lost or wrong; a role sees personal data it must not see; a role does what
    it must not (for example, approves and releases); or a Must case cannot run at all.
  - **Major**: a Must or Should case fails but a workaround exists; a rule is broken (a wrong
    figure or status, a missing reason, a missing warning); or a wrong message misleads staff.
  - **Minor**: wording, layout or a typo that misleads nobody.

## Exit criteria

UAT ends, and production can be considered, only when all of these hold:

1. Every Must case has passed. A Must case blocked only by the email limit is either run once email
   works, or accepted as open in writing by the owner.
2. No Critical or Major defect is open.
3. Every Should case has run, and its failures are logged with a decision.
4. Every Minor defect is logged with a decision: fix it, or accept it as open.
5. Every area sheet and the overall acceptance in [uat-signoff.md](uat-signoff.md) are signed.

## Sign-off

Testers sign the sheet of each area they ran, and the MSWDO head accepts it for the office. The
overall acceptance is signed by the MSWDO head, the LGU's system administrator and the project
owner. Nothing in the sheets is signed in advance.

## Not in this UAT round

Not built yet. Every console module is served by the API since 9 November 2026, so the website's
"Not connected yet" page lists none:

- The console's newsfeed (FR-STAFF-26) was retired on 9 November 2026 in favour of Balita, the news
  residents read in the app (`DL-194`); it has no scripts because it no longer exists. Comments and
  reactions on Balita (FR-RES-9, FR-STAFF-34) are not built and wait for OD-4. Events, served by the
  API since 8 November 2026 (`DL-192`), have their scripts since version 1.4 (EVT); their covers are
  uploaded since version 1.5 (`DL-193`), and corrections, the safe limit, check-in mode and who may
  register are tested since version 1.7 (EVT-12 to EVT-20, `DL-195`). Notes or an assistance-needs
  checklist on a registration are not built (`DL-195`). Governance, the rest of FR-STAFF-26, is
  served since 8 November 2026 (`DL-191`) and has its scripts since version 1.3 (GOV, AUD-07).
  Capturing a correction request is not built, and the governance page says so (GOV-05).
- Served by the API since 7 November 2026, but with no test script in this round yet:
  beneficiaries and duplicate review (FR-STAFF-12) and programme use counted from releases on the
  programme pages (FR-STAFF-14) (`DL-187`). Reports, My work and search have their scripts since
  version 1.2 (SRCH, WRK, RPT).
- Ending a relationship (FR-STAFF-10), a resident's sector history (FR-STAFF-9) and a programme's
  change history (FR-STAFF-13): the records exist, but no screen offers them yet.
- Changing every office detail after creation, and the list of hidden Tulong pages (FR-STAFF-4).
- Images in staff replies (FR-STAFF-8), push notifications (FR-API-3) and staff two-factor sign-in
  (FR-STAFF-29).
- Residents applying for assistance in the app (FR-RES-14), Balita reactions (FR-RES-9), and
  emergency alerts (FR-STAFF-33, FR-RES-16). Registering for events in the app is in the round
  (EVT), once the app build that includes it is supplied.
- My Account details and the household screen in the app (FR-RES-11, FR-RES-12), still in progress.
- Checks made straight against the API: rate limits, size caps, CORS and the security policy
  (FR-API-5, FR-API-6, NFR-SEC-3, NFR-SEC-5). The developer runs these.
