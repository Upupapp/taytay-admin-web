# UAT test scripts: Taytay, Rizal LGU platform (staging)

Version 1.0, 6 November 2026. These scripts are deliverable D6, "Testing and LGU UAT" (item 7 on the
project tracker). Read [README.md](README.md) first: it names the test accounts, the test-data rules
and how to record a result or a defect.

**Where to test**

- Staff website: https://taytay.139-162-51-165.sslip.io
- Residents' app: the staging build of the Taytay app (Android), supplied by the developer. It talks
  to https://taytay-api.139-162-51-165.sslip.io/api/v1.

**How to read a case**

- **Role** is the test account to sign in with (the codes are in the README).
- **Checks** names the requirement ids from `docs/project/requirements-and-implementation-plan.md`,
  the case's priority (Must, Should or Could, taken from those requirements) and the deliverable it
  belongs to (D1 to D3, or the TOR row T-… where no deliverable applies).
- Words in "quotes" are exactly what the screen shows: a menu entry, a button, a field or a message.
- Use only fictional test data (README, "Test data"). Every reason you type starts with "UAT:".
- Record Pass, Fail or Blocked for every case, with your name and the date. A Fail needs a defect id.

| Area                                          | Cases              | Count   |
| --------------------------------------------- | ------------------ | ------- |
| REG: Resident registration and ID review      | REG-01 to REG-13   | 13      |
| ID: Digital ID                                | ID-01 to ID-08     | 8       |
| ROS: Residents registry, households, families | ROS-01 to ROS-12   | 12      |
| DSH: Dashboard                                | DSH-01 to DSH-07   | 7       |
| DIR: Directory, home screen and app settings  | DIR-01 to DIR-12   | 12      |
| REQ: Assistance requests                      | REQ-01 to REQ-19   | 19      |
| CAS: Cases                                    | CAS-01 to CAS-12   | 12      |
| REL: Releases and payout sessions             | REL-01 to REL-10   | 10      |
| REF: Referrals and field visits               | REF-01 to REF-12   | 12      |
| ACC: Accounts, roles and access               | ACC-01 to ACC-10   | 10      |
| AUD: App audit trail                          | AUD-01 to AUD-06   | 6       |
| NEWS: Balita and the office inbox             | NEWS-01 to NEWS-06 | 6       |
| NFR: Privacy, security and accessibility      | NFR-01 to NFR-10   | 10      |
| **Total**                                     |                    | **137** |

## REG: Resident registration and ID review

The resident steps run in the Taytay app on an Android phone. The review steps run on the staff
website as the system administrator, the only role that reviews IDs.

**Known limit:** staging sends no real email, so the 6-digit email code never arrives. REG-04 to
REG-07 and REG-12 are marked Blocked until email sending is set up. REG-08 is the staging route that
still puts an ID in the review queue, so REG-09 to REG-11 can run.

### REG-01 · A guest browses without an account

- **Role:** GUEST (the Taytay app, never signed in)
- **Checks:** FR-RES-1 · Must · D1
- **Set up first:** The staging build of the Taytay app is installed on an Android phone.
- **Steps:**
  1. Open the app. On the welcome screens, tap "Continue as guest".
  2. Tap each tab at the bottom in turn: "Home", "Directory", "Balita" and "Tulong".
  3. Tap "My Account".
- **Expected result:**
  - Home, Directory, Balita and Tulong each open and show content. None asks you to sign in.
  - My Account shows "You are browsing as a guest", the badge "Not signed in" and a "Sign in"
    button.

### REG-02 · Personal details and the barangay list

- **Role:** RES-A (a new resident tester)
- **Checks:** FR-RES-2 · Must · D1
- **Set up first:** The app is open on the sign-in screen. You have the fictional name and mobile
  number given to you for this round (README, "Test data").
- **Steps:**
  1. Tap "Create an account". Check the header reads "Create account" and "Step 1 of 6 · Personal
     info".
  2. Leave every field empty and tap "Continue".
  3. Fill "First name" and "Last name" with your fictional name, and "Mobile number" with your
     fictional number (11 digits starting with 09).
  4. Tap "Barangay" and look at the list.
  5. Choose "San Juan". Fill "Street / Purok" with "UAT Purok 1".
  6. Tap "Continue".
- **Expected result:**
  - After step 2 the screen shows "Please fix 4 fields to continue.", "Required" under both names,
    "Enter an 11-digit mobile number starting with 09." and "Choose your barangay.".
  - The list is titled "Choose your barangay" ("Taytay, Rizal") and shows Taytay's barangays:
    Dolores, Muzon, San Isidro, San Juan and Santa Ana.
  - Before step 6 the line "Address: UAT Purok 1, Brgy. San Juan, Taytay, Rizal" shows.
  - After step 6 the "Create your account" step opens.

### REG-03 · Create the account

- **Role:** RES-A
- **Checks:** FR-RES-2 · Must · D1
- **Set up first:** REG-02 done. A test email inbox that no other Taytay account uses.
- **Steps:**
  1. In "Email address" type "name@" and in "Password" type five letters. Tap "Create my account".
  2. Correct the email to your test address and use a password of at least 8 characters.
  3. Tap "Create my account".
- **Expected result:**
  - After step 1: "Enter a valid email, e.g. name@example.com" and "Use at least 8 characters.".
  - After step 3 the title changes to "Account created". Either the "Enter the 6-digit code" step
    opens ("We sent a code to … It expires in 10 minutes."), or a banner says "Your account is
    saved, but we could not send a code to …". In both cases the account now exists.

### REG-04 · Confirm the email with the 6-digit code

- **Role:** RES-A
- **Checks:** FR-RES-2 · Must · D1
- **Set up first:** REG-03 done.
- **Steps:**
  1. Type six wrong digits and tap "Confirm email".
  2. If no email has arrived after two minutes, tap "Resend".
  3. Open the test inbox, find the Taytay code, type it and tap "Confirm email".
- **Expected result:**
  - Step 1 shows "Mali ang code. 4 sa 5 subok na lang ang natitira.".
  - Step 2 sends a new code.
  - Step 3 confirms the email and opens "Step 2 of 6 · Terms & privacy".
- **Status:** Blocked until email sending is set up. Staging sends no email, so no code arrives
  (requirements GL-3). Run this case once email sending is switched on.

### REG-05 · Accept the terms and the privacy notice

- **Role:** RES-A
- **Checks:** FR-RES-2 · Must · D1
- **Set up first:** REG-04 passed.
- **Steps:**
  1. On "Your data, protected", tap "Continue" without ticking anything.
  2. Tap "Read full Terms ›", then "Read full Privacy Notice ›".
  3. Tick "I have read and agree to the Terms of Use and the Privacy Notice." and "I consent to
     Taytay LGU processing my personal data for account verification.". Tap "Continue".
- **Expected result:**
  - Step 1 shows "Agree to the Terms and the Privacy Notice.".
  - Step 2 opens the full Terms and the full Privacy Notice.
  - Step 3 opens "Step 3 of 6 · Valid ID".
- **Status:** Blocked until email sending is set up: this step comes after the email code (REG-04).

### REG-06 · Add the ID front and back, and the selfie

- **Role:** RES-A
- **Checks:** FR-RES-3 · Must · D1
- **Set up first:** REG-05 passed. The printed sample ID card and the printed sample face (README,
  "Test data").
- **Steps:**
  1. On "Upload a valid government ID", tap "Continue" with nothing attached.
  2. Add "Front of ID" (photograph the sample card) and "Back of ID (optional)". Tap "Continue".
  3. On "Take a quick selfie", tap "Continue" without a photo.
  4. Tap "Take selfie", photograph the sample face and tap "Continue".
- **Expected result:**
  - Step 1 shows "Add a photo of the front of your ID.".
  - After step 2 each slot shows the file name and "Attached".
  - Step 3 shows "Take a selfie to continue.".
  - Step 4 opens "Check your details".
- **Status:** Blocked until email sending is set up: this step comes after the email code (REG-04).

### REG-07 · Review the details and submit for verification

- **Role:** RES-A, then ADMIN
- **Checks:** FR-RES-3, FR-API-1 · Must · D1
- **Set up first:** REG-06 passed.
- **Steps:**
  1. On "Check your details", read the rows "Name", "Email", "Mobile", "Address", "Terms & Privacy
     Notice", "Valid ID" and "Selfie".
  2. Tap "Edit" beside "Mobile", change one digit, and come back to the review.
  3. Tap "Submit for verification".
  4. Tap "Continue to app".
  5. ADMIN: on the staff website, open "ID verification".
- **Expected result:**
  - Step 1: "Email" has the badge "Verified"; "Terms & Privacy Notice" reads "Agreed · consent
    given"; "Selfie" reads "Taken". Step 2 shows the changed number.
  - Step 3 shows "You're all set, …!" and the card "Account verification" with "Pending review".
  - Step 4 opens Home. Step 5 shows the new request under "Awaiting review".
- **Status:** Blocked until email sending is set up: this step comes after the email code (REG-04).

### REG-08 · Staging route: send the ID from "Verification status"

- **Role:** RES-B (a second resident tester)
- **Checks:** FR-RES-3, FR-API-1 · Must · D1
- **Set up first:** RES-B has done REG-02 and REG-03 with their own fictional details. The email
  code never arrived. The printed sample ID card and sample face.
- **Steps:**
  1. Close the app and open it again. On the sign-in screen type RES-B's email and password and
     tap "Sign in".
  2. Tap "My Account", then "Verify my identity".
  3. On "Verification status" ("Not verified"), tap "Type of ID *" and choose "PhilSys National
     ID".
  4. Add "Front of ID *". Check "Start verification" is still greyed out.
  5. Add "Selfie" (photograph the sample face). Tap "Start verification".
- **Expected result:**
  - "Start verification" can be tapped only once the front and the selfie are added.
  - After step 5 the page reads "We're reviewing your account" with "Pending review", and the
    progress line "Valid ID and selfie received".
  - The request appears on the staff website under "ID verification", "Awaiting review" (REG-09).

### REG-09 · Staff: the review queue and the privacy warning

- **Role:** ADMIN
- **Checks:** FR-STAFF-1 · Must · D1
- **Set up first:** REG-08 done, so a request is awaiting review.
- **Steps:**
  1. Sign in to the staff website. In the menu, under "Residents’ app", click "ID verification".
  2. Open the "Show" list and look at its options. Leave it on "Awaiting review".
  3. Click "Review" on RES-B's request.
  4. Under "The images", click "Show the ID and the selfie". Read the dialog and click "Cancel".
  5. Click "Show the ID and the selfie" again, then "Show them".
  6. Close the review with the ✕ at its top. Click "Review" on the same request again.
- **Expected result:**
  - The columns are "Sent", "ID sent" and "Status". "Show" offers "Awaiting review", "Approved",
    "Rejected" and "Every request".
  - No picture loads before step 5. The dialog is titled "Before you open these images" and says
    "You are about to see a resident’s government ID and a photograph of their face.".
  - Step 5 shows "Front of the ID" and "Selfie", with "Shown in this tab only while this review is
    open. They are discarded when you hide them, close the review or leave the page.".
  - After step 6 the pictures are hidden again until you ask for them.

### REG-10 · Staff: approve, and the digital ID is issued

- **Role:** ADMIN, then RES-B
- **Checks:** FR-STAFF-1, FR-API-1, FR-RES-5 · Must · D1
- **Set up first:** REG-09 done. RES-B's request is open in "Review".
- **Steps:**
  1. Under "Decide", choose "Approved" in "Decision".
  2. Read "What happens when you confirm".
  3. In "Note for the office (the resident does not see this)" type "UAT".
  4. Replace it with "UAT: sample ID and sample face checked for the test round.".
  5. Click "Record the decision".
  6. RES-B: in the app, open "My Account", then "Verification status".
- **Expected result:**
  - Step 2 lists, above the button, "The account is marked verified.", that a digital ID is issued
    with the selfie as its photo, and "Nothing in this console can undo an approval.".
  - After step 3 "Record the decision" stays greyed out and "Say a little more — …" appears.
  - Step 5 shows "Approved. The server marked the account verified.".
  - Step 6 shows "Your account is verified" with the chip "Verified".

### REG-11 · Staff: reject with a reason; the resident corrects and sends again

- **Role:** ADMIN, then RES-C, then ADMIN
- **Checks:** FR-STAFF-1, FR-RES-3 · Must · D1
- **Set up first:** RES-C (a third resident tester) has sent an ID as in REG-08.
- **Steps:**
  1. ADMIN: in "ID verification", click "Review" on RES-C's request.
  2. Choose "Rejected" in "Decision" and read "What happens when you confirm".
  3. In "Reason the resident will read" type "UAT: the front of the ID is blurred. Please send a
     clearer photo." and click "Record the decision".
  4. RES-C: open "My Account", then "Verification status".
  5. Tap "Front of ID *" ("Upload new photo") and choose a new photo of the sample card.
  6. Tap "Resubmit for verification". In "Message" type "UAT: new front photo sent." and tap
     "Resubmit for verification".
  7. ADMIN: in "ID verification", with "Show" on "Awaiting review", click "Review" on RES-C's
     request.
