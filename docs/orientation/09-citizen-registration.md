# Module 9: Citizen Registration Orientation

Tracker item 9. Read [README.md](README.md) first for the room, the equipment and how the session
runs.

## 1. Purpose, who attends, time and what to bring

**Purpose.** After this session you can:

- help a resident create an account in the Taytay app and send their ID for verification;
- review an ID on the staff website, approve it or reject it with a reason;
- check a resident's digital ID, and (administrators) suspend, replace or revoke a card;
- help a resident who forgot their password;
- explain what verification unlocks, and work a resident's document request from the queue to the
  counter.

**Who attends.** System administrators (only they review IDs and manage cards). Every staff member
who checks digital IDs or helps residents at the counter: intake officers, social workers, release
officers, barangay links and the MSWDO head. The staff who will work document requests.

**Time.** About 3 hours, with a 10-minute break.

**What to bring.** Your staging test account. Each pair also needs an Android phone with the staging
app, a test email inbox, the printed sample ID card marked SAMPLE, the printed sample face, and a
small test PDF or photo. The trainer brings a second phone with a QR-reader app.

**Words used in this module**

- **Registration**: a resident creating an account in the app.
- **Verification**: the office checking that the account belongs to a real resident, by looking at a
  government ID and a selfie. An account is verified once an administrator approves it.
- **Digital ID**: the Taytay ID card shown in the app, with a QR code that changes every few
  minutes.
- **Document request**: a resident asking an office, through the app, for a certificate or a copy.
  In the console the page is called "Document requests from residents", so nobody mixes it up with
  the documents the office asks an applicant for inside an assistance request.

## 2. Agenda

| Minutes | Part                                                          |
| ------- | ------------------------------------------------------------- |
| 10      | Welcome, attendance, purpose                                  |
| 15      | The resident's journey, start to finish (overview)            |
| 30      | Hands-on: a guest browses; a resident registers (phones)      |
| 25      | Staff: the ID review queue, approve and reject                |
| 10      | Break                                                         |
| 20      | Digital IDs: check a card; suspend, replace, revoke           |
| 10      | Forgotten and changed passwords                               |
| 45      | What verification unlocks: document requests, app and console |
| 10      | Check your understanding, questions                           |
| 5       | Evaluation form                                               |

## 3. Step-by-step guide

### 3.1 A resident browses as a guest

A resident can read the app without an account.

1. Open the Taytay app. On the welcome screens, tap "Continue as guest".
2. Tap the tabs at the bottom: "Home", "Directory", "Balita" and "Tulong". None asks you to sign in.
3. Tap "My Account". It shows "You are browsing as a guest", the badge "Not signed in" and a "Sign
   in" button.

A guest can read, but cannot message an office, carry a digital ID or request a document.

### 3.2 A resident registers

Registration has six steps. The header shows where you are, for example "Step 1 of 6 · Personal
info".

1. On the sign-in screen, tap "Create an account".
2. **Personal info.** Fill "First name", "Last name" and "Mobile number" (11 digits starting with
   09). Tap "Barangay" and choose from the list "Choose your barangay". Fill "Street / Purok". Tap
   "Continue". Empty or wrong fields are marked, for example "Choose your barangay.".
3. **Your account.** On "Create your account", fill "Email address" and "Password" (at least 8
   characters). Tap "Create my account". The title changes to "Account created".
4. **Email code.** The app opens "Enter the 6-digit code". Type the code from the email and tap
   "Confirm email". If no email arrives, tap "Resend". The code expires after 10 minutes.
5. **Terms and privacy.** On "Your data, protected", read "Read full Terms ›" and "Read full Privacy
   Notice ›". Tick "I have read and agree to the Terms of Use and the Privacy Notice." and "I
   consent to Taytay LGU processing my personal data for account verification.". Tap "Continue".
6. **Valid ID.** On "Upload a valid government ID", add "Front of ID" and, if the ID has one, "Back
   of ID (optional)". Tap "Continue".
7. **Selfie.** On "Take a quick selfie", tap "Take selfie", take the photo and tap "Continue".
8. **Review.** "Check your details" lists the name, email, mobile, address, the agreement, the ID
   and the selfie. Tap "Edit" beside a row to correct it. Tap "Submit for verification".
9. The app shows "You're all set, …!" and the card "Account verification" with "Pending review". Tap
   "Continue to app".

> **On staging:** no email is sent, so the code in step 4 never arrives. To practise the rest, the
> resident signs in later, taps "My Account", then "Verify my identity", and sends the ID from
> "Verification status": choose "Type of ID *", add "Front of ID *" and "Selfie", then tap "Start
> verification" (UAT case REG-08). The page then reads "We're reviewing your account".

