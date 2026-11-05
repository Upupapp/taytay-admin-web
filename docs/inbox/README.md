# Office inbox

Residents write to an LGU office from the residents' app; the office's staff answer here. Built on
what the Node API serves (`DL-164`, `DL-168`) — the threads routes and the office directory — and on
the precedents of the ID verification review (`DL-167`).

## The three things to understand first

### 1. What a resident wrote is theirs, and is read by opening it

A message here is somebody writing to their government: a death in the family, a roof the typhoon
took, a child's vaccine. So:

- **No preview in the list.** The API sends the first 140 characters of each conversation's latest
  message with every row. The console does not map it — the model has no field for it — so the list
  shows the subject, the office, when it last moved, how much is unread and whether it is open. The
  words are read by opening the conversation. A list is the screen left open on a desk.
- **No name.** The API identifies the resident by account id only, and the console has no read that
  names an account by id. The screen says so rather than showing an identifier that looks like
  knowing who wrote.
- **Nothing logged, stored or put in a notification.** No `console`, no web storage, no toast that
  quotes a message. A refusal says the server's words — "That thread is closed." — never what was
  being sent.

### 2. The images are the resident's

An attachment is a media id. **Nothing is loaded until somebody asks**, and asking opens a warning
first: a resident sent it, it may show a document, a home or a person, open it only to answer and
where nobody else can see the screen, do not copy it — the precedent of the ID review and of
`openDocument` (`DL-77`). Only then does the data layer read `GET media/{id}/content` as bytes through
`ApiClient.blob`, with the bearer token in a header and never in an address, and only for a media id
the message actually carries. The bytes become object URLs made by the page's own `ObjectUrls` —
moved to `shared/media` for this, since two features now need it — revoked when the image is hidden,
when another conversation takes the page's place, and when the page is left.

### 3. An empty inbox is asked about

`GET threads` answers a **staff account with no office** with an empty page — the same answer as an
office nobody has written to. One says residents are quiet; the other that this account cannot see
them. So:

- **At sign-in** the server withholds `office-inbox.manage` from such an account, so it is offered no
  inbox at all; `GET me` says it has no office (`AuthenticatedUser.awaitingOffice`), and the page an
  account lands on when nothing else is open — "Not connected yet" — says it is not assigned to an
  office, and that an administrator assigns offices under Users and roles.
- **Mid-session** (an administrator removed the assignment after sign-in, so the session still holds
  the key) the adapter asks `GET me` before believing an empty first page, and answers `no-office`;
  the screen then explains instead of showing the empty table.

## One conversation

- **By address.** `GET threads/{id}` reads one, so a conversation has a route (`/inbox/{id}`) a reload
  or a colleague's link can answer. After every act it is read again from the server, never patched —
  quietly, keeping what is on screen until the answer arrives.
- **Oldest first**, as a conversation is read; the server pages newest first, so "Show earlier
  messages" fetches older pages. Each message says whose it is in words: *The resident*, *The office*,
  or *You, for the office* — and office messages are indented as well, so authorship never rests on
  position or colour alone.
- **Replies are words**, 1 to 4,000 characters (the API's own limits, trimmed). The server refuses a
  reply to a closed conversation with `409`; the screen says what the server said. The API also
  accepts an image with a reply; this console does not send one yet.
- **Mark read is the office's mark.** The API keeps one read mark per conversation for the whole
  office (`office_last_read_at`), so marking read clears the count for every colleague. The screen
  says so before the button. Opening a conversation does not mark it read, for the same reason: a
  glance should not clear it for the colleague who will answer.
- **Close is confirmed, and asks for no reason.** The confirmation lists what the server does —
  nobody can write in it again, the resident's next message starts a new conversation, the resident
  is not told, the server records who closed it and when but **keeps no reason**, and nothing here
  reopens it (`THREAD_CLOSE_EFFECTS`, read from the backend's handler at `2736e28`). A reason box
  whose words go nowhere would be a record somebody believes exists.

## The lifecycle

`open → closed`, and `closed` is terminal: the API has no route that reopens a conversation. Defined
once in `domain/inbox` (rule 7). The resident can close it too.

## Whose conversations

The server decides: staff see their own office's, an administrator every office's. The console offers
no office filter — one it applied would be a scope the server does not enforce. Each row names the
office it went to, from the office directory (`GET offices`, read in full, `DL-161`); if the directory
cannot be read, offices are shown by their slug and the screen says why.

## Access

`office-inbox.manage` is the API's own key, added to `PERMISSIONS` unchanged (`DL-122`). The server
grants it to administrators, and to staff **only while assigned to an office**. In the mock the roles
that work at the MSWDO hold it — head, social worker, intake officer, release officer, and the system
administrator; the barangay link (who works from a barangay, not at an office) and the auditor (a
read-only role; the key replies and closes) do not. Mutating. Both routes and the menu entry ask for
it; none of that is the protection — the API refuses anybody else.

## Checks

`check:inbox` (in `verify`) holds the module to the above: no preview in the model, mapper, adapter
or list; no `console`, storage, cookie or notification anywhere in the module; media ids and no
address on the model; bytes through `ApiClient.blob` for a carried id only; `openAttachment` called
only from the warning's own button; object URLs only through `ObjectUrls`, revoked on hide and on
destroy; an empty first page asked about and explained; close by id with an empty body and a
confirmation that collects no words; the key mutating, on both routes and the menu, and not held by
the auditor or the barangay link. Twenty-four planted regressions, each caught.

## Known gaps

- **No resident name** (above) — the API sends none; whether it should is the office's decision.
- **No image sent with a reply.** The API accepts one; the console would need a multipart upload,
  which no adapter has yet and every contract check would have to learn.
- **The reader's colleagues are "the office".** The API names a sender by account id and the console
  cannot resolve a colleague's name; only the reader's own messages say *You*.
- **Not run against a live API.** Built and tested against the vendored spec and composed fixtures.
