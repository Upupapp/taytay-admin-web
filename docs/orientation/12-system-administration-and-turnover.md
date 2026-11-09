# Module 12: System Administration and Turnover Orientation

Tracker item 12. Read [README.md](README.md) first for the room, the equipment and how the session
runs.

## 1. Purpose, who attends, time and what to bring

**Purpose.** After this session the LGU's administrators can run the platform without the developer:

- give staff accounts their role, office and office role, and take them away when someone leaves;
- change the app's settings safely, including the Terms of Use and the Privacy Notice;
- read the app audit trail;
- find the turnover package, and know whom to contact during the 30-day corrective warranty;
- know what they must keep doing after turnover.

**Who attends.** The system administrators, the MSWDO head, the auditor and the LGU's ICT officer.
The Data Privacy Officer attends at least the part on the Terms of Use and the Privacy Notice
(section 3.4).

**Time.** About 2.5 to 3 hours, with a 10-minute break.

**What to bring.** Your staging test account (administrator, head or auditor). The trainer brings
the turnover package and the warranty procedure, printed or on screen.

**Words used in this module**

- **Account role**: what an account is in the residents' app and the console: "Resident", "Verified
  resident", "Staff" or "Administrator".
- **Office role**: the job a staff account does in the console, such as "Intake officer". It decides
  which menus and buttons the account gets.
- **Audit trail**: the list of acts the API records, with who did what, to which record, and when.
- **Turnover**: the handing over of the platform, its documents and its duties to the LGU.
- **Corrective warranty**: the 30 days after go-live during which defects found are fixed.

## 2. Agenda

| Minutes | Part                                                                |
| ------- | ------------------------------------------------------------------- |
| 10      | Welcome, attendance, purpose                                        |
| 15      | Staff sign-in and how access is protected                           |
| 35      | Accounts and roles: give, change and take away access               |
| 10      | Break                                                               |
| 35      | App settings, and the Terms of Use and Privacy Notice               |
| 20      | The app audit trail                                                 |
| 20      | Turnover: the package, the warranty, what administrators keep doing |
| 15      | Check your understanding, questions, evaluation form                |

## 3. Step-by-step guide

### 3.1 Staff sign-in and how access is protected

1. Open the staff website. Fill "Work email address" and "Password", and click "Sign in".
2. A wrong email or password shows "Those sign-in details were not recognised. Check the email
   address and password, then try again." It does not say which of the two was wrong.
3. Click "Sign out" in the footer under the menu when you finish. Signing out ends access on every
   browser where you were signed in: the next action there goes to the sign-in page.
4. Reloading the page (F5) signs you out. This is by design: your sign-in is held in memory only,
   never stored in the browser or in a page address.

The sign-in page tells staff: "Staff accounts are issued by the MSWDO administrator. There is no
self-registration — contact your administrator if you need access." and "Password resets are handled
by the MSWDO administrator. Contact the office to have yours reset."

**There is no invite or password reset in the console.** Sign-in accounts are created, and staff
passwords reset, outside the console, in the sign-in service (Firebase). The steps are in section 8
of the [operations runbook](../turnover/operations-runbook.md): "Create the first administrator" and "Staff sign-in
accounts".

The menu and buttons follow the account's role. The server checks every permission again, so typing
a page's address does not get past a role: it shows "You do not have access to that section".

### 3.2 Give a new staff member access

Only an administrator opens "Users and roles".

1. Once the person's sign-in account exists and they have signed in once, their account appears in
   "Users and roles".
2. The list shows "Name", "Email", "Role" and "Office" only. The page says why: "Shown: name, email,
   role and office — what deciding who is staff needs. The server also sends a mobile number and a
   home barangay, which this screen does not show."
3. Click "Manage" on the account. The drawer "Manage an account" opens.
4. **Account role.** Under "Change the role to", choose "Staff". Read the list under "What the
   server does if you change it to" and "Whichever role you choose:". Click "Change the role to
   Staff". The screen shows "Role changed to Staff.".
5. **Office.** In "Office this staff account answers for", choose the office and click "Assign to
   …". A staff account answers an office's inbox, writes its Balita and works its document requests
   only once it is assigned to an office.
6. **Office role.** In "Give the account the office role", choose the job, for example "Intake
   officer". Fill "Why (required)": the server keeps the reason with the change, with your name and
   the time. Click "Give the office role …". The screen shows "Office role changed to …".
7. For a **barangay link**, also choose "The barangay this barangay link works in". Without it the
   screen says "Choose the barangay a barangay link works in.".
8. Ask the person to sign out and in again. Their menu now matches their job, and the footer shows
   their name, role and scope.

**Your own role is never offered.** On your own row (marked "(You)"), the drawer says "This is your
own account. The server refuses a change to your own role; another administrator can make it." Keep
at least two administrator accounts, so one can change the other.