> **Until the LGU publishes its texts**, "Read full Terms ›" shows "The full Terms of Use will be
> available soon. Taytay LGU has not published them in the app yet." Module 12 covers who writes and
> publishes them.

### 3.3 Staff review an ID

Only a system administrator reviews IDs.

1. Sign in to the staff website. In the menu, under "Residents’ app", click "ID verification".
2. The list shows the columns "Sent", "ID sent" and "Status". "Show" chooses which requests you see:
   "Awaiting review", "Approved", "Rejected" or "Every request". Leave it on "Awaiting review".
3. Click "Review" on a request.
4. **The images are hidden until you ask for them.** Under "The images", click "Show the ID and the
   selfie". A dialog titled "Before you open these images" warns: "You are about to see a resident’s
   government ID and a photograph of their face.". Click "Show them" only if you are ready to review
   now, or "Cancel".
5. Compare "Front of the ID" with "Selfie", and the ID with the details on the account. The pictures
   are "Shown in this tab only while this review is open. They are discarded when you hide them,
   close the review or leave the page."
6. Under "Decide", choose "Approved" or "Rejected" in "Decision", then read "What happens when you
   confirm". It says what the resident will see before you press anything.

**To approve:**

1. Choose "Approved". The list under "What happens when you confirm" includes "The account is marked
   verified." and "Nothing in this console can undo an approval.". A digital ID is issued with the
   selfie as its photo.
2. Write a short note in "Note for the office (the resident does not see this)". A note that is too
   short is refused with "Say a little more — …".
3. Click "Record the decision". The screen shows "Approved. The server marked the account
   verified.".
4. In the app, the resident's "Verification status" now shows "Your account is verified".

**To reject:**

1. Choose "Rejected". The reason you write is shown to the resident, so write it for them: what is
   wrong and what to send instead.
2. Fill "Reason the resident will read", for example _UAT: the front of the ID is blurred. Please
   send a clearer photo._
3. Click "Record the decision". The screen shows "Rejected. The resident can now read your reason in
   the app.".

### 3.4 The resident corrects a rejected request

1. In the app, the resident taps "My Account", then "Verification status". It shows "Needs
   correction", with your words under "REASON FROM TAYTAY LGU".
2. The resident taps the item to fix, for example "Front of ID *" ("Upload new photo"), and chooses
   a new photo.
3. The resident taps "Resubmit for verification", may write a "Message", and taps "Resubmit for
   verification" again.
4. On the staff website the request is back under "Awaiting review", with "What the resident wrote
   with their correction". Review it again as in 3.3.

### 3.5 The resident's digital ID

1. A verified resident taps "My Account", then "Verification status", then "Use your Taytay digital
   ID".
2. "My Taytay ID" shows the card with a QR code and the line "Code refreshes · valid until …". The
   code changes by itself; an old code is not accepted.

### 3.6 Staff check a card

Every staff role can check a card. The console keeps nothing of the check; the API records that a
check was made.

1. Open "Digital IDs". Under "Check a resident’s card", read the resident's QR code with a reader
   and put its text into "The QR code’s contents". Click "Check this card".
2. The field empties itself. "What the API says about this card" shows the name, the card status,
   the expiry and the barangay, with the sentence "Whether that settles what you are checking is
   your decision."
3. To compare the face, click "Show the photo on the card". A dialog "Open this resident’s photo?"
   comes first. Click "Open the photo".
4. When you are done, click "Hide the photo", then "Clear the answer".

An old or changed code is refused with "Not checked: …" and the server's reason.

### 3.7 Administrators: suspend, replace or revoke a card

1. Open "Digital IDs". Under "Residents’ cards", click "Open the card" on the resident's row.
2. Choose the act. Each opens a dialog that says what it does to the card in the app **before** its
   button:
   - "Suspend the card" ("Suspend this card?", then "Suspend it"): the app shows no QR code while it
     is suspended. It keeps no reason. There is no reinstate: a suspended card is later replaced or
     revoked.
   - "Replace with a new card" ("Replace this card?", then "Replace it"): the resident gets a new
     card number, and the app shows the new card.
   - "Revoke the card" ("Revoke this card?", then "Revoke it"): the app shows "This ID is no longer
     valid". The page then reads "This resident holds no current card." with "Issue a card".
3. "Keep it as it is" closes a dialog and changes nothing.

Changing a verified resident's account to another role on "Users and roles" also revokes the card
(UAT case ID-07, module 12).

