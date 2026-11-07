# Module 11: Directory Management Orientation

Tracker item 11. Read [README.md](README.md) first for the room, the equipment and how the session
runs.

## 1. Purpose, who attends, time and what to bring

**Purpose.** After this session you can keep the public information in the residents' app current:

- the app directory: offices, Tulong pages and hotlines;
- the home screen: banners and quick links;
- Balita, the municipality's news articles in the app;
- the office inbox, where residents write to an office and staff reply.

**Who attends.** System administrators: only they change the app directory, the home screen and the
app settings. The MSWDO head and the staff who write Balita or answer the office inbox (staff
accounts assigned to an office). Anyone the LGU names to keep the app's public information current
needs one of these accounts.

**Time.** About 2.5 hours, with a 10-minute break.

**What to bring.** Your staging test account. The room needs at least two Android phones with the
staging app, so everyone sees their changes reach the app. Bring a small test JPEG (under 5 MB), a
large photo (over 5 MB) and a test PDF, all without personal content.

**Words used in this module**

- **App directory**: the offices, Tulong pages and hotlines residents find in the app.
- **Tulong page**: an information page about a municipal programme or service. Residents read it;
  they cannot apply through it.
- **Address in the app**: the short name of a page in the app's links, in lower-case words joined by
  hyphens, such as civil-registrar.
- **Balita**: news articles from the municipality, shown in the app's "Balita" tab.
- **Office inbox**: conversations residents start with an office from the app.

**A change here reaches every resident** the next time their app loads. Check the words before you
save.

## 2. Agenda

| Minutes | Part                                                              |
| ------- | ----------------------------------------------------------------- |
| 10      | Welcome, attendance, purpose                                      |
| 15      | What residents see: Directory, Tulong, hotlines, Home (on phones) |
| 35      | Administrators: offices, images, Tulong pages, hotlines           |
| 20      | Administrators: the home screen, banners and quick links          |
| 10      | Break                                                             |
| 30      | Balita: write, publish, pin, take off the app                     |
| 20      | The office inbox: read, reply, mark read, close                   |
| 10      | Check your understanding, questions, evaluation form              |

## 3. Step-by-step guide

### 3.1 What residents see

1. In the app, tap "Directory". Search with "Search offices or services" and tap an office. The
   office page shows "Call", "Directions" and "Message", the details "Location", "Office hours",
   "Phone", "Email" and "Head", and a "Services" card.
2. On "Home", under "Emergency", tap "All hotlines". "Emergency hotlines" lists the lines under
   "Municipal" and "Barangay". Tapping a line opens the phone's dialler; nothing is dialled until
   the resident presses call.
3. Tap "Tulong". The tab says "Information on municipal programmes. These are information pages, not
   applications." A page shows "Who can avail" and "Requirements (information only)". There is no
   apply button.
4. Tap "Message" on an office. A guest gets "Sign in to continue". A resident who is not verified
   gets "Verify your account to message offices". Only a verified resident gets "New message".

### 3.2 Add an office (administrators)

1. Open "App directory". It has three tabs: "Offices", "Tulong pages" and "Hotlines".
2. On "Offices", click "Add an office".
3. Fill "Name" and "Address in the app" (lower-case words joined by hyphens, such as
   civil-registrar). Fill "Short name", "Category", "Office hours", "Phone" and "Email" as needed.
4. Read "What this does:" above the button. Click "Add the office". The screen confirms that the
   office was added to the app's directory.

If something is missing or wrong, nothing is sent and the screen lists it under "Not sent — the app
would refuse it:".

### 3.3 Change an office

1. Click "Edit" on the office. The part "Set when the office was created" shows what cannot be
   changed here.
2. Change what you need and click "Save changes".

### 3.4 Images: the rules