### 3.3 Change or take away access

- **Changing a job:** give the new office role, with a reason.
- **Taking away casework without removing the staff account:** choose "No office role" ("Withdraws
  every casework permission. The account stays staff.").
- **When someone leaves:** there is no deactivate button. Change the account's role to "Resident".
  The account can then no longer use the console, it is marked unverified, any digital ID it holds
  is revoked, and its office role is cleared. Read the effects before the button.
- **The change applies at once.** The server applies it at the person's next request. A console they
  already have open keeps showing what it showed until it is reloaded, but the server refuses
  whatever the new role does not allow.
- **Moving a resident's account off "Verified resident"** revokes their digital ID (UAT case ID-07).
  Changing an account to "Verified resident" marks it verified without an ID review: do this only
  where the office has verified the person some other way. It issues no digital ID.

The sign-in account itself is outside the console. When someone leaves, also have it disabled in the
sign-in service: "Staff sign-in accounts" in section 8 of the [operations runbook](../turnover/operations-runbook.md).

### 3.4 App settings

Only an administrator opens "App settings". The page says: "Residents see this in the Taytay app:
the contact details it shows, the terms and privacy notice it asks residents to accept, the oldest
app version it allows, and its feature flags. A change here reaches every resident."

The page has four parts:

- "Contact": the "Contact line" and "Support email" residents are shown.
- "What residents must accept, and which app they must have": the versions, and "Oldest app version
  allowed".
- "Terms of Use and privacy notice": the texts residents accept.
- "Feature flags": settings the app reads. "Not secret: any resident’s app reads them, signed in or
  not, so never put a password or a key here."

**To change a setting:**

1. Change the field and click "Review the change".
2. The dialog "Change the app’s settings?" lists "What this does:" before its button. Read it.
3. A change that can stop residents using the app (a higher "Oldest app version allowed", or a new
   version of the Terms of Use or the Privacy Notice) also needs you to tick "I understand this can
   stop residents using the app until they update it or accept again.". "Save the settings" stays
   greyed out until you do.
4. Click "Save the settings", or "Go back" to change nothing. Saved settings show "The settings were
   saved. Residents’ apps read them the next time they load."

Never raise "Oldest app version allowed" above the newest app version residents can actually
install. A resident who cannot update may be unable to use the app at all.

### 3.5 The Terms of Use and the Privacy Notice

These are the texts a resident accepts when registering (module 9). The console says: "They are the
LGU’s to write: this console never writes, suggests or fills in legal text."

**Today they are placeholders.** Until the LGU publishes its approved texts, the screen shows, for
each: "No text has been written yet. Until the LGU’s approved Terms of Use are published here, the
app shows a placeholder that says so, under the version “placeholder”." In the app, a resident
reading the full Terms sees that they "will be available soon".

**Before go-live, the LGU must:**

1. Write the Terms of Use and the Privacy Notice for the Taytay app.
2. Have the Data Privacy Officer review both (RA 10173, the Data Privacy Act of 2012).
3. Publish both here, each with a version the LGU chooses.

**To publish a text:**

1. Under "Terms of Use and privacy notice", click "Write the Terms of Use" (or "Change the Terms of
   Use" once one is published). The same buttons exist for the privacy notice.
2. Fill "Version of the Terms of Use": your choice, up to 32 characters, such as _2026-11_. Never
   "placeholder".
3. Paste the approved text into "Text of the Terms of Use" (up to 20,000 characters), exactly as it
   should be shown. Formatting marks such as # or \*\* appear in the console as typed; the app lays
   them out.
4. Click "Review the change". Read "What this does:", tick the acknowledgement, and click "Save the
   settings".

**New version or same version?**

- **A new version** makes every resident accept the text again in the app. Use a new version
  whenever the meaning changes.
- **The same version** changes the text without asking anyone to accept again. Keep the version only
  to correct a mistake that does not change what residents agree to (a typo, for example).

Click "Read the Terms of Use residents are shown" (or "Read the privacy notice residents are shown")
to read what is published now.

### 3.6 The app audit trail

The MSWDO head, the auditor and the administrator open "App audit trail". It is read-only.

1. Open "App audit trail". The newest acts come first.
2. The columns are "When", "What was done", "By account" and "To record".
3. Click "Show older entries" to read further back, and "Read from the newest" to start again.

**A row records six things, and nothing else:** its own entry number, when the act happened, what
was done, the account that did it, the kind of record it was done to, and that record's ID. The page
says what a row does not hold:

- "A row says who acted, what they did, to which record and when. The API keeps no earlier or later
  value, and no reason."
- "People and records are shown by their IDs, as the API records them. Nothing is looked up about
  them here."
- "A change to the app’s settings is recorded without saying which setting."

The reasons for a change are kept in each record's own history, for example "What has been done to
this record" on a household. Every row should have a description in words. A row reading "No
description in this console for …" is a defect: report it.

### 3.7 The turnover package

The turnover package is in [../turnover/](../turnover/). It is handed over in this session. Check
with the trainer that you know where each part is kept, and who at the LGU holds it.

Every part of the console is served by the API since 9 November 2026, when the newsfeed was retired
in favour of Balita, so the menu has no "Not connected yet" entry. If a later part of the console is
built before the API serves it, that entry returns and names it. A staff account that is not
assigned to an office also sees the entry: its page says why the account has no office inbox. The
[known limitations and open items](../turnover/known-limitations-and-open-items.md) list what is
still open.

### 3.8 The 30-day corrective warranty

Defects found in the 30 days after go-live are fixed under the corrective warranty. Whom to contact,
how to report a defect, what to include and how a report is closed are in
[../turnover/warranty-procedure.md](../turnover/warranty-procedure.md). Its names, contacts, dates
and response times are filled in there from the contract.

When you report a defect, give the page, the role you used, the steps, what you expected and what
happened, with any message word for word. Never send a password, and never send a real resident's
details or a screenshot showing them.

### 3.9 What the administrators must keep doing

After turnover these are the LGU's tasks. The LGU decides how often, and who does each.

1. **Review accounts.** In "Users and roles", check that every "Staff" and "Administrator" account
   belongs to someone who still works in that job, with the right office and office role.
2. **Offboard leavers** on their last day: change the account's role to "Resident", and have the
   sign-in account disabled (section 3.3).
3. **Keep the Terms of Use and the Privacy Notice current,** with the Data Privacy Officer. Publish
   a new version whenever the meaning changes.
4. **Review ID verifications** in "ID verification", so residents are not left waiting.
5. **Keep the app's public information current:** the directory, the hotlines, the home screen and
   Balita (module 11).
6. **Read the app audit trail** for acts nobody expected.
7. **Watch the backups.** A nightly backup of the staging database is kept for 7 days. Confirm with
   whoever operates the server that backups are running and that a restore has been tested (section
   6 of the [operations runbook](../turnover/operations-runbook.md)), and agree the arrangement for
   the live system before go-live.
8. **Keep feature flags free of secrets,** and change "Oldest app version allowed" only when a new
   app version is available to every resident.

## 4. Hands-on exercises

Run these on staging with test accounts only. **Do not save** a new terms or privacy version, or a
higher "Oldest app version allowed": it would affect every tester's app.

| #   | Exercise                                                               | Role                         | UAT case       |
| --- | ---------------------------------------------------------------------- | ---------------------------- | -------------- |
| 1   | Sign in with a wrong password, then the right one                      | INTAKE                       | NFR-01         |
| 2   | Sign out in one browser; act in another                                | INTAKE                       | NFR-02         |
| 3   | Reload the page and sign in again                                      | INTAKE                       | NFR-03         |
| 4   | Look for a stored sign-in pass in the browser                          | ADMIN                        | NFR-04         |
| 5   | Give a test account its role, office and office role                   | ADMIN                        | ACC-01         |
| 6   | Give a barangay link its barangay                                      | ADMIN                        | ACC-02         |
| 7   | Open your own row: no role can be chosen                               | ADMIN                        | ACC-03         |
| 8   | Compare each role's menu                                               | Each role                    | ACC-04         |
| 9   | Type a page address your role does not open                            | BLINK, RELEASE               | ACC-05         |
| 10  | Move a verified account to "Resident"; its card is revoked; restore it | ADMIN                        | ID-07          |
| 11  | Change the contact line through the confirmation                       | ADMIN                        | DIR-12         |
| 12  | Open the Terms of Use editor; review a new version; "Go back"          | ADMIN, with the DPO          | DIR-13 (part)  |
| 13  | Read the audit trail's notes and columns                               | AUDITOR                      | AUD-01         |
| 14  | Find the rows for ID, account, directory and settings acts             | AUDITOR                      | AUD-02, AUD-03 |
| 15  | Find the rows for registry, request, case and release acts             | AUDITOR                      | AUD-04, AUD-05 |
| 16  | Check who can open the audit trail                                     | HEAD, AUDITOR, ADMIN, INTAKE | AUD-06         |

Exercise 12 is the first half of DIR-13, stopped before saving: saving a new version on staging
makes every tester accept again, so DIR-13 itself runs last in the UAT round. Run the exercise
like this:

1. Open "App settings". Under "Terms of Use and privacy notice", read the placeholder sentence.
2. Click "Write the Terms of Use". Type a test version, _uat-1_, and the text _UAT: test text, not
   for publication._
3. Click "Review the change". Read "What this does:" with the Data Privacy Officer: it says the new
   version makes every resident accept again.
4. Look at "Save the settings" before and after ticking the acknowledgement. Then click "Go back".
5. Click "Put the editor away". Check that nothing was saved.

Also run DOC-13 (the audit trail records every document request act) and DOC-14 (roles without the
permission see no "Resident document requests") once module 9's document request exercises are done.

## 5. What the system deliberately does not do

- **It never lets you change your own role.** Another administrator must.
- **It has no invite, no self-registration and no password reset in the console.** Accounts are
  provisioned outside it.
- **It shows the minimum about each account:** name, email, role and office.
- **It never writes, suggests or fills in legal text.** The LGU writes the Terms of Use and the
  Privacy Notice.
- **It never saves a risky setting without a confirmation** that says what it does first, and an
  acknowledgement where residents could be stopped.
- **It keeps no old or new values and no reasons in the app audit trail,** and looks nothing up
  beside a row.
- **It never stores your sign-in in the browser.** That is why a reload signs you out.

## 6. Common questions and troubleshooting

**A new staff member is not in "Users and roles".** They must sign in once after their sign-in
account is created. Then click "Show more" if the list is long: newest accounts come first.

**A staff member's menu did not change after I gave them a role.** Ask them to sign out and in
again.

**I cannot assign an office.** Only a "Staff" account takes an office. Change the role to "Staff"
first.

**A staff member forgot their password.** It is reset outside the console, in the sign-in service.
Whoever holds the Firebase project sends a reset link: "Staff sign-in accounts" in section 8 of the
[operations runbook](../turnover/operations-runbook.md).

**I am the only administrator and need my role changed.** Nobody can change their own role. Keep a
second administrator account for this.

**The audit trail shows an ID, not a name.** By design: people and records are shown by their IDs,
as the API records them.

**I saved a new terms version by mistake on staging.** Tell the trainer. Residents' apps read the
new version the next time they load.

## 7. Quick reference

**Accounts ("Users and roles")**

- "Manage" → "Change the role to" → read the effects → "Change the role to …".
- "Office this staff account answers for" → "Assign to …".
- "Give the account the office role" → "Why (required)" → "Give the office role …".
- Leaver: change the role to "Resident", and have the sign-in account disabled.

**App settings**

- Change → "Review the change" → read "What this does:" → tick if asked → "Save the settings".
- Terms and privacy: new version = everyone accepts again; same version = no new acceptance.
- No password or key in a feature flag.

**App audit trail**

- "When", "What was done", "By account", "To record".
- No old or new values, no reasons. Reasons are in each record's history.

**Turnover**

- Package: [../turnover/](../turnover/). Warranty contacts:
  [../turnover/warranty-procedure.md](../turnover/warranty-procedure.md).

**Keep doing**

- Review accounts. Offboard leavers. Keep the legal texts current. Watch the backups.

## 8. Check your understanding

1. A new intake officer starts on Monday. List the three things you set on "Users and roles".
2. Why can you not change your own role, and what should the LGU do about it?
3. A social worker leaves the office today. What do you do in the console, and what outside it?
4. What does a row of the app audit trail record, and what does it never record?
5. You fix a typo in the published Privacy Notice. Do you change the version? Why?
6. The LGU changes what residents agree to in the Terms of Use. What version do you use, and what
   happens in the app?
7. Who must review the Terms of Use and the Privacy Notice before they are published?
8. Where do you find whom to contact about a defect during the 30-day warranty?

## Facilitator notes

**Before the session.** Make sure the turnover package and the warranty procedure are ready
([../turnover/](../turnover/)). Prepare a spare test staff account for exercises 5 and 6, and a
verified test resident with a card for exercise 10. Remind everyone not to save a new legal text
version or a higher oldest app version on staging.

**Check on the day.** A new version of the Terms of Use or the Privacy Notice makes every signed-in
resident accept the text again: the app shows "The Terms of Use have changed" (or the Privacy
Notice) with "I agree" and "Sign out", and a guest is never asked. This arrived in the app on 7
November 2026, so make sure the phones carry a staging build from that date or later.

**Answer key**

1. The account role "Staff"; the office it answers for; the office role "Intake officer", with a
   reason.
2. The server refuses a change to your own role; another administrator must make it. The LGU should
   keep at least two administrator accounts.
3. In the console, change the account's role to "Resident" (the server applies it at the person's
   next request, and clears the office role). Outside the console, have the sign-in account disabled
   in the sign-in service (section 8 of the operations runbook).
4. Its entry number, when, what was done, by which account, the kind of record and the record's ID.
   It never records an old or new value, or a reason.
5. No. Keep the same version: a typo does not change what residents agree to, so nobody needs to
   accept again.
6. A new version. Every resident is asked to accept the new text again in the app.
7. The Data Privacy Officer, after the LGU writes them.
8. In [../turnover/warranty-procedure.md](../turnover/warranty-procedure.md).