### 3.8 Forgotten and changed passwords (residents)

**Forgotten password** (needs email; blocked on staging):

1. On the sign-in screen, tap "Forgot password?". Type the email and tap "Send reset code". For
   privacy, the app never says whether an account exists for that address.
2. Type the code from the email and tap "I-verify ang code".
3. Fill "Bagong password *" and "Ulitin ang bagong password *", and tap "I-save ang password".
4. The app shows "Na-update na ang password mo". Tap "Mag-sign in".

**Change the password while signed in:**

1. Tap "My Account", then "Settings". On "Settings & privacy", tap "Change password".
2. Fill "Current password", "New password" and "Repeat the new password". Tap "Save password". The
   app shows "Password updated".

Staff cannot see or set a resident's password. The reset code goes to the email address on the
account.

### 3.9 What verification unlocks

When a resident's account is verified, the app's verification page lists under "You can now":
"Request documents", "Message municipal offices" and "Use your Taytay digital ID". A guest or an
unverified resident can browse, but cannot do these three things. For document requests, "My
Account" shows under "Request documents" the line "Sending a request needs a verified account". A
guest who opens a document sees "Sign in to request a document"; an unverified resident sees "Verify
your account first" and "Go to verification". Neither gets a "Request this document" button. The
server also refuses a request from an account that is not verified, whatever the app shows.

### 3.10 A resident requests a document (the app)

1. The resident taps "My Account", then "Request documents". (A verified resident can also start
   from "Request documents" on the verification page.)
2. The "Request documents" screen lists what the municipal offices issue, with a search box "Search
   documents". Each line shows the fee ("No fee stated", "No fee", or "Fee: …, paid at the office")
   and the time (for example "About … working days", or "Processing time not stated").
3. The resident taps a document. "Document details" shows "What you need to send" (each item marked
   "Required" or "Optional") and "How to claim it". They tap "Request this document".
4. On "Request a document", under "What is the document for?", the resident fills "Purpose". Under
   "Files the office needs", they tap "Add file" for each item and add a photo or a file (PDF, JPEG
   or PNG). A file over 10 MB is refused on the phone, before it is sent.
5. They tap "Review request". "Review your request" shows the purpose and the files. They tap "Send
   request" (or "Change something").
6. "Request sent" shows "The office has your request" and the "Reference number", such as
   DR-2026-000123, with "Keep this number. The office uses it when you ask about your request."
7. To follow it, the resident opens "My document requests" ("Follow what you have sent"). Each move
   the office makes also appears under "Notifications" (the bell on "Home") when the app is opened.
   The notification names the request, never the office's words. Push notifications are not built
   yet.

What the resident sees as the request moves (app words on the left, console words on the right):

| In the app                 | In the console           | Who acts next                    |
| -------------------------- | ------------------------ | -------------------------------- |
| "Sent to the office"       | "Submitted"              | The office                       |
| "Being reviewed"           | "Under review"           | The office                       |
| "Needs more from you"      | "Needs more information" | The resident                     |
| "Approved, being prepared" | "Approved"               | The office                       |
| "Ready to claim"           | "Ready for pickup"       | The resident comes to the office |
| "Claimed"                  | "Released"               | Nobody: the request has ended    |
| "Not issued"               | "Rejected"               | Nobody: the request has ended    |
| "Cancelled"                | "Cancelled"              | Nobody: the request has ended    |

The resident can cancel with "Cancel this request" until the office starts on it. When the office
asks for more, the resident reads "What the office asked for", adds a note or a new file under "Send
what the office asked for", and taps "Send to the office". The app shows "Sent. The office will
review it again.". A new file is kept beside the old one; nothing they sent is replaced.

### 3.11 Staff work a document request (the console)

Staff at an office (MSWDO head, social worker, intake officer, release officer) and administrators
work requests. Each account sees only the requests of the offices it works for.

1. In the menu, under "Residents’ app", click "Resident document requests". The page is titled
   "Document requests from residents".
2. Read the two lines at the top. They are on every page of this module: "No online payment: the fee
   is paid at the office." and "The system tracks the request; the office prepares and signs the
   document itself."
3. The queue shows "Reference", "Resident", "Document", "Status", "Waiting" and "Office standard".
   It is ordered oldest waiting first. "Waiting" says on whom the request waits and for how long
   (for example, with the office for 3 days). "Office standard" is the working days from your
   Citizen's Charter. The console does not count working days, so nothing is called late.
