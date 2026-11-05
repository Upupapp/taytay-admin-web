# Balita

**Balita** is the news residents read in the Taytay app: a title, the words, an optional category
and cover, the office it comes from, and whether it is published or pinned. Read through
`GET news` (the residents' own list — published only, pinned first, then newest, cursor-paged) and
`GET news/{id}`; written through `POST news` and `PATCH news/{id}` as forms, because the cover
travels with the words; pinned through `POST`/`DELETE news/{id}/pin`; the cover's bytes at
`GET news/{id}/cover`. `news.write` on the server — administrators, and staff while assigned to an
office. Built on what the Node API serves (`DL-164`, `DL-171`). One route, `/balita`.

## The things to understand first

### 1. Not the newsfeed

The console's newsfeed module (`DL-122`–`DL-127`) is a different model — scheduling, archiving,
image descriptions, moderation — that the API cannot serve, and it stays withheld (`DL-164`). Balita
has its own domain, port, screen and key; nothing names the newsfeed's. The page says near its title
that residents read it in the app and that it is not the newsfeed.

### 2. Publishing goes outward, and is warned about before its button

`DL-124`'s doctrine: somebody deciding reads a warning; somebody who has decided dismisses a
confirmation. So every outward act has its effects **above its own button** (`BALITA_EFFECTS`, read
from the backend at `2736e28`):

| Act | What the API does |
| --- | --- |
| Publish | Every resident can read it at once; anyone with its link can open it. It cannot be recalled from anybody who has read it. **No notification is sent.** |
| Save as a draft | Residents cannot see it. The API keeps no list of drafts. |
| Take it off the app | `status: draft`. It leaves Balita from then on; whoever read it keeps it. Published again, it keeps its **first** publication date (`COALESCE`), so it does not return to the top. |
| Change a published article | Residents read the new words next time; whoever read the old ones keeps them. |
| Pin / unpin | Pinned articles come first, even when residents choose a category. |

### 3. The API lists no drafts

`GET news` is the residents' list. A draft is readable only by its id (by its office's staff and
administrators). So a draft created, opened or taken off on this page is kept **in the page's
memory** — never in storage — with its ID shown, and the page says it is gone when the page is left.
"Open an article by its ID" reads one by the ID this page showed or the audit trail records.

### 4. The cover

- **No description, said rather than collected** (`DL-125`, as `d2d9188` did for banners). The API
  keeps none; the model, the wire and the form have no field for one, and the form says the app has no
  description to give a resident who cannot see the cover — so what matters goes in the words.
- **Replacing deletes the old image**; a cover cannot be removed, only replaced (a form cannot say
  `null`). Both said beside the field.
- **Bytes, not an address.** The model knows whether there is a cover, never `cover_url`; the editor
  shows it on request through `ApiClient.blob`, revoked on hide and on leave.

### 5. Who writes what

Staff write for their own office — the API uses it when none is chosen and refuses another — and
change only their office's articles; an administrator must choose the office. The editor offers
"My own office (staff)" first and the directory's offices after it, and a refusal is shown in the
API's words. A category, once chosen, can be changed but not removed (the change cannot clear it).

## Access

`news.write` is the API's own key, added to `PERMISSIONS` unchanged (`DL-122`), mutating. The server
gives it to administrators and to staff at an office — the rule of `office-inbox.manage` — so the
roles holding that key hold this one in the mock. Not `newsfeed.*`.

## Checks

`check:balita` (in `verify`): residents told and the newsfeed disclaimed; nothing in the module names
the newsfeed's port, model or keys; every publish, take-off and pin button stands below its effects;
every write leaves through `send`; the effects say publishing cannot be recalled and sends no
notification, and taking off leaves what was read with its readers and keeps the first date; no cover
address and no description field anywhere, and the screen says the API keeps none; nothing in web
storage or the console; the server's key. Sixteen planted regressions, each caught, every file
restored.

## Known gaps (the backend's)

- **No list of drafts** for staff: a draft not opened on this page is reachable only by its ID.
- **No description of a cover** (`alt_text`), so the app has none for a resident who cannot see it.
- **A category or a cover cannot be removed** once set.
- **No schedule and no archive**: an article is published now or not at all, and taken off by
  returning it to a draft.
- **Not run against a live API.** Built and tested against the vendored spec and composed fixtures.