Offices can have a "Banner" (across the top of the office's page in the app), and so can home screen
banners.

- An image must be a JPEG, PNG or WebP, up to 5 MB.
- The console checks the file **before** it is sent, by what the file really is, not by its name. A
  wrong file is refused with "That file is not a JPEG, PNG or WebP image, whatever its name says.
  …". A large one is refused with "That file is … MB. The app takes images up to 5 MB; save a
  smaller copy and choose it again." Nothing is sent.
- Every resident sees the image. Never use one that shows personal information.

### 3.5 Delete an office

1. Click "Delete" on the office. A dialog asks "Delete …?" and lists "What this does:" before its
   buttons.
2. Click "Keep it" to change nothing, or the delete button that names the office.

An office named by a staff account, a Balita article, a Tulong page or a conversation cannot be
deleted until those are moved.

### 3.6 Tulong pages

1. On the "Tulong pages" tab, click "Add a page".
2. Fill "Name", "Address in the app", "Category", "Summary" and "Details". Click "Add the page".
3. To take a page out of the app's list without deleting it, tick "Hide from the app’s catalogue"
   and click "Save changes".
4. A hidden page leaves the console's list too. To open it again, type its address in "Open a page
   by its address" and click "Open".
5. To delete a page, click "Delete" and confirm.

A Tulong page is information only. It is not one of the office's assistance programmes.

### 3.7 Hotlines

1. On the "Hotlines" tab, click "Add a hotline".
2. Fill "Name", "Number", "Kind of line" and "Order" (lower comes first). Leave "Show in the app"
   ticked to show it.
3. Click "Add the hotline".
4. To hide a line for a while, click "Edit", untick "Show in the app" and click "Save changes". The
   console then shows it as "Hidden from the app".
5. To delete a line, click "Delete" and confirm.

Check each number before you add it: residents call these lines in an emergency.

### 3.8 The home screen (administrators)

1. Open "Home screen". It has "Banners" and "Quick links".
2. **Add a banner:** click "Add a banner". Fill "Title" (say what the banner announces) and "Order",
   choose the picture under "Banner image", and leave "Show on the app’s home screen" ticked. Read
   the warnings and click "Add the banner".
3. Read the sentence beside the banners: "The app has no description of a banner’s image to give a
   resident who cannot see it: the API keeps none. Only the title is stored with the image." So put
   what matters in the title, not only in the picture.
4. **Add a quick link:** click "Add a link". Fill "Label", "Opens" and "Order". Click "Add the
   link".
5. "What the app shows now" lists what residents see.
6. To remove one, use "Delete the banner" or "Delete the link". A quick link has no hidden state:
   deleting is the only way to take one off.

### 3.9 Balita

Who can write: staff accounts assigned to an office (the MSWDO head included), and administrators.

1. Open "Balita" and click "Write an article".
2. Fill "Title", "Words" and "Category". Add a "Cover image" if you have one. Read the line under
   it: "The API keeps no description of the cover, so the app has none to give a resident who cannot
   see it. Say what matters in the words."
3. Click "Save as a draft". The screen shows "Saved as a draft.". A draft is not in the app.
4. **Before you publish, read the warning above the button:** "It cannot be recalled from anybody
   who has read it. Taking it off the app later removes it only from then on."
5. Click "Publish to residents". The screen shows "Published. Residents can read it in the app.".
6. Under "Published articles", click "Open" on an article to manage it:
   - "Pin to the top" keeps it first in the app ("Pinned."); "Unpin" undoes it.
   - "Take it off the app" removes it from the app from now on. It becomes a draft, kept on the
     page. People who already read it have read it.

In the app, residents can filter Balita by category, and "Lahat" shows every article.

### 3.10 The office inbox

Who can answer: staff accounts assigned to an office, and administrators. Each answers the
conversations of its own office.

1. Open "Office inbox". The list shows "Subject", "Office", "Latest message", "Unread by the office"
   and "Status". It never shows what the resident wrote: you read that only by opening the
   conversation.
2. Open a conversation. A photo the resident attached opens only after a warning: click "Show image
   1", read "Before you open this image", and click "Show it".
3. Type in "Your reply to the resident" and click "Send the reply". The screen shows "Sent. The
   resident can read it in the app.".
4. Click "Mark as read for the office" when the office has read it.
5. To end a conversation, click "Close this conversation". The dialog "Close this conversation?"
   lists what closing does. Click "Close it" or "Keep it open". Once closed, nobody can write in it
   again, and the app shows "This conversation is closed.".

Write every reply as the office, in plain words. The resident reads it word for word.

### 3.11 App settings

The app's contact line, its Terms of Use and Privacy Notice, the oldest app version allowed and its
feature flags are on "App settings". They are covered in
[module 12](12-system-administration-and-turnover.md), because a change there can stop residents
using the app.

## 4. Hands-on exercises

Use only test data. Name every test item with _UAT_ and delete it at the end.

| #   | Exercise                                                        | Role                | UAT case |
| --- | --------------------------------------------------------------- | ------------------- | -------- |
| 1   | Search the directory and open an office in the app              | GUEST               | DIR-01   |
| 2   | Try "Message" as a guest, an unverified and a verified resident | GUEST, RES-A, RES-B | DIR-02   |
| 3   | Open the hotlines in the app                                    | GUEST               | DIR-03   |
| 4   | Open a Tulong page; look for an apply button                    | GUEST               | DIR-04   |
| 5   | Add a test office, and find it in the app                       | ADMIN, GUEST        | DIR-05   |
| 6   | Rename the test office                                          | ADMIN, GUEST        | DIR-06   |
| 7   | Try a large photo and a PDF as a banner; then a small JPEG      | ADMIN               | DIR-07   |
| 8   | Delete the test office through the confirmation                 | ADMIN, GUEST        | DIR-08   |
| 9   | Add, hide, find and delete a Tulong page                        | ADMIN, GUEST        | DIR-09   |
| 10  | Add, hide and delete a hotline                                  | ADMIN, GUEST        | DIR-10   |
| 11  | Add a banner and a quick link; see them in the app; delete them | ADMIN, GUEST        | DIR-11   |
| 12  | Write a Balita draft                                            | HEAD                | NEWS-01  |
| 13  | Publish it after reading the warning                            | HEAD, GUEST         | NEWS-02  |
| 14  | Pin, unpin and take it off the app                              | HEAD, GUEST         | NEWS-03  |
| 15  | Filter Balita by category in the app                            | GUEST               | NEWS-04  |
| 16  | A verified resident writes to the MSWDO; staff reply            | RES-B, INTAKE       | NEWS-05  |
| 17  | Mark the conversation read and close it                         | INTAKE, RES-B       | NEWS-06  |

## 5. What the system deliberately does not do

- **It never deletes without a confirmation.** Every delete opens a dialog that says what it does
  first, with "Keep it" to change nothing.
- **It never sends an image it would refuse.** A wrong or oversized file is refused before it leaves
  your computer.
- **It never invents an image description.** The API keeps none for banners or Balita covers, and
  the screen says so. Put what matters in the title or the words.
- **It cannot recall a published article** from anybody who has read it. Taking it off the app
  removes it only from then on.
- **It never treats a Tulong page as an application.** Residents read it; they cannot apply through
  it.
- **It never shows a resident's message in the inbox list,** and never opens an attachment without a
  warning.
- **It never asks for a reason to close a conversation.** Closing is final.

## 6. Common questions and troubleshooting

**I saved a change but the app does not show it.** The app reads changes the next time it loads. On
the phone, pull down on "Home" to refresh, or close and reopen the app.

**The console refused my image.** Read the message. Save the picture as a JPEG, PNG or WebP under 5
MB and choose it again.

**I cannot delete an office.** It is still named by a staff account, a Balita article, a Tulong page
or a conversation. Move those first.

**I hid a Tulong page and now cannot find it.** Type its address in "Open a page by its address" and
click "Open".

**I published an article with a mistake.** Take it off the app, correct it, and publish it again.
Anyone who read the first version has already read it, so consider whether a correction notice is
needed.

**I do not see "App directory" or "Home screen".** Only the system administrator has them.

**I do not see "Office inbox" or cannot write Balita.** Your account must be assigned to an office.
Ask the administrator (module 12).

## 7. Quick reference

**App directory (administrators)**

- "App directory" → "Offices" / "Tulong pages" / "Hotlines".
- Add: "Add an office" / "Add a page" / "Add a hotline". Read "What this does:" first.
- Change: "Edit" → "Save changes". Delete: "Delete" → confirm, or "Keep it".
- Images: JPEG, PNG or WebP, up to 5 MB.

**Home screen (administrators)**

- "Home screen" → "Add a banner" / "Add a link".
- Banners carry no image description: say it in the "Title".

**Balita**

- "Balita" → "Write an article" → "Save as a draft" → read the warning → "Publish to residents".
- "Pin to the top", "Unpin", "Take it off the app".

**Office inbox**

- "Office inbox" → open → "Your reply to the resident" → "Send the reply".
- "Mark as read for the office"; "Close this conversation" → "Close it".

**Remember**

- A change reaches every resident the next time the app loads.
- A published article cannot be recalled from people who have read it.
- Images and attachments open only after a warning.

## 8. Check your understanding

1. Which role changes the app directory and the home screen?
2. You choose a 7 MB photo as an office banner. What happens?
3. What is the difference between hiding and deleting a Tulong page?
4. Why does the home screen tell you the app has no description of a banner's image, and what do you
   do about it?
5. You published a Balita article with a wrong date. Can you recall it? What can you do?
6. Can a resident apply for a programme through a Tulong page?
7. Where do you read what a resident wrote to the office, and when does an attached photo appear?
8. What happens when you close a conversation?

## Facilitator notes

**Before the session.** Make sure staging has at least one office (the MSWDO), one Tulong page that
is featured, and one hotline. RES-B must be verified (module 9, or UAT case REG-10) and INTAKE
assigned to the MSWDO office (UAT case ACC-01) for exercises 16 and 17. At the end, check that every
_UAT_ test item has been deleted or taken off the app.

**Answer key**

1. Only the system administrator.
2. The console refuses it before sending: "That file is … MB. The app takes images up to 5 MB; save
   a smaller copy and choose it again." Nothing is sent.
3. A hidden page stays in the system and can be opened by its address; it is just not listed in the
   app. A deleted page is gone from the app.
4. The API keeps no description of a banner's image, so a resident who cannot see the picture gets
   only the title. Put what matters in the title.
5. No: it cannot be recalled from anybody who has read it. Take it off the app (it becomes a draft),
   correct it and publish it again.
6. No. Tulong pages are information only. There is no apply button.
7. Only by opening the conversation in "Office inbox"; the list never shows it. A photo appears only
   after "Show image 1" and the warning "Before you open this image".
8. Nobody can write in it again, staff or resident. The app shows "This conversation is closed.". No
   reason is asked for.