4. Narrow the list with "Show" (for example "Every request still being worked") and "Document".
5. **A resident at the counter quotes a number:** type the whole number in "Reference number" and
   click "Find". Part of a number finds nothing. Click "Back to the queue" when done.
6. Click a reference to open the request. Read "The request": the "Resident", "Document", "Status",
   "Fee, paid at the office" and "Purpose, in the resident’s words". The purpose is shown on this
   page only.
7. **Files open only after a warning.** Under "What the resident sent", click "Show" beside a file.
   The dialog "Open a file a resident sent" shows "The server’s warning for this file:". Click "Open
   it" or "Do not open it". When done, click "Close and discard".
8. **Move the request on.** Under "Move the request on", choose in "Move to", for example "Under
   review", "Needs more information", "Approved", "Rejected", "Ready for pickup" or "Released". Only
   the moves allowed from the current status are offered.
9. Read "What happens when you confirm". Every move tells the resident in the app; the notice names
   the reference number only.
10. Fill "Words for the resident". **The resident reads this in the app, word for word.** Write it
    for them, 8 to 1,000 characters. For "Ready for pickup", also fill "When and where to claim it":
    the place, the days and hours, and what to bring.
11. Click "Record and tell the resident". The screen shows "Recorded: the request is now …".
12. Mark a request "Released" only once the document is in the resident's hands.

"History" lists every move, oldest first. Nothing in it is changed or removed. "This resident’s
other requests" opens the same resident's other requests.

### 3.12 The document catalogue (MSWDO head and administrators)

The catalogue is what residents can choose in the app. Open it from the queue with "Document
catalogue".