- **Expected result:**
  - Step 2 says the resident reads the reason in the app and may correct the request and send it
    again. Step 3 shows "Rejected. The resident can now read your reason in the app.".
  - Step 4 shows "Needs correction" with the reason under "REASON FROM TAYTAY LGU".
  - After step 5 the row reads "New photo sent".
  - Step 7 shows the request back in "Awaiting review", with "What the resident wrote with their
    correction" and the new front picture.

### REG-12 · Forgotten password, reset with an emailed code

- **Role:** RES-B
- **Checks:** FR-RES-4 · Must · D1
- **Set up first:** RES-B is signed out.
- **Steps:**
  1. On the sign-in screen tap "Forgot password?". Type RES-B's email and tap "Send reset code".
  2. Type the code from the email and tap "I-verify ang code".
  3. Fill "Bagong password *" and "Ulitin ang bagong password *" and tap "I-save ang password".
  4. Tap "Mag-sign in" and sign in with the new password.
- **Expected result:**
  - Step 1 says "For your security, we don't say whether an account exists for this address.".
  - Step 3 shows "Na-update na ang password mo". Step 4 signs RES-B in.
- **Status:** Blocked until email sending is set up: the reset code is emailed, and staging sends
  no email.

### REG-13 · Change the password while signed in

- **Role:** RES-B
- **Checks:** FR-RES-4 · Must · D1
- **Set up first:** REG-10 done (RES-B is verified and signed in).
- **Steps:**
  1. Tap "My Account", then "Settings". On "Settings & privacy", under "App", tap "Change password".
  2. Fill "Current password", "New password" and "Repeat the new password" with two different new
     passwords. Tap "Save password".
  3. Correct "Repeat the new password" and tap "Save password".
  4. On "My Account" tap "Sign out", then "Sign out" in the dialog.
  5. Sign in with the old password, then with the new one.
- **Expected result:**
  - Step 2 shows "Those passwords do not match.". Step 3 shows "Password updated".
  - In step 5 the old password is refused with "Incorrect email or password." and the new one
    signs in.

## ID: Digital ID

### ID-01 · The resident sees the card, and its QR code refreshes

- **Role:** RES-B
- **Checks:** FR-RES-5 · Must · D1
- **Set up first:** REG-10 done (RES-B is verified).
- **Steps:**
  1. Tap "My Account", then "Verification status", then "Use your Taytay digital ID".
  2. Read the card and the line under the QR code.
  3. Keep the screen open until the time shown in "valid until" has passed.
- **Expected result:**
  - "My Taytay ID" shows "NAME", the photo, "ID NUMBER", "STATUS" "Active", "ISSUED", "EXPIRES"
    and a QR code with "Code refreshes · valid until …".
  - At that time the app shows "Refreshing code…" and then a new QR code with a later time.

### ID-02 · Staff check a card from its code

- **Role:** INTAKE (any staff role can check a card), with RES-B
- **Checks:** FR-STAFF-2 · Must · D1
- **Set up first:** ID-01 done. A QR-reader app on a second phone, and a way to pass its text to the
  staff computer within 2 minutes (a handheld scanner that types, or the reader app's share
  button).
- **Steps:**
  1. Open "Digital IDs". Under "Check a resident’s card", click "Check this card" with the field
     empty.
  2. RES-B shows the card. Read the QR code with the reader and put its text into "The QR code’s
     contents". Click "Check this card".
  3. Click "Show the photo on the card". Read the dialog, then click "Open the photo".
  4. Click "Hide the photo", then "Clear the answer".
- **Expected result:**
  - Step 1 shows "Paste or type the code first.".
  - After step 2 the field is empty again, and "What the API says about this card" shows "Name",
    "Card" "Active", "Expiry" "Not expired" and "Barangay", with "The API says this card is
    active and not expired. Whether that settles what you are checking is your decision.".
  - Step 3: the dialog "Open this resident’s photo?" comes first; the photo shows only after
    "Open the photo".

### ID-03 · An old or altered code is not accepted

- **Role:** INTAKE, with RES-B
- **Checks:** FR-API-2, FR-STAFF-2 · Must · D1
- **Set up first:** ID-02 done. Keep the text of a code read more than 2 minutes ago.
- **Steps:**
  1. Put the old code into "The QR code’s contents" and click "Check this card".
  2. Read a fresh code, change one character in the middle, and click "Check this card".
- **Expected result:**
  - Both are refused with "Not checked: …" and the server's reason. Neither shows the card as
    active.

### ID-04 · Suspend a card

- **Role:** ADMIN, then RES-B
- **Checks:** FR-STAFF-2, FR-RES-5 · Must · D1
- **Set up first:** ID-01 done.
- **Steps:**
  1. Open "Digital IDs". Under "Residents’ cards", click "Open the card" on RES-B's row.
  2. Click "Suspend the card". Read the dialog "Suspend this card?" and click "Keep it as it is".
  3. Click "Suspend the card" again, then "Suspend it".
  4. RES-B: open "My Taytay ID" again.
