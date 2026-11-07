# Orientation programme: Taytay, Rizal LGU platform

These are the orientation materials for items 9 to 12 on the project tracker (deliverables D8 to D11
in the requirements). The project team runs the four sessions with LGU staff near the end of the
project, on the staging site, before the platform goes into use.

| Item | Module                                                                                     | Length               |
| ---- | ------------------------------------------------------------------------------------------ | -------------------- |
| 9    | [Citizen Registration Orientation](09-citizen-registration.md)                             | About 3 hours        |
| 10   | [Roster and Dashboard Orientation](10-roster-and-dashboard.md)                             | About 3 hours        |
| 11   | [Directory Management Orientation](11-directory-management.md)                             | About 2.5 hours      |
| 12   | [System Administration and Turnover Orientation](12-system-administration-and-turnover.md) | About 2.5 to 3 hours |

The forms for every session (attendance sheet, evaluation form and completion record) are in
[forms.md](forms.md).

## The platform in one paragraph

The platform has three parts. The **residents' app** is the Taytay app on Android phones: residents
create an account, verify it with a government ID, carry a digital ID, read the directory and
Balita, write to offices and request documents. The **staff website** (also called the console) is
where office staff work: https://taytay.139-162-51-165.sslip.io during the project. The **API** is
the server between them. It keeps the records and checks every permission again, so a button that is
hidden from you is never the only protection.

## How to read these materials

- Words in "quotes" are exactly what the screen shows: a menu entry, a button, a field, a message.
  If your screen shows different words, write it down: it is either an update or a defect.
- Text in _italics_ is an example of what you type.
- "…" inside quotes stands for a part the screen fills in, such as a name or a number.
- Each exercise names its test case from the UAT pack
  ([../uat/uat-test-scripts.md](../uat/uat-test-scripts.md)). The test case has the full steps and
  the expected result.
- Use only fictional test data. The people in the staging registry share the surname **Halimbawa**.
  Never type a real resident's name, birth date, address, phone number, ID number, photo or story,
  not even to try something out.

## Who attends

Staff attend by their office role. The table is a proposal: the LGU confirms each session's
audience. These are the roles in the console, with the codes the UAT pack uses for their test
accounts ([../uat/README.md](../uat/README.md)).

| Code        | Role                           | 9   | 10  | 11  | 12  |
| ----------- | ------------------------------ | --- | --- | --- | --- |
| ADMIN       | System administrator           | Yes | Yes | Yes | Yes |
| HEAD        | MSWDO head                     | Yes | Yes | Yes | Yes |
| SW1, SW2    | Social worker                  | Yes | Yes | Yes | -   |
| INTAKE      | Intake officer                 | Yes | Yes | Yes | -   |
| RELEASE     | Release officer                | Yes | Yes | Yes | -   |
| BLINK       | Barangay link                  | Yes | Yes | -   | -   |
| AUDITOR     | Auditor                        | -   | Yes | -   | Yes |
| RES-A, B, C | Participants playing residents | Yes | -   | Yes | -   |

- **Module 9** is for the system administrators (only they review IDs and manage cards), every staff
  member who checks a resident's digital ID or helps residents at the counter, and the staff who
  will work residents' document requests.
- **Module 10** is for everyone who keeps the residents registry or reads the dashboard.
- **Module 11** is for the system administrators (only they change the app directory, the home
  screen and the app settings), and the staff who write Balita or answer the office inbox.
- **Module 12** is for the system administrators, the MSWDO head, the auditor, the LGU's ICT officer
  and the Data Privacy Officer. The Data Privacy Officer needs to attend at least the part on the
  Terms of Use and the Privacy Notice.

A participant may attend a module outside their role to understand the whole platform. They practise
with an account of their own role, so some buttons will not appear for them. That is by design.

## Room and equipment

For every session:

- A room with a projector and screen, and power outlets for every laptop.
- A reliable internet connection that reaches the staging site. Test it on the day, from the room.
- One computer per participant (a pair can share if needed), with a current Chrome or Edge browser.
- **One staging test account per participant**, issued by the system administrator with the right
  role, office and office role. Nobody shares an account, and no password is written on paper, in a
  chat or on the board.
- Printed copies of the module's quick reference page, and of the forms in [forms.md](forms.md).

Also for module 9:

- **Android phones with the staging build of the Taytay app**, one per participant or per pair. The
  developer supplies the build. There is no iPhone version yet.
- One test email inbox per phone, not used by any other Taytay account.
- A printed sample ID card marked SAMPLE, and a printed sample face for the selfie. Never use a real
  ID or a photo of a real person.
- A QR-reader app on a second phone, to read a digital ID's code for the card check.
- Two or three small test files (a PDF and a photo with no personal content) for document requests.

Also for module 11: at least two Android phones with the staging app, so participants see their
changes reach the app, and a small test JPEG for banners.

## Checklist before each session

One week before:

1. Agree the date, the room and the participant list with the MSWDO head.
2. Ask the system administrator to issue one staging account per participant, and to give each its
   role, office and office role (UAT cases ACC-01 and ACC-02). Staff who will answer the office
   inbox, write Balita or work document requests must be assigned to an office.
3. Check that the staging test data is in place: the Halimbawa residents, at least one office in the
   app directory, and (for module 9) at least one document in the document catalogue.
4. For module 9, install the staging app on every phone and create the test email inboxes.
5. For module 12, check that the turnover package ([../turnover/](../turnover/)) is ready to hand
   over.

On the day, before participants arrive:

1. Open the staff website on the projector computer and sign in as the trainer's account.
2. Open each screen the module uses once, to be sure staging answers.
3. Run the first exercise of the module yourself.
4. Put out the attendance sheet, the printed quick references and the evaluation forms.

## How a session runs

1. **Welcome and attendance.** Every participant signs the attendance sheet.
2. **Purpose.** The trainer explains what the module covers and what the system deliberately does
   not do.
3. **Demonstration.** The trainer shows each task on the projector, using the step-by-step guide.
4. **Hands-on practice.** Participants do the exercises with their own test account, in the order
   given. The trainer and an assistant walk the room.
5. **Check your understanding.** Participants answer the questions at the end of the module, alone
   or in pairs, and the trainer goes through the answers.
6. **Questions and evaluation.** Open questions, then every participant fills in the evaluation
   form.

Two rules hold in every session:

- **Staging holds test data only.** Every reason, note or message you type starts with _UAT:_, so
  test records can be told apart.
- **Reloading the staff website signs you out.** This is by design: your sign-in is held in memory
  only. Move around with the menu and the links, not the browser's reload button.

## How completion is recorded

- The **attendance sheet** is signed by each participant at the start of the session.
- A participant **completes the module** when they have done its exercises with their own test
  account and gone through the module's check-your-understanding questions with the trainer.
- The **evaluation forms** are collected at the end. They can be anonymous.
- The trainer and the LGU representative sign the **completion record** for the session, listing who
  completed it and anything left to follow up.
- The LGU decides where the signed originals are filed. The developer keeps a scanned copy with the
  project records.

## Known limits on staging

- **No email.** Staging sends no email, so the 6-digit email code and the password reset code never
  arrive. Module 9 uses the staging route in UAT case REG-08 to put an ID in the review queue.
- **Android only.** No iPhone build exists yet.
- **Placeholder legal texts.** The Terms of Use and the Privacy Notice are placeholders until the
  LGU writes them (module 12).