1. Click "Add a document", or "Edit" on a row.
2. Fill "Name", "What it is for", "Fee in pesos" (empty if the office states no fee, 0 for no fee),
   "Working days" (from your Citizen's Charter) and "Claim instructions".
3. Under "What a resident sends", click "Add a requirement" for each file (at most 10), with its
   "Label" and whether it is "Required".
4. Fill "Why". It is kept with the change and not shown to residents. Read "What saving does:" and
   click "Save the document".
5. To stop offering a document, click "Retire". Retiring is one-way: residents can no longer choose
   it, requests already filed continue, and nothing brings it back. To offer it again, add it as a
   new document.

**The LGU decides** which documents each office lists, their fees, their working days and their
requirements. Staging holds test entries only.

## 4. Hands-on exercises

Use only test data. Every reason or note starts with _UAT:_.

| #   | Exercise                                                                   | UAT case     |
| --- | -------------------------------------------------------------------------- | ------------ |
| 1   | Browse the app as a guest                                                  | REG-01       |
| 2   | Register: personal details and the barangay list                           | REG-02       |
| 3   | Create the account                                                         | REG-03       |
| 4   | Email code, terms, ID, selfie and review (only once email works)           | REG-04 to 07 |
| 5   | Staging route: send the ID from "Verification status"                      | REG-08       |
| 6   | Open the review queue; open the images only after the warning              | REG-09       |
| 7   | Approve; the resident sees "Your account is verified"                      | REG-10       |
| 8   | Reject with a reason; the resident corrects and sends again                | REG-11       |
| 9   | Show the digital ID and watch the code refresh                             | ID-01        |
| 10  | Check a card; then try an old code                                         | ID-02, ID-03 |
| 11  | Administrators: suspend, replace, revoke and issue a card                  | ID-04 to 06  |
| 12  | Change a resident's password while signed in                               | REG-13       |
| 13  | Forgotten password (only once email works)                                 | REG-12       |
| 14  | The head adds a test document to the catalogue                             | DOC-01       |
| 15  | Change a document with a reason; retire another                            | DOC-02       |
| 16  | A guest and an unverified resident try to request a document               | DOC-03       |
| 17  | A verified resident sends a request with files and gets a reference number | DOC-04       |
| 18  | Find the request in the queue by status and by reference number            | DOC-05       |
| 19  | Open a file only after the server's warning                                | DOC-06       |
| 20  | Ask for more; the resident sends it; the request returns to review         | DOC-07       |
| 21  | Approve, mark ready for pickup with claim details, then release            | DOC-08       |
| 22  | Refuse a request with words for the resident                               | DOC-09       |
| 23  | The resident cancels a request the office has not started                  | DOC-11       |
| 24  | The resident reads every move and its notification in the app              | DOC-12       |

Exercises 14 to 24 follow one test request from the catalogue to the counter, as the DOC cases do.
The staff accounts that work the requests (HEAD, INTAKE, RELEASE) must be assigned to the MSWDO
office. The test document and its fee are examples, never the LGU's real ones.

## 5. What the system deliberately does not do

- **It never decides who is a real resident.** A person looks at the ID and the selfie and decides.
- **It never shows an ID or a selfie without a warning.** The pictures load only after you ask, and
  are discarded when you close the review.
- **It cannot undo an approval.** Check before you record it.
- **It keeps nothing from a card check in the console.** The API records that a check was made.
- **It does not take payments.** Any fee is paid at the office. Nothing is collected online.
- **It does not make or sign documents.** The office prepares and signs the paper itself.
- **It does not call a document request late.** It shows how long a request has waited and the
  office's standard, side by side.
- **It does not reopen a refused or cancelled request.** The resident files a new one.
- **It does not let staff see or set a resident's password.**

## 6. Common questions and troubleshooting

**The resident never got the 6-digit code.** On staging this is expected: no email is sent. On the
live system, ask them to check the spam folder and tap "Resend". The code expires after 10 minutes.

**"Record the decision" stays greyed out.** The note or reason is too short. Write a full sentence.

**I approved the wrong person.** Nothing in the console undoes an approval. An administrator can
change the account's role to "Resident" on "Users and roles", which marks it unverified and revokes
its digital ID (module 12).

**The card check says "Not checked: …".** The code is old (codes change every few minutes) or was
typed wrongly. Ask the resident to show a fresh code.

**A resident at the counter asks about a document request.** Ask for the whole reference number,
type it in "Reference number" and click "Find". Another office's request is not found here.

**I cannot see "Resident document requests".** Your role does not work requests (the auditor and the
barangay link do not), or your account is not assigned to an office. Ask the administrator.

**The resident says the app would not send their request.** Read the message on their phone. "Only
verified residents can do this" means the account is not verified yet.

**I reloaded the page and was signed out.** This is by design. Sign in again.

## 7. Quick reference

**Residents (the app)**

- Register: "Create an account" → six steps → "Submit for verification".
- Send or fix an ID: "My Account" → "Verification status".
- Digital ID: "Verification status" → "Use your Taytay digital ID".
- Password: "Forgot password?" (signed out), or "Settings" → "Change password" (signed in).
- Documents: "My Account" → "Request documents"; follow them in "My document requests".

**Administrators (staff website)**

- Review IDs: "ID verification" → "Review" → "Show the ID and the selfie" → "Decision" → "Record the
  decision".
- Cards: "Digital IDs" → "Residents’ cards" → "Open the card".

**Every staff role**

- Check a card: "Digital IDs" → "The QR code’s contents" → "Check this card" → "Clear the answer".

**Staff at an office**

- Document requests: "Resident document requests" → "Reference number" + "Find", or open from the
  queue → "Move to" → "Words for the resident" → "Record and tell the resident".
- Catalogue (head, administrator): "Document catalogue".

**Remember**

- No payment and no signing online. The office prepares and signs the document.
- Everything you write on a document request is read by the resident, word for word.
- Images and files open only after a warning. Close them when done.

## 8. Check your understanding

1. Which role reviews a resident's ID on the staff website?
2. When do the ID and the selfie appear on the review screen?
3. You reject an ID. Who reads the reason you type, and where?
4. What happens to the resident's account when you approve, and can you undo it?
5. A resident shows a QR code that was read 10 minutes ago. What will the card check say, and why?
6. Name the three things a resident can do in the app only once verified.
7. A resident asks to pay the fee for a certificate in the app. What do you tell them?
8. You move a document request to "Ready for pickup". What must you write, and who reads it?

## Facilitator notes

**Before the session.** Run exercise 5 yourself the day before so at least one request waits in the
queue. Check that HEAD, INTAKE and RELEASE are assigned to the MSWDO office (UAT case ACC-01): only
staff at an office work its requests. RES-B must be verified (exercise 7) before exercise 17. The
test document is created in exercise 14.

**Answer key**

1. Only the system administrator.
2. Only after you click "Show the ID and the selfie" and then "Show them" in the warning dialog.
   They are discarded when you hide them, close the review or leave the page.
3. The resident reads it in the app, under "REASON FROM TAYTAY LGU" on "Verification status".
4. The account is marked verified and a digital ID is issued with the selfie as its photo. Nothing
   in the console can undo an approval.
5. "Not checked: …" with the server's reason. The code refreshes every few minutes and an old code
   is not accepted.
6. Request documents, message municipal offices, and use the Taytay digital ID.
7. Nothing is paid online. Any fee is paid at the office.
8. "Words for the resident" and "When and where to claim it" (the place, the days and hours, and
   what to bring). The resident reads both in the app, word for word.