- **Expected result:**
  - The dialog says what the resident sees ("The resident’s card stops working in the app: the app
    shows no QR code while it is suspended.") and "It keeps no reason: none is asked for.".
  - Step 2 changes nothing. Step 3 shows "The card was suspended." and "Status" "Suspended". The
    buttons left are "Revoke the card" and "Replace with a new card": there is no reinstate.
  - Step 4: the app shows "Your ID is suspended" and "No code is shown while the card is not
    active.".

### ID-05 · Replace a card

- **Role:** ADMIN, then RES-B
- **Checks:** FR-STAFF-2 · Must · D1
- **Set up first:** ID-04 done (RES-B's card is suspended).
- **Steps:**
  1. In RES-B's card, click "Replace with a new card", read "Replace this card?" and click
     "Replace it".
  2. RES-B: open "My Taytay ID".
- **Expected result:**
  - "The card was replaced. The new card is shown." with a new "Card number" and an active status.
  - The app shows the new card as "Active" with a QR code.

### ID-06 · Revoke a card, then issue a new one

- **Role:** ADMIN, then RES-B
- **Checks:** FR-STAFF-2, FR-API-2 · Must · D1
- **Set up first:** ID-05 done.
- **Steps:**
  1. In RES-B's card, click "Revoke the card", read "Revoke this card?" and click "Revoke it".
  2. RES-B: open "My Taytay ID".
  3. ADMIN: open RES-B's card again. Click "Issue a card", read "Issue a digital ID?" and click
     "Issue the card".
  4. RES-B: open "My Taytay ID".
- **Expected result:**
  - Step 1 shows "The card was revoked. It is no longer shown here.", and the card then reads "This
    resident holds no current card." with the button "Issue a card".
  - Step 2: the app shows "This ID is no longer valid" and no QR code.
  - Step 3 shows "The card was issued.". Step 4: the app shows an active card with a QR code.

### ID-07 · Moving an account off "verified" revokes its card

- **Role:** ADMIN, then RES-B
- **Checks:** FR-API-2, FR-STAFF-11 · Must · D1
- **Set up first:** ID-06 done (RES-B holds an active card).
- **Steps:**
  1. Open "Users and roles" and click "Manage" on RES-B's row.
  2. Under "Change the role to", choose "Resident". Read "What the server does if you change it to
     Resident:".
  3. Click "Change the role to Resident".
  4. Open "Digital IDs" and look for RES-B under "Residents’ cards". RES-B opens "My Taytay ID".
  5. Change RES-B back to "Verified resident" the same way, and issue a card as in ID-06 step 3.
- **Expected result:**
  - Step 2 says, before the button, what happens to the card.
  - After step 3 RES-B's card is revoked: the app shows "This ID is no longer valid".
  - After step 5 RES-B is verified again and holds a new active card.

### ID-08 · A check is not kept by the console

- **Role:** BLINK, then AUDITOR
- **Checks:** FR-STAFF-2, FR-API-4 · Must · D1
- **Set up first:** ID-06 done. The QR reader from ID-02.
- **Steps:**
  1. BLINK: open "Digital IDs" and check RES-B's card as in ID-02.
  2. Reload the page (F5), sign in again and open "Digital IDs".
  3. BLINK: scroll down to "Residents’ cards".
  4. AUDITOR: open "App audit trail".
- **Expected result:**
  - Step 1 shows the answer. After step 2 nothing of it is left on screen.
  - Step 3 shows "Keeping residents’ cards is for an administrator. You can check a card above.".
  - Step 4 has a row "Checked a resident’s digital ID" under BLINK's account: the API records the
    check, and the console keeps nothing.

## ROS: Residents registry, households, families

The registry under "Residents" is the office's own register of the people it serves. It is not the
list of app accounts, which is "Users and roles" (ADMIN only).

### ROS-01 · Register a resident

- **Role:** INTAKE
- **Checks:** FR-STAFF-9, NFR-PRIV-2 · Must · D2
- **Set up first:** The fictional resident "Ana Halimbawa" (README, "Test data").
- **Steps:**
  1. Open "Residents" and click "Register a resident".
  2. Click "Save record" with every field empty.
  3. Fill "First name" "Ana", "Last name" "Halimbawa", a fictional "Date of birth", "Sex" and
     "Civil status".
  4. In "PhilSys — last four digits only" type "12345" and click "Save record".
  5. Change it to "1234". Fill "Monthly income (₱)" "3500", "Barangay" "San Juan", "Street
     address" "UAT 1 Test Street" and "Mobile number" "09170000011".
  6. Under "Sectors" tick "Solo parent" and click "Save record".
  7. Fill "How was this established?" with "UAT: solo parent ID seen at the counter." and click
     "Save record".
- **Expected result:**
  - Step 2 lists the problems under "Check these before saving", such as "First name is
    required.".
  - Step 4 shows "PhilSys last four digits must be exactly four digits, or left blank.". The field
    hint says "The full PhilSys number is never recorded here (RA 11055)."
  - Step 6 shows "Say how these sectors were established before saving.".
  - Step 7 shows "Resident registered.". The record shows "PhilSys (last 4)" "1234" and never a
    longer number.

### ROS-02 · Find a resident with search and filters

- **Role:** INTAKE
- **Checks:** FR-STAFF-9 · Must · D2
- **Set up first:** ROS-01 done.
- **Steps:**
  1. Open "Residents". In "Search" type "Halimbawa".
  2. Set "Barangay" to "San Juan" and "Sector" to "Solo parent".
  3. Click "Clear filters". In "Search" type "Test Street".
- **Expected result:**
  - The columns are "Resident", "Barangay", "Age", "Sectors" and "Status". Ana shows with "Active".
  - Step 2 keeps Ana in the list.
  - Step 3 finds nobody ("No residents match those filters"): addresses and numbers are not
    searched, as the hint under the filters says.

### ROS-03 · Correct a resident's details

- **Role:** INTAKE
- **Checks:** FR-STAFF-9 · Must · D2
- **Set up first:** ROS-01 done.
- **Steps:**
  1. Open Ana's record and click "Edit record".
  2. Change "Mobile number" to "09170000012" and click "Save record".
- **Expected result:**
  - "Resident record updated." The record shows the new number, and nothing else changed.

### ROS-04 · Retire a record with a reason, and restore it

- **Role:** HEAD
- **Checks:** FR-STAFF-9, NFR-REC-1 · Must · D2
- **Set up first:** A second fictional resident, "Ben Halimbawa" of San Juan, registered as in
  ROS-01 (no PhilSys, no sectors).
- **Steps:**
  1. Open Ben's record and click "Retire record".
  2. In the dialog "Retire this record?" leave "Reason" empty and look at the "Retire record"
     button.
  3. Fill "Reason" with "UAT: retire test." and click "Retire record".
  4. Open "Residents" and search "Halimbawa". Then tick "Include retired records".
  5. Open Ben's record, click "Restore to active registry", give a reason and click "Restore
     record".
- **Expected result:**
  - In step 2 the button stays greyed out.
  - Step 3 shows "Record retired.". In step 4 Ben appears only once "Include retired records" is
    ticked, with "Retired".
  - Step 5 shows "Record restored to the active registry." and Ben is "Active" again.

### ROS-05 · A barangay link registers residents in its own barangay only

- **Role:** BLINK (barangay San Juan)
- **Checks:** FR-API-4, FR-STAFF-9 · Must · D2
- **Set up first:** A fictional resident "Dante Halimbawa" of Dolores, registered by INTAKE.
- **Steps:**
  1. Open "Residents" and search "Halimbawa".
  2. Click "Register a resident". Look for "PhilSys — last four digits only" and "Monthly income
     (₱)".
  3. Register "Elisa Halimbawa" with "Barangay" "Dolores" and click "Save record".
  4. Change "Barangay" to "San Juan" and click "Save record".
- **Expected result:**
  - Step 1 lists San Juan residents only: Ana and Ben, never Dante.
  - The form has no PhilSys or income field.
  - Step 3 is refused by the server and nothing is saved. Step 4 shows "Resident registered.".

### ROS-06 · Register a household

- **Role:** INTAKE
- **Checks:** FR-STAFF-10, NFR-DEC-1 · Must · D2
- **Set up first:** ROS-01 done.
- **Steps:**
  1. Open "Households" and click "Register a household".
  2. Click "Register household" with nothing filled in.
  3. Under "Head of the household" type "Halimbawa" and choose Ana.
  4. Choose "Barangay" "San Juan", fill "Street address" "UAT 1 Test Street", fill "Monthly
     household income (pesos)" and tick "Classified indigent".
  5. Click "Register household".
- **Expected result:**
  - Step 2 shows "Choose the barangay.", "Give the street address." and "Choose the head of the
    household.".
  - Step 5 shows "Household registered.". The household page shows "Members" 1 and the
    "Vulnerability snapshot" with "Advisory only. These indicators describe what the records say
    about this household. They do not decide eligibility, entitlement or any amount — a person
    does, and records why."
  - Nothing on the page shows a score, an eligibility verdict or an approval.

### ROS-07 · Add and remove a household member, with a reason

- **Role:** INTAKE
- **Checks:** FR-STAFF-10, NFR-REC-1 · Must · D2
- **Set up first:** ROS-04 and ROS-06 done.
- **Steps:**
  1. Open the household and click "Edit members".
  2. Under "Add someone to this household" type "Halimbawa" in "Find a resident" and choose Ben.
  3. Set Ben's role to "Child". Look at "Save changes" while "Why is this changing?" is empty.
  4. Fill "Why is this changing?" with "UAT: son lives here." and click "Save changes".
  5. Click "Edit members" again, click "Remove" on Ben, give a reason and click "Save changes".
- **Expected result:**
  - Ben appears tagged "Not saved yet", and "Changes waiting to be saved" lists him.
  - "Save changes" stays greyed out until a reason is typed.
  - Steps 4 and 5 each show "Household members updated.".
  - "What has been done to this record" lists both changes with who, when and "Reason: …". The
    entry adding Ben is still there after he is removed.

### ROS-08 · The vulnerability snapshot is advice; a person corrects it with a reason

- **Role:** HEAD
- **Checks:** FR-STAFF-10, NFR-DEC-1 · Must · D2
- **Set up first:** ROS-06 done.
- **Steps:**
  1. Open the household. In "Vulnerability snapshot" click "Show the working".
  2. Click "Correct this" on any indicator.
  3. Choose a value in "What is actually the case?". In "Why?" type "UAT" and look at "Save
     correction".
  4. Type a full sentence starting "UAT:" and click "Save correction".
  5. Click "Use the computed value", then "Withdraw correction".
- **Expected result:**
  - Each indicator says how it was worked out and which records it read.
  - In step 3 "Save correction" stays greyed out.
  - Step 4 shows "Indicator corrected." and the indicator reads "Corrected by a person". Step 5
    shows "Correction withdrawn.".
  - Both acts appear in "What has been done to this record".

### ROS-09 · Record a family

- **Role:** INTAKE
- **Checks:** FR-STAFF-10 · Must · D2
- **Set up first:** ROS-06 and ROS-07 done (Ben has left the household, which is fine: a family is
  not a household).
- **Steps:**
  1. Open "Families" and click "Record a family". Click "Record family" with nothing filled in.
  2. Fill "Name" with "UAT Halimbawa family".
  3. Under "Members" use "Add a member" to add Ana (she becomes "Family head") and Ben. Set Ben's
     role to "Child".
  4. Under "Where they live", find Ana's household and click "Live here".
  5. Fill "Why is this family being recorded?" and click "Record family".
- **Expected result:**
  - Step 1 shows "Give the family a name of up to 120 characters.", "Add at least one member." and
    "Say why the family is being recorded.".
  - Step 5 shows "Family recorded.". The family page lists both members, and its history shows
    "Family recorded" with the reason.

### ROS-10 · Record a relationship between two residents

- **Role:** INTAKE
- **Checks:** FR-STAFF-10, NFR-REC-1 · Must · D2
- **Set up first:** ROS-09 done.
- **Steps:**
  1. On the family page click "Record a relationship".
  2. Fill "This person" Ana, "is the" "parent of", "of" Ben, and "Why is this being recorded?".
     Click "Record relationship".
  3. Record the same relationship again.
- **Expected result:**
  - Step 2 shows "Relationship recorded." and the relationship is listed. The history shows
    "Relationship recorded".
  - Step 3 is refused with "That relationship is already recorded.".

### ROS-11 · Move a person out of a family; the earlier entries remain

- **Role:** INTAKE
- **Checks:** FR-STAFF-10, NFR-REC-1 · Must · D2
- **Set up first:** ROS-10 done.
- **Steps:**
  1. On the family page click "Move someone".
  2. Choose Ben in "Who is moving?" and "No family — out of this one only" in "Which family are
     they joining?".
  3. Fill "Why?" with "UAT: moved out of the family." and click "Record the move".
- **Expected result:**
  - "The move has been recorded." Ben is shown as "Former member".
  - The history keeps the earlier entries, such as "Joined the family", and adds the move with its
    reason.

### ROS-12 · Each role sees only its own scope

- **Role:** ADMIN, HEAD, INTAKE, SW1, RELEASE, BLINK, AUDITOR (one after another)
- **Checks:** FR-STAFF-9, FR-STAFF-11, FR-API-4 · Must · D2
- **Set up first:** ROS-05, ROS-06 and ROS-09 done.
- **Steps:**
  1. Sign in as each role in turn. Open "Residents", "Households", "Families" and "Dashboard".
  2. As ADMIN also open "Users and roles".
  3. As each other role, type the address https://taytay.139-162-51-165.sslip.io/users.
- **Expected result:**
  - ADMIN, HEAD, INTAKE, RELEASE and AUDITOR see residents, households and families of every
    barangay. Only ADMIN, HEAD and INTAKE see "Register a resident".
  - BLINK sees San Juan only.
  - SW1 is not shown the registry lists: it opens a person only through a request or case assigned
    to it.
  - "Users and roles" lists app accounts (columns "Name", "Email", "Role", "Office"), separate
    from the registry. Every role but ADMIN gets "You do not have access to that section".

## DSH: Dashboard

### DSH-01 · The dashboard shows its figures and when they were counted

- **Role:** HEAD
- **Checks:** FR-STAFF-22, NFR-MON-1 · Must · D2
- **Set up first:** Some requests and releases exist (run after REQ and REL).
- **Steps:**
  1. Open "Dashboard".
  2. Read the four headline figures, the three tables and the line at the foot of the page.
  3. Click "Refresh".
- **Expected result:**
  - The figures are "Open requests", "Awaiting approval", "Scheduled payouts" and "Released". The
    tables are "Requests by status", "Requests by barangay" and "Released by programme type".
  - "Released" is in pesos (₱, two decimals) and says separately how many releases of goods there
    were, "counted and not valued".
  - The foot reads "Figures generated …" with the date and time. Step 3 updates it.

### DSH-02 · Each request figure equals the list it opens

- **Role:** HEAD
- **Checks:** FR-STAFF-22 · Must · D2
- **Set up first:** DSH-01 done.
- **Steps:**
  1. Note the number under "Open requests" and click it.
  2. Count the rows. Click "Show more" until the page says "That is every request matching these
     filters.".
  3. Go back. Do the same for "Awaiting approval", and for two rows of "Requests by status".
- **Expected result:**
  - Each list opens already filtered ("Open requests only" ticked, or the status chosen in
    "Status"), and its number of rows equals the figure that opened it.

### DSH-03 · Each barangay figure equals the list it opens

- **Role:** HEAD
- **Checks:** FR-STAFF-22 · Must · D2
- **Set up first:** Requests exist in at least two barangays.
- **Steps:**
  1. In "Requests by barangay", note the San Juan figure and click the row.
  2. Count the requests in the list that opens.
- **Expected result:**
  - The list shows San Juan's requests only, and their count equals the figure.

### DSH-04 · Each payout figure equals the list it opens

- **Role:** HEAD
- **Checks:** FR-STAFF-22 · Must · D2
- **Set up first:** REL-04 and REL-06 done (scheduled and released payouts exist).
- **Steps:**
  1. Note the number under "Scheduled payouts" and click it. Count the releases shown.
  2. Go back. Click "Released" and count the released ones.
- **Expected result:**
  - Each list opens filtered to its status ("Scheduled", "Released"), and the counts match the
    figures.

### DSH-05 · Each role sees the figures of its own scope

- **Role:** INTAKE, SW1, BLINK, RELEASE
- **Checks:** FR-STAFF-22, FR-API-4 · Must · D2
- **Set up first:** DSH-01 done.
- **Steps:**
  1. Sign in as each role and open "Dashboard".
  2. Read "What needs attention now" and the headline figures.
- **Expected result:**
  - INTAKE, SW1 and BLINK see no payout figures, and the sentence "Payout figures are not shown:
    your role does not open the releases they count.".
  - SW1's figures count only the requests assigned to SW1. BLINK's count only San Juan.
  - "What needs attention now" shows only cards for acts the role can take (for example "… requests
    waiting for approval" is not shown to INTAKE).

### DSH-06 · Filters recalculate the figures; quick actions open their screens

- **Role:** HEAD
- **Checks:** FR-STAFF-22 · Must · D2
- **Set up first:** DSH-01 done.
- **Steps:**
  1. Set "Barangay" to "San Juan".
  2. Set "Period" to "Last 30 days", then click "Clear filter".
  3. Under "Quick actions" click "Record a request". Go back and click "Schedule payouts".
- **Expected result:**
  - Step 1 shows "Every figure below is calculated under this filter." and the figures change.
    Step 2 brings back the unfiltered figures.
  - "Record a request" opens "New assistance request". "Schedule payouts" opens the releases
    waiting to be scheduled.

### DSH-07 · The residents' app figures (administrator)

- **Role:** ADMIN, then HEAD
- **Checks:** FR-STAFF-22, FR-STAFF-1 · Must · D2
- **Set up first:** REG-08 to REG-11 done.
- **Steps:**
  1. ADMIN: open "Dashboard" and scroll to "The residents’ app".
  2. Note "ID reviews waiting" and click it. Count the requests under "Awaiting review".
  3. Go back. Click "Resident accounts", then "Digital IDs in force".
  4. Click the "Waiting for an ID review" row of "Resident accounts by verification".
  5. HEAD: open "Dashboard".
- **Expected result:**
  - "ID reviews waiting" equals the "Awaiting review" count. "Resident accounts" opens "Users and
    roles"; "Digital IDs in force" opens "Digital IDs".
  - Step 4 opens the ID review queue.
  - HEAD does not see the section "The residents’ app".

## DIR: Directory, home screen and app settings

### DIR-01 · A resident searches the directory and opens an office

- **Role:** GUEST
- **Checks:** FR-RES-6 · Must · D3
- **Set up first:** At least one office in the directory (for example the MSWDO).
- **Steps:**
  1. Tap "Directory". In "Search offices or services" type part of an office's name.
  2. Tap the office.
- **Expected result:**
  - The search narrows the list.
  - The office page shows the buttons "Call", "Directions" and "Message", the details "Location",
    "Office hours", "Phone", "Email" and "Head", and a "Services" card.

### DIR-02 · Only a verified resident can message an office

- **Role:** GUEST, RES-A (not verified), RES-B (verified)
- **Checks:** FR-RES-6, FR-RES-10 · Must · D3
- **Set up first:** REG-03 done for RES-A and REG-10 for RES-B.
- **Steps:**
  1. As GUEST, open an office and tap "Message".
  2. As RES-A, do the same.
  3. As RES-B, do the same.
- **Expected result:**
  - GUEST gets "Sign in to continue", with "Sign in", "Create an account" and "Keep browsing".
  - RES-A gets "Verify your account to message offices", with "Continue verification" and "Not
    now".
  - RES-B gets "New message", with "To", "Topic", "Message", "Attach photo or PDF (optional)" and
    "Send message".

### DIR-03 · Hotlines in the app

- **Role:** GUEST
- **Checks:** FR-RES-7, FR-RES-6 · Must · D3
- **Set up first:** At least one hotline is shown in the app (DIR-10 can add one).
- **Steps:**
  1. On "Home", under "Emergency", tap "All hotlines".
  2. Tap the round call button beside a hotline.
- **Expected result:**
  - "Emergency hotlines" lists the lines under "Municipal" and "Barangay".
  - The phone's dialler opens with that number. Nothing is dialled until you press call.

### DIR-04 · Tulong pages are information only

- **Role:** GUEST
- **Checks:** FR-RES-13 · Should · D3
- **Set up first:** At least one Tulong page in the catalogue.
- **Steps:**
  1. Tap "Tulong". In "Search programmes" type part of a page's name.
  2. Open the page.
- **Expected result:**
  - The tab says "Information on municipal programmes. These are information pages, not
    applications.".
  - The page shows "Who can avail" and "Requirements (information only)". There is no "Apply"
    button anywhere.

### DIR-05 · The administrator adds an office, and the app shows it

- **Role:** ADMIN, then GUEST
- **Checks:** FR-STAFF-3 · Must · D3
- **Set up first:** None.
- **Steps:**
  1. Open "App directory", tab "Offices", and click "Add an office".
  2. Click "Add the office" with nothing filled in.
  3. Fill "Name" "UAT Test Office", "Address in the app" "UAT Test" and click "Add the office".
  4. Change "Address in the app" to "uat-test-office". Fill "Short name" "UAT", "Category",
     "Office hours", a fictional "Phone" and an "Email". Read "What this does:". Click "Add the
     office".
  5. GUEST: open "Directory" and search "UAT".
- **Expected result:**
  - Step 2 shows "Not sent — the app would refuse it:" with "Give the office a name.".
  - Step 3 shows "An address is lower-case letters and numbers, in words joined by single hyphens,
    such as civil-registrar.".
  - Step 4 shows "UAT Test Office was added to the app’s directory.".
  - Step 5 finds the office (reopen the tab if needed).

### DIR-06 · The administrator changes an office

- **Role:** ADMIN, then GUEST
- **Checks:** FR-STAFF-3 · Must · D3
- **Set up first:** DIR-05 done.
- **Steps:**
  1. Click "Edit" on "UAT Test Office". Read the part "Set when the office was created".
  2. Change "Name" to "UAT Test Office 2" and click "Save changes".
  3. GUEST: open the office in "Directory".
- **Expected result:**
  - Step 2 shows "UAT Test Office 2 was saved.".
  - The app shows the new name.

### DIR-07 · A wrong or oversized image is refused before it is sent

- **Role:** ADMIN
- **Checks:** FR-STAFF-3 · Must · D3
- **Set up first:** DIR-05 done. A 6 MB photo, a PDF and a small JPEG (test images only).
- **Steps:**
  1. Click "Edit" on the test office. Under "Banner", choose the 6 MB photo.
  2. Choose the PDF (switch the file dialog to "All files").
  3. Choose the small JPEG and click "Save changes".
  4. GUEST: open the office in the app.
- **Expected result:**
  - Step 1 shows "That file is 6 MB. The app takes images up to 5 MB; save a smaller copy and
    choose it again.". Nothing is sent.
  - Step 2 shows "That file is not a JPEG, PNG or WebP image, whatever its name says. …".
  - Step 3 is saved, and the app shows the banner on the office page.

### DIR-08 · Deleting an office goes through a confirmation

- **Role:** ADMIN, then GUEST
- **Checks:** FR-STAFF-3 · Must · D3
- **Set up first:** DIR-07 done.
- **Steps:**
  1. Click "Delete" on the test office. Read the dialog and click "Keep it".
  2. Click "Delete" again, then "Delete UAT Test Office 2".
  3. GUEST: search "UAT" in "Directory".
- **Expected result:**
  - The dialog "Delete UAT Test Office 2?" lists "What this does:" before its buttons. "Keep it"
    changes nothing.
  - Step 2 shows "UAT Test Office 2 was deleted from the app’s directory.". The app no longer
    finds it.

### DIR-09 · A Tulong page: add, hide, find by its address, delete

- **Role:** ADMIN, then GUEST
- **Checks:** FR-STAFF-3, FR-RES-13 · Must · D3
- **Set up first:** None.
- **Steps:**
  1. In "App directory", tab "Tulong pages", click "Add a page".
  2. Fill "Name" "UAT test page", "Address in the app" "uat-test-page", "Category", "Summary" and
     "Details". Click "Add the page".
  3. GUEST: find "UAT test page" in "Tulong".
  4. ADMIN: in the page, tick "Hide from the app’s catalogue" and click "Save changes".
  5. GUEST: search "UAT" in "Tulong".
  6. ADMIN: in "Open a page by its address" type "uat-test-page" and click "Open".
  7. Click "Delete" on the page, then "Delete UAT test page".
- **Expected result:**
  - Step 2 shows "UAT test page was added. Add its picture or feature it below.". The app shows it.
  - After step 4 the page leaves the admin list and the app no longer lists it.
  - Step 6 opens the hidden page. Step 7 shows "UAT test page was deleted from the app.".

### DIR-10 · A hotline: add, hide, delete

- **Role:** ADMIN, then GUEST
- **Checks:** FR-STAFF-3, FR-RES-7 · Must · D3
- **Set up first:** None.
- **Steps:**
  1. In "App directory", tab "Hotlines", click "Add a hotline".
  2. Fill "Name" "UAT test line", a fictional "Number", "Kind of line" "Test" and "Order" "999".
     Leave "Show in the app" ticked. Click "Add the hotline".
  3. GUEST: open "All hotlines".
  4. ADMIN: click "Edit", untick "Show in the app", click "Save changes". GUEST: reopen the list.
  5. ADMIN: click "Delete", then "Delete UAT test line".
- **Expected result:**
  - "UAT test line was added." The app lists it in step 3 and not after step 4.
  - The hotline list in the console shows "Hidden from the app" after step 4. Step 5 shows "UAT
    test line was deleted.".

### DIR-11 · Home screen banners and quick links reach the app

- **Role:** ADMIN, then GUEST
- **Checks:** FR-STAFF-6, FR-RES-7 · Must · D3
- **Set up first:** A small JPEG for the banner. At least one featured Tulong page.
- **Steps:**
  1. Open "Home screen" and click "Add a banner". Fill "Title" "UAT banner", "Order" "999", choose
     the JPEG under "Banner image", read the warnings, and click "Add the banner".
  2. Click "Add a link". Fill "Label" "UAT link", "Opens" and "Order", and click "Add the link".
  3. Read "What the app shows now".
  4. GUEST: pull down on "Home" to refresh it.
  5. ADMIN: delete the banner ("Delete the banner") and the link ("Delete the link").
- **Expected result:**
  - Step 1 shows "The banner UAT banner was added." and the sentence that the app keeps no
    description of a banner's image.
  - Step 3 lists the banner and the link.
  - Step 4: Home shows the new banner, the new quick link, the hotlines under "Emergency", "Latest
    Balita" and the featured Tulong pages.

### DIR-12 · A change to the app's settings is reviewed in a confirmation

- **Role:** ADMIN
- **Checks:** FR-STAFF-6 · Must · D1
- **Set up first:** Agree a test value for "Contact line" with the administrator. Do not save a new
  "Oldest app version allowed" or a new terms version: it would stop every tester's app.
- **Steps:**
  1. Open "App settings". Change "Contact line" and click "Review the change".
  2. Read the dialog "Change the app’s settings?" and click "Save the settings".
  3. Type a higher number in "Oldest app version allowed" and click "Review the change".
  4. Look at "Save the settings", tick "I understand this can stop residents using the app until
     they update it or accept again.", then click "Go back" without saving. Undo the change.
- **Expected result:**
  - The dialog lists "What this does:" before its button. Step 2 shows "The settings were saved.
    Residents’ apps read them the next time they load.".
  - In step 3 the dialog warns that this can force every resident with an older app to update.
  - In step 4 "Save the settings" stays greyed out until the box is ticked. Nothing is saved.

## REQ: Assistance requests

The cases follow one test request, "R1", for Ana Halimbawa from intake to approval. "R2" and "R3"
are second and third requests used where noted. Write down each control number as it is issued.

### REQ-01 · A programme says who runs it and who holds the funds

- **Role:** INTAKE
- **Checks:** FR-STAFF-13, NFR-DEC-1 · Must · T-8
- **Set up first:** AICS is recorded in "Programs" (if not, run REQ-02 first).
- **Steps:**
  1. Open "Programs" and open AICS.
  2. Read "Whose programme this is", "What this programme looks for" and "Documents asked for".
- **Expected result:**
  - AICS names "DSWD" as the agency, with the municipality's part shown as referring or adding its
    own funds, never as running it. It says "The MSWDO does not decide this one. Tell the
    applicant what happens next and who decides, and do not promise an outcome."
  - Each guideline shows a weight ("Expected", "Usual, with exceptions" or "Worth knowing") and its
    basis. Nothing on the page refuses anybody.
  - Each document is tagged "Required", "Optional" or "Required in some cases".

### REQ-02 · The head saves a programme only with a reason

- **Role:** HEAD
- **Checks:** FR-STAFF-13 · Must · T-8
- **Set up first:** None.
- **Steps:**
  1. Open "Programs" and click "New programme" (or open a programme and click "Edit this
     programme").
  2. Under "Whose programme it is", set "Administered by" to "DSWD" and "The municipality’s part"
     to the option saying the municipality runs it.
  3. Change "The municipality’s part" to the option saying it refers into the programme.
  4. Leave "Why — kept with this version" empty and click "Save the programme".
  5. Fill "Why — kept with this version" with "UAT: test change." and click "Save the programme".
- **Expected result:**
  - Step 2 shows "A programme administered by a national agency cannot be recorded as one the
    municipality runs. Choose referrer, augmenter or facilitator."
  - Step 4 shows "Say why, in words. The reason is kept beside the version it explains.".
  - Step 5 shows "The programme has been saved.".

### REQ-03 · Start an intake and save it as a draft: no control number yet

- **Role:** INTAKE
- **Checks:** FR-STAFF-15 · Must · T-9
- **Set up first:** ROS-01 done. An active programme that lists at least one "Required" document.
- **Steps:**
  1. Open "Assistance requests" and click "Start an intake".
  2. On "Who is this for?", type "Halimbawa" in "Applicant" and choose Ana. Read the panel "What
     the office already knows".
  3. Click "Next". On "What is the assistance for?" choose "Walk-in" in "How did this reach the
     office?", choose the programme, describe the need in a sentence, and type "5000" in "Amount
     requested (₱)".
  4. Click "Save and finish later".
  5. Go back to "Assistance requests".
- **Expected result:**
  - The steps are "Person", "Request", "Checks" and "Review" ("Step N of 4").
  - Step 4 shows "Saved. You can come back to this from the request list." and the heading becomes
    "Unfinished intake".
  - Step 5 lists the draft under "Unfinished intakes" as "Not yet filed", with "Resume". No control
    number is shown anywhere.

### REQ-04 · Resume the draft and file it: the control number is issued

- **Role:** INTAKE
- **Checks:** FR-STAFF-15, FR-STAFF-16 · Must · T-9
- **Set up first:** REQ-03 done.
- **Steps:**
  1. Click "Resume" on the draft.
  2. Click "Checks". Under "Documents", tick "Presented" for each document the "applicant"
     brought, or tick "Waive" and say why.
  3. Click "Review". Read "Still to do" or "Everything needed is here.".
  4. Click "File the request".
- **Expected result:**
  - The person chosen in REQ-03 is still chosen.
  - "File the request" can be clicked only once "Everything needed is here." shows.
  - Step 4 shows "The request has been filed and given a control number.". The request page's
    heading is the control number (R1). "Status" is "Submitted". "History" shows the first entry.

### REQ-05 · The duplicate check advises; it never decides

- **Role:** INTAKE
- **Checks:** FR-STAFF-15, NFR-DEC-1 · Must · T-9
- **Set up first:** REQ-04 done (Ana has a filed request).
- **Steps:**
  1. Start another intake for Ana with the same programme (as in REQ-03, steps 1 to 3).
  2. Click "Next" to "Checks" and read "Duplicate and previous-assistance check".
  3. If a block "Before filing" appears, look at "File the request" on the Review step. Then fill
     "Why is this going ahead?" with "UAT: second request on purpose for the test.".
  4. Finish the documents and click "File the request".
- **Expected result:**
  - The panel says "This check reports what the records say. It does not approve, refuse, score or
    rank anybody — a person decides, and records why." Each finding is marked "For information" or
    "Worth a second look" and shows "Rule applied: …" and "Records read: …".
  - No score, verdict or "eligible" appears.
  - A "Worth a second look" finding asks for the sentence; nothing else stops filing. The request
    files (R2), and the sentence is kept with it.

### REQ-06 · Every move needs a reason, and the history says who, when and why

- **Role:** INTAKE
- **Checks:** FR-STAFF-16, NFR-REC-1 · Must · T-9
- **Set up first:** REQ-04 done.
- **Steps:**
  1. Open R1. Under "Move this request on", choose "Intake review" in "Move to".
  2. Leave "Why is it moving?" empty and look at "Record the move". Type "UAT".
  3. Type a full reason starting "UAT:" and click "Record the move".
  4. Move it to "Returned" with a reason, then back to "Intake review" with a reason.
  5. Read "History".
- **Expected result:**
  - In step 2 "Record the move" stays greyed out, and "UAT" brings "Say a little more — a
    colleague reading this in two years has only these words.".
  - Step 3 shows "The request has been moved." and "Status" "Intake review".
  - "History" lists each move ("Submitted → Intake review", and so on) with the date, time, your
    name and the reason.

### REQ-07 · The head assigns a request to a social worker

- **Role:** HEAD
- **Checks:** FR-STAFF-16, FR-API-4 · Must · T-9
- **Set up first:** REQ-06 done (R1 is in "Intake review").
- **Steps:**
  1. Open R1. Choose SW1 in "Assign to". Leave "Why" empty and click "Assign for assessment".
  2. Fill "Why" and click "Assign for assessment".
- **Expected result:**
  - Step 1 shows "Say why this request is being assigned. Every assignment is kept with its reason,
    and nothing was sent.".
  - Step 2 shows "The request has been assigned." and "Assigned for assessment to …" with SW1's
    name. The assignment shows its date, who made it and why.

### REQ-08 · A social worker sees only the requests assigned to them

- **Role:** SW1, then SW2
- **Checks:** FR-API-4 · Must · T-9
- **Set up first:** REQ-07 done. Copy R1's page address from SW1's browser.
- **Steps:**
  1. SW1: open "Assistance requests".
  2. SW2: open "Assistance requests". Then paste R1's address into the address bar.
- **Expected result:**
  - SW1 sees "Your caseload: the filed requests assigned to you for assessment. …" and R1 in the
    list. There is no "Start an intake" button.
  - SW2's list does not show R1. The pasted address shows "That request is not available".

### REQ-09 · The case study: a person recommends, the software does not

- **Role:** SW1
- **Checks:** FR-STAFF-17, NFR-DEC-1 · Must · T-9
- **Set up first:** REQ-07 done. An assessment form is available on staging.
- **Steps:**
  1. Open R1 and move it to "Assessment" with a reason.
  2. Choose a form in "Assessment form" and click "Open the assessment".
  3. Answer the questions (required ones end in "*") and click "Save the answers".
  4. Look at "What you recommend" before changing it.
  5. Fill "Findings" with at least 20 characters, tick "A home visit was conducted", type "3000" in
     "Recommended amount (₱)", choose "Recommend approval" and click "Save the case study".
- **Expected result:**
  - Step 3 shows "The answers have been recorded.".
  - In step 4 "What you recommend" reads "Not enough information to recommend": nothing was filled
    in for you, and no amount is suggested.
  - Step 5 shows "The case study has been saved.". The request stays in "Assessment" ("Saving the
    case study keeps it on the request and moves it nowhere.").

### REQ-10 · Record a document: its number shows only the last four characters

- **Role:** INTAKE
- **Checks:** FR-STAFF-17 · Must · T-9
- **Set up first:** REQ-04 done. A test PDF under 10 MB, and a test file over 10 MB.
- **Steps:**
  1. Open R1. On a "Required" document, choose "Uploaded by staff" in "How the office has it".
  2. Under "Add a copy" choose the file over 10 MB.
  3. Choose the test PDF instead. In "Number on the document (optional)" type "UAT-123456789".
  4. Click "Record this document".
- **Expected result:**
  - Step 2 shows "That file is … MB. The largest this office accepts is 10 MB — …".
  - The number field's hint says "Only its last four characters are kept — nothing longer is sent
    or stored. The file itself is the full record."
  - Step 4 shows "That document was recorded. …". "Document number" reads "••••6789". The full
    number appears nowhere.

### REQ-11 · Replace a document: the old version is kept, marked superseded

- **Role:** INTAKE
- **Checks:** FR-STAFF-17, NFR-REC-1 · Must · T-9
- **Set up first:** REQ-10 done.
- **Steps:**
  1. On the same document, record a new copy (another test PDF).
  2. Leave "Why is this replacing the copy already held?" empty and look at "Record this
     document".
  3. Fill the reason and click "Record this document".
  4. Open "1 earlier version, kept on file".
- **Expected result:**
  - In step 2 the button stays greyed out.
  - After step 3 the earlier version is listed as "Version 1" with its date, who recorded it and
    "Replaced because: …". Nothing was deleted.

### REQ-12 · Reviewing a document needs remarks to reject or excuse it

- **Role:** INTAKE
- **Checks:** FR-STAFF-17 · Must · T-9
- **Set up first:** REQ-10 done. R1 lists a second document with nothing presented yet.
- **Steps:**
  1. On the recorded document, leave "Remarks" empty and click "Reject".
  2. On the document with nothing presented, leave "Remarks" empty and click "Waive".
  3. Fill "Remarks" on the recorded document and click "Verify".
  4. Read the count line above the documents.
- **Expected result:**
  - Step 1 shows "Say why the document was not accepted. The applicant has to be told what to bring
    instead.".
  - Step 2 shows "Say why the document is being excused. An excuse nobody gave a reason for reads as
    an oversight.".
  - Step 3 shows "The review has been recorded." and the status "Verified".
  - The count reads like "1 of 2 required documents settled.", with "Counts what has been settled.
    It is not a decision — eligibility is assessed by a caseworker."

### REQ-13 · A file opens only after a warning

- **Role:** SW1, then INTAKE
- **Checks:** FR-STAFF-17 · Must · T-9
- **Set up first:** REQ-10 done.
- **Steps:**
  1. SW1: open R1 and click "Open document" on the recorded document.
  2. Read the dialog "Before you open this" and click "Cancel".
  3. Click "Open document" again, then "Open it".
  4. INTAKE: open R1 and look for "Open document".
- **Expected result:**
  - The dialog names the file and warns that it holds personal information and that opening it is
    recorded.
  - Step 3 shows "The file has arrived in this tab only." and a link to the file.
  - INTAKE has no "Open document" button.

### REQ-14 · Ask the applicant for a document, and withdraw the ask

- **Role:** INTAKE
- **Checks:** FR-STAFF-17 · Must · T-9
- **Set up first:** REQ-04 done.
- **Steps:**
  1. Open R1. Under a document click "Ask the applicant for this".
  2. Choose "Told at the counter" in "How they were told". Leave "What they were told" empty.
  3. Fill "What they were told", pick a date in "Needed by (optional)" and click "Record the
     request".
  4. Click "No longer needed", fill "Why is this no longer needed?" and click "Withdraw the
     request".
- **Expected result:**
  - Step 2 shows "Say what the applicant was told. …" and the button stays greyed out.
  - After step 3, "Asked for" shows "Waiting on the applicant · Told at the counter · Needed by …".
  - After step 4 the entry reads "No longer needed".

### REQ-15 · The social worker endorses the request

- **Role:** SW1
- **Checks:** FR-STAFF-16 · Must · T-9
- **Set up first:** REQ-09 done.
- **Steps:**
  1. Open R1. Read "Before endorsing".
  2. Move R1 to "Endorsed" with a reason.
- **Expected result:**
  - "Before endorsing" lists what is outstanding (or "Nothing outstanding.") but does not stop the
    move.
  - Step 2 shows "The request has been moved." and "Status" "Endorsed".

### REQ-16 · The head approves with an approved amount in pesos

- **Role:** HEAD
- **Checks:** FR-STAFF-16, FR-STAFF-19, NFR-MON-1 · Must · T-9
- **Set up first:** REQ-15 done.
- **Steps:**
  1. Open R1. Under "Approve this request" read "Asked for: ₱5,000.00. Recommended by the
     assessment: ₱3,000.00.".
  2. Keep "An amount of money". In "Approved amount (₱)" type "3,000.505". Fill "Why it is
     approved" and click "Approve".
  3. Change the amount to "3,000.50". Clear "Why it is approved" and click "Approve".
  4. Fill "Why it is approved" with a full sentence and click "Approve".
- **Expected result:**
  - Step 2 shows "Enter the approved amount in pesos, like 3,000 or 3,000.50. Nothing was sent.".
  - Step 3 shows "Say why it is approved, in 8 characters or more. Nothing was sent.".
  - Step 4 shows "The request has been approved.", "Status" "Approved" and "Approved" "₱3,000.50".

### REQ-17 · The head approves goods: described, never priced

- **Role:** HEAD
- **Checks:** FR-STAFF-19 · Must · T-9
- **Set up first:** R2 (REQ-05) taken to "Endorsed" as in REQ-06, REQ-07, REQ-09 and REQ-15.
- **Steps:**
  1. Open R2. Under "What is approved" choose "Goods".
  2. Fill "What goods are approved" with "UAT: 1 sack of rice", fill "Why it is approved", and click
     "Approve".
- **Expected result:**
  - There is no peso field for goods ("Goods are described, never priced.").
  - "Approved" reads "Goods: UAT: 1 sack of rice", with no peso value.

### REQ-18 · A rejected request is final

- **Role:** HEAD
- **Checks:** FR-STAFF-16 · Must · T-9
- **Set up first:** A third request, R3, filed for Ana and moved to "Intake review".
- **Steps:**
  1. Open R3. Move it to "Rejected" with a reason.
  2. Look at "Move this request on".
- **Expected result:**
  - "Status" is "Rejected" and the history keeps the reason.
  - No further move is offered: the request cannot be moved on or brought back.

### REQ-19 · A request is not cancelled while its release stands

- **Role:** HEAD
- **Checks:** FR-STAFF-16, FR-STAFF-19 · Must · T-9
- **Set up first:** REL-01 done (R1 has a prepared release). REL-06 not yet run.
- **Steps:**
  1. Open R1 and read the box above "Move this request on".
  2. Open the "Move to" list.
- **Expected result:**
  - The page says "Release … A request is not cancelled or expired while its release stands: void
    the release first, by its own act, and then this request can be ended." with "Open the
    release".
  - "Cancelled" and "Expired" are not offered.

## CAS: Cases

A case is the office's continuing file on a person. It outlives the requests inside it.

### CAS-01 · Open a case about one person

- **Role:** INTAKE
- **Checks:** FR-STAFF-18 · Must · Casework
- **Set up first:** REQ-04 done (Ana has R1).
- **Steps:**
  1. Open "Cases" and click "Open a case".
  2. In "The person the file is about" type "Halimbawa" and choose Ana.
  3. Choose a kind in "What kind of case is this?". In "The presenting problem" type "UAT".
  4. Replace it with a full sentence. Under "Requests this case covers (optional)" tick R1.
  5. Fill "Why is the office opening this case?" and click "Open the case".
- **Expected result:**
  - Step 3 shows "Say a little more — at least 8 characters.".
  - Step 5 shows "The case is open, at intake and assigned to nobody.". The case page's heading is
    the case number, "Assistance on this case" lists R1, and "What has happened" shows "Case
    opened".

### CAS-02 · Assign the case and move it on

- **Role:** INTAKE
- **Checks:** FR-STAFF-18, FR-API-4 · Must · Casework
- **Set up first:** CAS-01 done.
- **Steps:**
  1. Click "Assign this case". Choose SW1 in "Social worker", give a reason and click "Record the
     assignment".
  2. Under "Move this case on", choose "Assessment" in "Move to", give a reason and click "Record
     the move".
- **Expected result:**
  - Step 1 shows "The assignment has been recorded." and "Assigned to:" SW1.
  - Step 2 shows "The case has been moved, and the change is on the timeline.".
  - "What has happened" lists "Assigned" and "Status changed" with the date, name and "Reason given:
    …".

### CAS-03 · A social worker sees only the cases assigned to them

- **Role:** SW1, then SW2
- **Checks:** FR-API-4 · Must · Casework
- **Set up first:** CAS-02 done. Copy the case's address from SW1's browser.
- **Steps:**
  1. SW1: open "Cases".
  2. SW2: open "Cases", then paste the case's address.
- **Expected result:**
  - SW1 sees "These are the cases assigned to you. …" and the case. Neither SW1 nor SW2 has "Open a
    case".
  - SW2 does not see the case, and the address shows "That case is not available".

### CAS-04 · Add a task and complete it

- **Role:** SW1
- **Checks:** FR-STAFF-18 · Must · Casework
- **Set up first:** CAS-02 done.
- **Steps:**
  1. Open the case and click "Add a task".
  2. Fill "What has to be done?", choose "Kind" "Home visit", pick a date in "Due by", choose
     yourself in "Owed by", and fill "Why is this needed?". Click "Add the task".
  3. On the task click "Mark as done". Fill "What happened?" and click "Record the outcome".
- **Expected result:**
  - Step 2 shows "The task has been added." and "What happens next" names the task, its date and
    who owes it.
  - Step 3 shows "The task has been completed." and the task reads "Done" with "Outcome: …".

### CAS-05 · Move a task's date and hand it over

- **Role:** SW1
- **Checks:** FR-STAFF-18 · Must · Casework
- **Set up first:** CAS-02 done. Add a new task owed by SW1 as in CAS-04, step 2.
- **Steps:**
  1. Click "Move the date". Pick a new "Due by", fill "Why is the date moving?" and click "Record
     the new date".
  2. Click "Hand over". Choose "Nobody yet" in "Owed by", fill "Why is it changing hands?" and click
     "Record the hand-over".
- **Expected result:**
  - "The task’s date has been moved." and "The task has changed hands.".
  - "What has happened" lists "Task date moved" and "Task handed over", each with its reason.

### CAS-06 · Cancel a task with a reason

- **Role:** SW1
- **Checks:** FR-STAFF-18, NFR-REC-1 · Must · Casework
- **Set up first:** The task from CAS-05 is still open.
- **Steps:**
  1. Click "Cancel task" and read the dialog "Cancel a task".
  2. Fill "Why is this task no longer needed?" and click "Cancel the task".
- **Expected result:**
  - The dialog says a cancelled task is kept, marked cancelled, and cannot be reopened.
  - "The task has been cancelled." The task stays on the case as "Cancelled" with its reason.
    "What has happened" shows "Task cancelled — no longer needed".

### CAS-07 · Name another request in the case, then end the link

- **Role:** INTAKE
- **Checks:** FR-STAFF-18, NFR-REC-1 · Must · Casework
- **Set up first:** CAS-01 and REQ-05 done (R2 exists).
- **Steps:**
  1. Click "Name a request". Choose R2 in "Which request?", fill "Why does this request belong to
     the case?" and click "Name the request".
  2. On R2's row click "End link". Read the dialog, fill "Why is this request no longer part of the
     case?" and click "End the link".
- **Expected result:**
  - Step 1 shows "The request is now named in this case, and the act is on the timeline.".
  - Step 2 shows "The request is no longer linked to this case.". R2 leaves "Assistance on this
    case".
  - "What has happened" keeps both acts: "Assistance request named in this case" and "Assistance
    request no longer part of this case — kept in this history".

### CAS-08 · Routine and protected notes

- **Role:** SW1, then INTAKE
- **Checks:** FR-STAFF-18, NFR-PRIV-3 · Must · Casework
- **Set up first:** CAS-02 done.
- **Steps:**
  1. SW1: click "Add a note". Fill "What happened?", choose "Protected note" in "How closely is
     this held?", fill "Why is this being recorded?" and click "Save the note".
  2. SW1: add a second note as a "Routine note".
  3. INTAKE: open the case and read "Running record". Click "Add a note" and open "How closely is
     this held?".
- **Expected result:**
  - SW1 sees both notes.
  - INTAKE sees "1 note is restricted and cannot be read by your role.". The protected entry keeps
    its tag, author and time, and its text reads "Restricted. Your role cannot read this entry.".
  - INTAKE is offered only "Routine note".

### CAS-09 · Reassigning a case moves the open tasks with it

- **Role:** HEAD, then SW1 and SW2
- **Checks:** FR-STAFF-18 · Must · Casework
- **Set up first:** CAS-02 done. SW1 owes an open task on the case (add one as in CAS-04, step 2).
- **Steps:**
  1. HEAD: click "Assign this case" and choose SW2 in "Social worker".
  2. Read the sentence above the button. Give a reason and click "Record the assignment".
  3. SW2 opens the case. SW1 opens "Cases".
- **Expected result:**
  - Step 2 warns, before the button: "The open task … owes on this case goes with it — to … — each
    recorded with this reason."
  - After step 3 the task reads "Owed by:" SW2. SW1 no longer sees the case.

### CAS-10 · Only the head closes a case

- **Role:** INTAKE, then SW2
- **Checks:** FR-STAFF-18, FR-API-4 · Must · Casework
- **Set up first:** CAS-09 done.
- **Steps:**
  1. INTAKE: open the case and open the "Move to" list.
  2. SW2: do the same.
- **Expected result:**
  - Neither list offers "Closed".

### CAS-11 · Closing waits until every task is settled; the head closes the case

- **Role:** HEAD
- **Checks:** FR-STAFF-18 · Must · Casework
- **Set up first:** CAS-09 done (SW2 owes an open task).
- **Steps:**
  1. Open the case and the "Move to" list. Read the text below the move box.
  2. Under "Open tasks to settle before closing", click "Mark as done" on the task and record its
     outcome.
  3. Move the case to "Closed" with a reason.
- **Expected result:**
  - In step 1 "Closed" is not offered, and the page says closing is not offered while a task is
    open.
  - After step 3 the page says "This case is closed. The file is kept in full, and a situation that
    recurs is opened as a new case rather than reviving this one." No button changes the case, and
    nothing offers to reopen it.

### CAS-12 · A recurrence is a new case naming the closed one

- **Role:** INTAKE
- **Checks:** FR-STAFF-18 · Must · Casework
- **Set up first:** CAS-11 done.
- **Steps:**
  1. Open the closed case and click "Open a new case continuing this one".
  2. Read "Continues a closed case". Fill the kind, the presenting problem and the reason, and click
     "Open the case".
- **Expected result:**
  - The form says "This case continues …, which is closed. The old file is kept as it ended; the
    new one names it." and Ana is already chosen.
  - The new case shows "Continues" with a link to the closed case. The closed case is unchanged.

## REL: Releases and payout sessions

A release records what the office hands over for an approved request. It is not accounting, and it
posts nothing to an account.

### REL-01 · Prepare a money release, never above the approved amount

- **Role:** RELEASE
- **Checks:** FR-STAFF-19, NFR-MON-1 · Must · T-10
- **Set up first:** REQ-16 done (R1 approved at ₱3,000.50).
- **Steps:**
  1. Open "Assistance requests", open R1 and click "Prepare the release".
  2. Under "For the request", read the approved amount. Click the request's number there, then come
     back.
  3. Keep "Money". In "Amount, in pesos" type "3,500" and click "Prepare the release".
  4. Change the amount to "3,000.50". Choose "Cash" in "How it is paid". Fill "Funding source" and
     "Approval reference" with test labels.
  5. Read the sentence above the button and click "Prepare the release".
- **Expected result:**
  - Step 2 reads "Approved: ₱3,000.50 — A money release is prepared at or under this amount, never
    above it." The request's number opens R1.
  - Step 3 is refused: a release is not prepared above the approved amount. Nothing is saved.
  - Step 5: "This records what the office will hand over. It is not the accounting system and posts
    nothing to it." Then "Release prepared. Schedule it into a payout session next.". The release
    shows "₱3,000.50" and the status "For release".

### REL-02 · Prepare a goods release: no peso value

- **Role:** RELEASE
- **Checks:** FR-STAFF-19 · Must · T-10
- **Set up first:** REQ-17 done (R2 approved as goods).
- **Steps:**
  1. Open R2 and click "Prepare the release".
  2. Choose "Goods". Fill "The goods" and click "Prepare the release".
- **Expected result:**
  - The page reads "Approved as goods: …". With "Goods" chosen there is no amount field ("Goods are
    counted, never given a peso value.").
  - The release reads "Goods: …" and shows no peso amount.

### REL-03 · One release per request at a time

- **Role:** RELEASE
- **Checks:** FR-STAFF-19 · Must · T-10
- **Set up first:** REL-01 done.
- **Steps:**
  1. Open R1 and click "Prepare the release" again.
- **Expected result:**
  - "This request already has a release" / "One payout per request at a time. …". No form is
    offered.

### REL-04 · Open a payout session; its progress is counted from its members

- **Role:** RELEASE
- **Checks:** FR-STAFF-19 · Must · T-10
- **Set up first:** REL-01 and REL-02 done.
- **Steps:**
  1. Open "Releases" and click "Payout sessions".
  2. Fill "What is this session called?" "UAT San Juan payout", "Where is it being held?" and
     "When".
  3. Under "Which releases are scheduled into it?" tick both test releases. Click "Open the
     session".
  4. Open R1.
- **Expected result:**
  - Step 3 shows "The session is open.". Its card shows "Progress" counted from its two releases
    (none released yet).
  - Both releases now read "Scheduled", and R1's status is "Scheduled".

### REL-05 · The payout list: names and masked vouchers only

- **Role:** RELEASE
- **Checks:** FR-STAFF-19, NFR-PRIV-1 · Must · T-10
- **Set up first:** REL-04 done.
- **Steps:**
  1. On the session's card click "Open the payout list" and scroll down to "Payout list".
  2. Read the columns, the totals and the notice. Click "Print" and print to PDF only.
- **Expected result:**
  - The columns are "#", "Name", "Voucher", "What" and "Signature or thumbmark". The voucher is
    masked (for example ••••0012) and the signature column is empty.
  - "Money total: ₱3,000.50" and "Goods to hand out: 1".
  - There is no birth date, address, sector or reason for assistance. The notice says the list is
    protected under RA 10173.

### REL-06 · Record the release and the receipt

- **Role:** RELEASE
- **Checks:** FR-STAFF-19 · Must · T-10
- **Set up first:** REL-04 done. REQ-19 already run.
- **Steps:**
  1. Open R1's release. Under "Record the release" fill "Cheque, e-wallet or receipt number" and
     click "Record as released".
  2. Under "Record the receipt" choose "Signed for" in "How it was acknowledged" and click "Record
     receipt".
  3. Open "Payout sessions" and read the session's progress. Open R1.
- **Expected result:**
  - Step 1 shows "Release recorded." and the status "Released". Step 2 shows "Receipt recorded.".
  - The session's progress counts one of two released. R1's status is "Released".

### REL-07 · Defer: when the office could not pay

- **Role:** RELEASE
- **Checks:** FR-STAFF-19 · Must · T-10
- **Set up first:** REL-04 done (R2's goods release is "Scheduled").
- **Steps:**
  1. Open R2's release. Under "They came and we could not pay", open "Why" and read the options.
  2. Choose "An approving signature was missing", fill "What happened" and click "Record deferral".
  3. Open "Releases".
- **Expected result:**
  - Every reason in "Why" is the office's own (funds, a signature, the voucher, the office being
    closed). The hint says "If they did not come, mark it unclaimed instead."
  - "Deferral recorded." The release is "Deferred" and listed under "The office must act on these".

### REL-08 · Unclaimed: nobody came, and it is not called deferred

- **Role:** RELEASE
- **Checks:** FR-STAFF-19 · Must · T-10
- **Set up first:** REL-07 done.
- **Steps:**
  1. Open R2's release. Under "Move this release on" choose "Scheduled", give a reason and click
     "Record the move".
  2. Choose "Unclaimed", give a reason and click "Record the move".
  3. Open "Payout sessions" and read the session's progress.
- **Expected result:**
  - Each move shows "Release moved.". The release ends as "Unclaimed".
  - The session's progress counts it as unclaimed, never as deferred.

### REL-09 · Releasing a request you approved yourself is warned about, not blocked

- **Role:** ADMIN
- **Checks:** FR-STAFF-19, NFR-SOD-1 · Must · T-10
- **Set up first:** A fourth request, R4, endorsed (REQ-03 to REQ-15 steps), then approved by ADMIN
  with "Approve this request". ADMIN prepares its release and schedules it into a new session
  (REL-01, REL-04).
- **Steps:**
  1. ADMIN: open R4's release. Read the box above "Record as released".
  2. Click "Record as released".
- **Expected result:**
  - "Check before you release": "You approved this request. Releasing it yourself means one person
    did both, which the office normally separates. Ask another officer to release it if one is
    available."
  - The release is still recorded ("Release recorded."): the warning does not block it.

### REL-10 · The head voids a release; the request can then be ended

- **Role:** HEAD
- **Checks:** FR-STAFF-19, FR-STAFF-16 · Must · T-10
- **Set up first:** A fifth request, R5, approved, with its release prepared and scheduled into a new
  session (as in REL-01 and REL-04).
- **Steps:**
  1. Open R5's release. Under "Move this release on" choose "Voided", give a reason and click
     "Record the move".
  2. Open R5 and open the "Move to" list.
- **Expected result:**
  - "Release moved." The release reads "Voided".
  - R5 no longer shows the "while its release stands" box, and "Cancelled" is offered again.

## REF: Referrals and field visits

A referral summary leaves the building, so the office records a lawful basis and chooses each field
it shares. A visit record says whose claim each line is, and records no location.

### REF-01 · Draft a referral: nothing is sent yet

- **Role:** HEAD
- **Checks:** FR-STAFF-20 · Must · Casework
- **Set up first:** ROS-01 done (Ana is registered).
- **Steps:**
  1. Open "Referrals". In "Refer somebody out", read the hint above the form.
  2. In "Who is being referred?" type "Halimbawa" and choose Ana.
  3. Choose "Hospital medical social worker" in "What kind of organisation?". Fill "Which
     organisation?" "UAT Test Hospital", choose "Routine" in "How urgent?", and fill "What are they
     being referred for?" and "Why?".
  4. Click "Create the draft".
- **Expected result:**
  - The hint says "This creates a DRAFT. Nothing leaves the office until the lawful basis is
    recorded and the referral is sent from its own page."
  - Step 4 shows "The draft was created. Nothing has been sent." and opens the referral (RF-…) with
    the status "Draft".
  - "What was shared" reads "Nothing has been shared. …".

### REF-02 · Sending without a lawful basis is refused

- **Role:** HEAD
- **Checks:** FR-STAFF-20 · Must · Casework
- **Set up first:** REF-01 done.
- **Steps:**
  1. On the draft, under "Send this referral", click "Send referral" without recording a basis.
- **Expected result:**
  - The send is refused: "No lawful basis is recorded for this referral. Record the basis — client
    consent, a statutory mandate, or vital interest — with the sentence that explains it, then send
    it."
  - The status stays "Draft". Nothing was sent.

### REF-03 · Record the lawful basis

- **Role:** HEAD
- **Checks:** FR-STAFF-20 · Must · Casework
- **Set up first:** REF-01 done.
- **Steps:**
  1. Under "On what lawful basis?", read the three options and choose "The client agreed to the
     referral".
  2. Fill "What makes that true here?" with "UAT: the client agreed at the counter today." and
     click the button below it.
- **Expected result:**
  - The options are "The client agreed to the referral", "Required or authorised by law" and
    "Urgent — life, health or safety at risk", each with a hint.
  - "The lawful basis was recorded." "What was shared" shows the basis and the sentence.

### REF-04 · Share details one at a time, each with its need

- **Role:** HEAD
- **Checks:** FR-STAFF-20, NFR-PRIV-1 · Must · Casework
- **Set up first:** REF-03 done.
- **Steps:**
  1. Under "What may be shared beyond the minimum", choose "Contact number" in "Field". Fill "Why
     does the receiving organisation need it?" and click the button below it.
  2. Choose "Home address" in "Field" and read the line that appears.
- **Expected result:**
  - Step 1 shows "That field was added to the summary." and "Details shared beyond the client’s
    name" lists it with "Because: …".
  - Step 2 shows "This one needs particular thought before it leaves the office.". Do not share it.

### REF-05 · The summary sheet shows the minimum and the chosen details only

- **Role:** HEAD
- **Checks:** FR-STAFF-20 · Must · Casework
- **Set up first:** REF-04 done.
- **Steps:**
  1. Scroll to "The summary sheet" and read it.
  2. Click "Print" and print to PDF only.
- **Expected result:**
  - The sheet shows "Reference", "To", "Service requested", "Reason", "Client", "Referred by"
    ("MSWDO Taytay, Rizal"), the contact number with its need, and the basis.
  - It shows no birth date, address, income, sector or earlier assistance. The notice at the foot
    cites RA 10173 and forbids forwarding.

### REF-06 · Send the referral: it cannot be recalled, and a follow-up date is set

- **Role:** HEAD
- **Checks:** FR-STAFF-20 · Must · Casework
- **Set up first:** REF-05 done.
- **Steps:**
  1. Read the warning above "Send referral", then click it.
  2. Read "Follow up on".
- **Expected result:**
  - The warning reads "Once this is sent it has left the office. Nothing here can recall it, and the
    receiving organisation keeps whatever it was given."
  - "The referral was sent. It cannot be recalled." The status is "Sent". "Follow up on" is 14 days
    from today (the "Routine" urgency).

### REF-07 · Record what the receiving office did

- **Role:** HEAD
- **Checks:** FR-STAFF-20 · Must · Casework
- **Set up first:** REF-06 done.
- **Steps:**
  1. Under "Outcome", fill "What the receiving office did".
  2. Choose "Acknowledged" in "Set the referral to" and click "Record outcome".
  3. Fill the outcome again, choose "Closed" and click "Record outcome".
- **Expected result:**
  - Step 2 shows "Outcome recorded.", the status "Acknowledged" and "They responded".
  - Step 3 closes the referral.

### REF-08 · Move the follow-up date only with a reason

- **Role:** HEAD
- **Checks:** FR-STAFF-20, NFR-REC-1 · Must · Casework
- **Set up first:** A second referral drafted and sent as in REF-01 to REF-06, and not closed.
- **Steps:**
  1. Under "Move the follow-up", pick a "New date" and leave "Why" empty.
  2. Fill "Why" and click "Move follow-up".
  3. Open "Referrals" and tick "Only ones we said we would chase by now".
- **Expected result:**
  - In step 1 "Move follow-up" cannot be used without a reason.
  - Step 2 shows "Follow-up moved." and the move is kept as a note.
  - In step 3 the referral is not listed: its date has not passed.

### REF-09 · A social worker refers a client from their caseload

- **Role:** SW1
- **Checks:** FR-STAFF-20, FR-API-4 · Must · Casework
- **Set up first:** A case on Ana assigned to SW1 (CAS-12's case, assigned to SW1 as in CAS-02).
- **Steps:**
  1. Open "Referrals". In "Refer somebody out", choose Ana and fill the form as in REF-01.
  2. Click "Create the draft".
- **Expected result:**
  - "The draft was created. Nothing has been sent." The draft is named on SW1's caseload and opens
    for SW1.

### REF-10 · Schedule a home visit from a case

- **Role:** SW1
- **Checks:** FR-STAFF-21 · Must · Casework
- **Set up first:** The case from REF-09 is open and assigned to SW1.
- **Steps:**
  1. Open the case and click "Schedule a home visit".
  2. Read the sentence above the form.
  3. Choose "What is the visit for?", pick "On what day?", fill "Roughly when", check "The address
     the visit is made to", and choose yourself in "Who goes?".
  4. Click "Schedule the visit".
- **Expected result:**
  - The sentence reads "A visit records the address it is made to and what is found there. Nothing
    records where anybody is or was."
  - Step 4 shows "The visit is scheduled and saved to the office record." and opens the visit
    (HV-…). It is listed in "Field visits".

### REF-11 · Each observation says whose claim it is

- **Role:** SW1
- **Checks:** FR-STAFF-21, NFR-REC-1 · Must · Casework
- **Set up first:** REF-10 done.
- **Steps:**
  1. Under "Record what you found", choose "Said by someone else" in "What kind of entry is this?".
  2. Fill "What happened", leave "Who said it" empty, and look at "Add entry".
  3. Fill "Who said it" with "UAT: barangay kagawad" and click "Add entry".
  4. Add one entry each as "Seen by the worker", "Said by the client" and "The worker’s
     assessment".
  5. Look for a way to edit or delete an entry, and for any map or location field.
- **Expected result:**
  - In step 2 "Add entry" stays greyed out.
  - Each entry is saved with "Saved to the office record." and shows its kind. The third-party
    entry shows "Said by: UAT: barangay kagawad".
  - No entry can be edited or deleted. There is no map, location or check-in anywhere.

### REF-12 · Closing a visit is final

- **Role:** SW1
- **Checks:** FR-STAFF-21 · Must · Casework
- **Set up first:** REF-11 done.
- **Steps:**
  1. Under "Close the visit", choose "Completed" in "What happened", fill "Outcome" and click
     "Close visit".
- **Expected result:**
  - "Visit closed." The page says "This visit is closed. Its record cannot be changed." and offers
    no entry form.

## ACC: Accounts, roles and access

Staff accounts are created by the administrator outside the website. On the website the
administrator gives each account its role, office and office role. The server checks every
permission again: a hidden button is never the only protection.

### ACC-01 · The administrator gives a test account its role, office and office role

- **Role:** ADMIN
- **Checks:** FR-STAFF-11, FR-API-4 · Must · T-2
- **Set up first:** The intake officer's test account has signed in once.
- **Steps:**
  1. Open "Users and roles" and click "Manage" on the account.
  2. Choose "Staff" in "Change the role to". Read the effects, then click "Change the role to
     Staff".
  3. Choose the MSWDO in "Office this staff account answers for" and click "Assign to …".
  4. Choose "Intake officer" in "Give the account the office role". Leave "Why (required)" empty
     and click "Give the office role Intake officer".
  5. Fill "Why (required)" and click the button again.
  6. The account signs out and in again.
- **Expected result:**
  - Before each button the drawer says what the server will do.
  - Step 4 shows "Say why. The server keeps the reason with the change.".
  - The results read "Role changed to Staff.", "Assigned to …" and "Office role changed to Intake
    officer.".
  - After step 6 the account's menu is the intake officer's (ACC-04).

### ACC-02 · A barangay link must be given its barangay

- **Role:** ADMIN
- **Checks:** FR-API-4 · Must · T-2
- **Set up first:** The barangay link's test account is "Staff" with an office (ACC-01, steps 1 to
  3).
- **Steps:**
  1. Choose "Barangay link" in "Give the account the office role", fill "Why (required)" and click
     the button without choosing a barangay.
  2. Choose "San Juan" in "The barangay this barangay link works in" and click the button.
- **Expected result:**
  - Step 1 shows "Choose the barangay a barangay link works in.".
  - Step 2 is saved. The account's footer reads "Barangay link · Barangay San Juan" after it signs
    in again.

### ACC-03 · Nobody changes their own role

- **Role:** ADMIN
- **Checks:** FR-STAFF-11 · Must · T-2
- **Set up first:** None.
- **Steps:**
  1. In "Users and roles", click "Manage" on your own row (marked "(You)").
- **Expected result:**
  - The drawer says "This is your own account. The server refuses a change to your own role;
    another administrator can make it." No role can be chosen.

### ACC-04 · Each role's menu matches its work

- **Role:** ADMIN, HEAD, SW1, INTAKE, RELEASE, BLINK, AUDITOR
- **Checks:** FR-API-4, NFR-SEC-4 · Must · T-2
- **Set up first:** All test accounts set up (ACC-01, ACC-02).
- **Steps:**
  1. Sign in as each role and list the menu entries. Read the footer under the menu.
- **Expected result:**
  - ADMIN: Dashboard, Cases, Assistance requests, Residents, Households, Families, Field visits,
    Referrals, Programs, Releases, ID verification, Office inbox, Users and roles, App directory,
    Home screen, App settings, Digital IDs, Balita, App audit trail.
  - HEAD: the same, without ID verification, Users and roles, App directory, Home screen and App
    settings.
  - SW1 and INTAKE: Dashboard, Cases, Assistance requests, Residents, Households, Families, Field
    visits, Referrals, Programs, Office inbox, Digital IDs, Balita.
  - RELEASE: Dashboard, Assistance requests, Residents, Households, Families, Programs, Releases,
    Office inbox, Digital IDs, Balita.
  - BLINK: Dashboard, Assistance requests, Residents, Households, Families, Referrals, Programs,
    Digital IDs.
  - AUDITOR: Dashboard, Cases, Assistance requests, Residents, Households, Families, Field visits,
    Referrals, Programs, Releases, Digital IDs, App audit trail.
  - Every menu may end with "Not connected yet". The footer shows the name, role and scope ("All
    barangays", "Assigned cases" or "Barangay San Juan"), and "Sign out".

### ACC-05 · Typing an address does not get past a role

- **Role:** BLINK, then RELEASE
- **Checks:** NFR-SEC-4, FR-API-4 · Must · T-2
- **Set up first:** ACC-04 done.
- **Steps:**
  1. BLINK: type the website address followed by /releases, then /cases, then /verification.
  2. RELEASE: type the address followed by /cases, then /users.
- **Expected result:**
  - Each shows "You do not have access to that section" and "Back to dashboard". No data is shown.

### ACC-06 · Separation of duties: the head approves but cannot release

- **Role:** HEAD
- **Checks:** NFR-SOD-1 · Must · T-2
- **Set up first:** A release in "Scheduled" (REL-04).
- **Steps:**
  1. Open the scheduled release.
- **Expected result:**
  - There is no "Record as released" and no "Record deferral". The head can still choose "Voided"
    under "Move this release on".

### ACC-07 · Separation of duties: the release officer releases but cannot approve

- **Role:** RELEASE
- **Checks:** NFR-SOD-1 · Must · T-2
- **Set up first:** A request in "Endorsed".
- **Steps:**
  1. Open the endorsed request.
- **Expected result:**
  - There is no "Approve this request". "Move this request on" says "Your role cannot make any of
    the moves available from this status."

### ACC-08 · The auditor reads everything and changes nothing

- **Role:** AUDITOR
- **Checks:** FR-API-4, NFR-SEC-4 · Must · T-2
- **Set up first:** The REQ, CAS, REL and REF cases have run.
- **Steps:**
  1. Open a resident, a household, a request, a case, a release, a payout session, a referral and a
     visit.
- **Expected result:**
  - Every page can be read. No page offers a button that changes anything: no "Record the move",
    "Add a task", "Add a note", "Edit record", "Prepare the release", "Open a payout session",
    "Refer somebody out" or "Add entry".
  - The auditor can open a document after its warning ("Open document").

### ACC-09 · The intake officer cannot assess, approve or close

- **Role:** INTAKE
- **Checks:** FR-API-4 · Must · T-2
- **Set up first:** A request in "Assessment" and an open case.
- **Steps:**
  1. Open the request in "Assessment" and open "Move to".
  2. Open the case and open "Move to".
- **Expected result:**
  - The request offers only "Returned" and "Cancelled", and no case-study form.
  - The case does not offer "Closed".

### ACC-10 · A barangay link files a request for its own barangay only

- **Role:** BLINK
- **Checks:** FR-API-4, FR-STAFF-15 · Must · T-2
- **Set up first:** ROS-05 done (Dante Halimbawa of Dolores exists).
- **Steps:**
  1. Open "Assistance requests" and click "Start an intake".
  2. In "Applicant" type "Halimbawa".
  3. Choose a San Juan resident and file the request as in REQ-03 and REQ-04.
- **Expected result:**
  - Step 2 offers San Juan residents only, never Dante.
  - The request is filed and appears in BLINK's list. The list shows no request from another
    barangay.

## AUD: App audit trail

The API keeps a row for every act: who acted, what they did, to which record and when. It keeps no
earlier or later value and no reason; the reasons live in each record's own history.

### AUD-01 · The trail shows who, what, which record and when, and no values

- **Role:** AUDITOR
- **Checks:** FR-STAFF-27 · Must · T-12
- **Set up first:** Some acts have been done.
- **Steps:**
  1. Open "App audit trail". Read the notes and the columns.
  2. Click "Show older entries", then "Read from the newest".
- **Expected result:**
  - The columns are "When", "What was done", "By account" and "To record". The notes say "The API
    keeps no earlier or later value, and no reason."
  - No row shows an old or new value. Nothing on the page can be changed.

### AUD-02 · ID reviews and digital ID acts appear

- **Role:** AUDITOR
- **Checks:** FR-STAFF-27 · Must · T-12
- **Set up first:** REG-10, REG-11 and ID-02 to ID-07 done.
- **Steps:**
  1. Open "App audit trail" and find the rows for those acts.
- **Expected result:**
  - Rows read "Approved a resident’s ID verification", "Rejected a resident’s ID verification",
    "Checked a resident’s digital ID", "Suspended a digital ID", "Replaced a digital ID with a new
    one", "Revoked a digital ID" and "Issued a digital ID", each with the time and the acting
    account.

### AUD-03 · Account, directory, home screen and settings acts appear

- **Role:** AUDITOR
- **Checks:** FR-STAFF-27 · Must · T-12
- **Set up first:** ACC-01, DIR-05 to DIR-12 and NEWS-01 to NEWS-06 done.
- **Steps:**
  1. Find the rows for those acts.
- **Expected result:**
  - Rows read, among others, "Changed an account’s role", "Changed a staff account’s office",
    "Changed a staff account’s office role", "Added an office to the directory", "Changed an office
    in the directory", "Deleted an office from the directory", "Added a Tulong page", "Added a
    hotline", "Added a home screen banner", "Changed the app’s settings", "Wrote a Balita article",
    "Pinned a Balita article" and "Closed a conversation with a resident".

### AUD-04 · Registry and request acts appear

- **Role:** AUDITOR
- **Checks:** FR-STAFF-27, NFR-REC-1 · Must · T-12
- **Set up first:** ROS and REQ cases done.
- **Steps:**
  1. Find the rows for those acts.
- **Expected result:**
  - Rows read, among others, "Recorded a resident in the office registry", "Retired a resident’s
    registry record", "Registered a household with the office", "Changed who lives in a household",
    "Corrected a household’s vulnerability indicator", "Recorded a family with the office",
    "Recorded a relationship between two residents", "Began an intake for an assistance request",
    "Filed an assistance request and issued its control number", "Moved an assistance request on,
    with a reason", "Assigned an assistance request to a social worker, with a reason", "Reviewed a
    document presented for an assistance request" and "Opened a document presented for an
    assistance request".
  - Every row has a description in words. A row reading "No description in this console for …" is
    a defect.

### AUD-05 · Case, release, referral and visit acts appear

- **Role:** AUDITOR
- **Checks:** FR-STAFF-27, NFR-REC-1 · Must · T-12
- **Set up first:** CAS, REL and REF cases done.
- **Steps:**
  1. Find the rows for those acts, including the cancelled task (CAS-06) and the ended link
     (CAS-07).
- **Expected result:**
  - Rows read, among others, "Opened a case on a person, with a reason", "Added a task to a case,
    with a reason", "Moved a case on, with a reason", "Prepared a release for an approved request —
    an amount or the goods", "Recorded a release as handed over", "Opened a payout session with the
    releases planned for it", "Drafted a referral to another office; nothing was disclosed", "Sent a
    referral to another office, under its recorded basis" and "Recorded what was found on a home
    visit".
  - The cancelled task, the ended link and the self-release (REL-09) each have a row with a
    description in words.

### AUD-06 · Only the head, the auditor and the administrator open the trail

- **Role:** HEAD, AUDITOR, ADMIN, then INTAKE
- **Checks:** FR-STAFF-27, FR-API-4 · Must · T-12
- **Set up first:** None.
- **Steps:**
  1. As HEAD, AUDITOR and ADMIN, look for "App audit trail" in the menu.
  2. As INTAKE, type the website address followed by /app-audit.
- **Expected result:**
  - The first three have the entry and can read the trail.
  - INTAKE gets "You do not have access to that section".

## NEWS: Balita and the office inbox

### NEWS-01 · Write a Balita article and save it as a draft

- **Role:** HEAD
- **Checks:** FR-STAFF-5 · Should · T-13
- **Set up first:** None.
- **Steps:**
  1. Open "Balita" and click "Write an article".
  2. Click "Save as a draft" with nothing filled in.
  3. Fill "Title" "UAT test article, please ignore", "Words" and "Category". Read the lines under
     "Cover image".
  4. Click "Save as a draft".
- **Expected result:**
  - Step 2 shows "An article needs a title." and "An article needs words.".
  - Under the cover: "The API keeps no description of the cover, so the app has none to give a
    resident who cannot see it. Say what matters in the words."
  - Step 4 shows "Saved as a draft." and "Status" "Draft". The article is not under "Published
    articles".

### NEWS-02 · The warning sits above the publish button; publish

- **Role:** HEAD, then GUEST
- **Checks:** FR-STAFF-5, FR-RES-8 · Should · T-13
- **Set up first:** NEWS-01 done (the draft is open).
- **Steps:**
  1. Read the lines above "Publish to residents", then click it.
  2. GUEST: open the "Balita" tab.
- **Expected result:**
  - Above the button: "It cannot be recalled from anybody who has read it. Taking it off the app
    later removes it only from then on."
  - "Published. Residents can read it in the app." The app lists the article.

### NEWS-03 · Pin, unpin and take an article off the app

- **Role:** HEAD, then GUEST
- **Checks:** FR-STAFF-5, FR-RES-8 · Should · T-13
- **Set up first:** NEWS-02 done.
- **Steps:**
  1. Under "Published articles" click "Open" on the article, then "Pin to the top".
  2. GUEST: refresh "Balita".
  3. HEAD: click "Unpin", then "Take it off the app".
  4. GUEST: refresh "Balita".
- **Expected result:**
  - Step 1 shows "Pinned." and the list marks it "(Pinned)". In step 2 it comes first in the app.
  - Step 3 shows "Unpinned." and "Taken off the app. It is now a draft, kept on this page.".
  - In step 4 the article is gone from the app.

### NEWS-04 · A resident filters Balita by category

- **Role:** GUEST
- **Checks:** FR-RES-8 · Should · T-13
- **Set up first:** Published articles in at least two categories.
- **Steps:**
  1. Open "Balita" and tap a category chip, then "Lahat".
- **Expected result:**
  - A chip narrows the list to its category, with pinned articles first. "Lahat" shows them all.

### NEWS-05 · A verified resident writes to an office, and staff reply

- **Role:** RES-B, then INTAKE, then RES-B
- **Checks:** FR-RES-10, FR-STAFF-7 · Should · T-7
- **Set up first:** RES-B is verified (REG-10). INTAKE is assigned to the MSWDO office (ACC-01). A
  small test photo on RES-B's phone.
- **Steps:**
  1. RES-B: in "Directory" open the MSWDO and tap "Message". Choose a "Topic", write a "Message",
     attach the photo with "Attach photo or PDF (optional)" and tap "Send message".
  2. INTAKE: open "Office inbox". Read the list.
  3. Open the conversation. Click "Show image 1", read the warning and click "Show it".
  4. Type in "Your reply to the resident" and click "Send the reply".
  5. RES-B: open "My Account", then "Messages", and open the conversation. Open "Notifications"
     from the bell on "Home".
- **Expected result:**
  - Step 1 shows "Message sent".
  - The inbox list shows "Subject", "Office", "Latest message", "Unread by the office" and
    "Status", and never what the resident wrote.
  - The image opens only after the warning "Before you open this image".
  - Step 4 shows "Sent. The resident can read it in the app.". RES-B reads the reply, and the
    notification is marked read once opened.

### NEWS-06 · Mark a conversation read and close it

- **Role:** INTAKE, then RES-B
- **Checks:** FR-STAFF-7 · Should · T-7
- **Set up first:** NEWS-05 done, with a new unread message from RES-B.
- **Steps:**
  1. Open the conversation and click "Mark as read for the office".
  2. Click "Close this conversation". Read the dialog and click "Keep it open".
  3. Click "Close this conversation" again, then "Close it".
  4. RES-B: open the conversation.
- **Expected result:**
  - Step 1 shows "Marked as read for the office.".
  - The dialog "Close this conversation?" lists what closing does and asks for no reason.
  - Step 3 shows "Closed. Nobody can write in this conversation again.". The app shows "This
    conversation is closed.".

## NFR: Privacy, security and accessibility

### NFR-01 · Staff sign-in, and a wrong password is refused

- **Role:** INTAKE
- **Checks:** FR-STAFF-28, NFR-SEC-1 · Must · T-2
- **Set up first:** None.
- **Steps:**
  1. Open the staff website. Fill "Work email address" and a wrong "Password", and click "Sign in".
  2. Type the right password and click "Sign in".
- **Expected result:**
  - Step 1 shows "Those sign-in details were not recognised. Check the email address and password,
    then try again." It does not say which of the two was wrong.
  - Step 2 opens "Dashboard".

### NFR-02 · Signing out ends access on every device

- **Role:** INTAKE, in two browsers (for example Edge and Chrome)
- **Checks:** FR-STAFF-28 · Must · T-2
- **Set up first:** INTAKE is signed in on both browsers.
- **Steps:**
  1. In browser A click "Sign out".
  2. In browser B click any menu entry.
- **Expected result:**
  - Browser A shows the sign-in page.
  - Browser B is sent to the sign-in page at its next action and shows no data.

### NFR-03 · Reloading the page signs you out, by design

- **Role:** INTAKE
- **Checks:** NFR-SEC-2 · Must · T-2
- **Set up first:** INTAKE is signed in with a request open.
- **Steps:**
  1. Press F5 (reload).
  2. Sign in again.
- **Expected result:**
  - Step 1 shows the sign-in page: the pass is held in memory only.
  - Step 2 returns to the same request.

### NFR-04 · No sign-in pass is stored in the browser

- **Role:** ADMIN (or another tester used to the browser's developer tools)
- **Checks:** NFR-SEC-2 · Must · T-2
- **Set up first:** Signed in.
- **Steps:**
  1. Press F12, open "Application", and look under "Local storage", "Session storage" and
     "Cookies" for the website.
  2. Look at the address bar on a few pages.
- **Expected result:**
  - None holds a sign-in pass (a long string beginning "eyJ"). No address carries one.

### NFR-05 · Numbers are masked

- **Role:** HEAD, then RELEASE
- **Checks:** NFR-PRIV-2, FR-STAFF-17, FR-STAFF-19 · Must · T-2
- **Set up first:** ROS-01, REQ-10 and REL-05 done.
- **Steps:**
  1. HEAD: open Ana's resident record and R1's documents.
  2. RELEASE: open the payout list (REL-05).
- **Expected result:**
  - The PhilSys row shows four digits only. The document number shows "••••" and its last four
    characters. The voucher on the payout list is masked.
  - No screen shows a full PhilSys or document number.

### NFR-06 · Records of a protected sector are withheld from roles without clearance

- **Role:** HEAD, then INTAKE and BLINK
- **Checks:** NFR-PRIV-3, FR-STAFF-9, FR-STAFF-18 · Must · T-2
- **Set up first:** HEAD registers the fictional "Carmen Halimbawa" of San Juan with the sector "VAWC
  survivor", and opens a case on her (as in CAS-01).
- **Steps:**
  1. INTAKE: open "Residents", search "Halimbawa" and open "Sector".
  2. Open Carmen's record, then her case.
  3. BLINK: open "Residents", search "Halimbawa", and open Carmen's record.
- **Expected result:**
  - Her name shows as "Halimbawa, C." with the tag "Restricted". "Sector" does not offer "VAWC
    survivor" or "Child in conflict with the law".
  - Her record shows "Hidden by your role", listing "Protected sector membership".
  - Her case says what it says is withheld, and shows "Withheld from your account" instead of the
    presenting problem, tasks and notes.
  - HEAD sees the full record and case.

### NFR-07 · Identity numbers and income are withheld from roles without clearance

- **Role:** RELEASE, then BLINK
- **Checks:** NFR-PRIV-3, FR-STAFF-9 · Must · T-2
- **Set up first:** ROS-01 done (Ana has PhilSys 1234 and an income).
- **Steps:**
  1. RELEASE: open Ana's record.
  2. BLINK: open Ana's record.
- **Expected result:**
  - Both see "Hidden by your role", and its list includes "PhilSys reference" and "Monthly
    income". Neither value appears anywhere on the page.

### NFR-08 · The whole menu can be reached on a laptop screen

- **Role:** ADMIN (the longest menu)
- **Checks:** NFR-A11Y-1 · Must · All
- **Set up first:** A laptop at 1366 × 768, or a browser window of that size.
- **Steps:**
  1. Scroll the menu to its last entry.
  2. Set the browser zoom to 200% and repeat.
- **Expected result:**
  - Every entry down to "App audit trail" (and "Not connected yet") can be reached and clicked.
  - The footer with "Sign out" stays visible and does not cover any entry.

### NFR-09 · The website works by keyboard alone

- **Role:** INTAKE
- **Checks:** NFR-A11Y-1 · Must · All
- **Set up first:** Put the mouse away.
- **Steps:**
  1. Press Tab from the top of the page through the menu. Open "Assistance requests" with Enter.
  2. Open "Cases" the same way, then a case. Tab to "Add a note" and press Enter.
  3. Tab through the dialog, then press Esc.
- **Expected result:**
  - The focused item is always visibly outlined.
  - Every link and button is reached in a sensible order and works with Enter or Space.
  - Esc closes the dialog, and the focus returns to the button that opened it.

### NFR-10 · A lost connection gives a warning, and nothing is queued

- **Role:** INTAKE, then RES-B
- **Checks:** NFR-OFF-1 · Must · All
- **Set up first:** INTAKE has a request open. RES-B is in the app.
- **Steps:**
  1. INTAKE: turn off Wi-Fi. Type a note and try to save it.
  2. Turn Wi-Fi on again and read the banner. Click "Dismiss".
  3. Check whether the note was saved.
  4. RES-B: turn on airplane mode and use the app.
- **Expected result:**
  - Step 1: the banner "Offline" reads "This device has lost its connection. You can keep reading
    anything already on screen, but nothing can be saved until it returns — and nothing is being
    held in the background to send later." The note is not reported as saved.
  - Step 2: "Connection restored": "… Anything you tried to save while it was down was not kept,
    …". It stays until dismissed.
  - Step 3: the note is not there, and it is not sent later.
  - Step 4: the app shows "Not reaching Taytay LGU".
