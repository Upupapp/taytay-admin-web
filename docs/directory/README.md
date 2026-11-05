# App directory

What residents read in the Taytay app about where to go and whom to call: the **offices** of the
directory, the **Tulong pages** that tell them about a service, and the **hotlines** they can call.
Built on what the Node API serves (`DL-164`, `DL-170`), admin only on the server:

| Section | Reads | Writes | Key |
| --- | --- | --- | --- |
| Offices | `GET offices` (public, cursor) | `POST admin/offices`, `PATCH admin/offices/{id}` (forms, with the banner), `DELETE admin/offices/{id}` | `office.manage` |
| Tulong pages | `GET services` (public, cursor), `GET services/{slug}` | `POST admin/services`, `PATCH admin/services/{id}` (JSON), `POST admin/services/{id}/media` (form), `DELETE admin/services/{id}` | `service.manage` |
| Hotlines | `GET admin/hotlines` (whole, capped) | `POST`, `PATCH {id}`, `DELETE {id}` under `admin/hotlines` (JSON) | `hotline.manage` |

The Tulong section also reads the office directory in full (`GET offices`, the picker `DL-168` built)
to name a page's office and offer one.

## The three things to understand first

### 1. Residents see this, and the screen says so first

The page's title block says "Residents see this in the Taytay app" before anything else. Every act on
it changes what every resident reads the next time the app loads: an office leaves the directory, an
emergency number changes, a page leaves the catalogue.

### 2. What an act does is said before the button

Each form lists its consequences between the fields and the button, and the list grows with the
change. The sentences are the domain's — `OFFICE_EFFECTS`, `SERVICE_EFFECTS`, `HOTLINE_EFFECTS` —
read from the backend at `2736e28` (the vendored spec's commit; the modules are unchanged at
`2af2243`), not assumed:

| Act | What the API does |
| --- | --- |
| Add an office | It appears in the app's directory. Its description, head, hours, phone, email, address and map position can be set only now (below). |
| Change an office's address | The app opens the office's page by it; anything that kept the old one stops finding it. |
| Give an office a banner | Replaces the banner on its page; **the server deletes the old image**. A banner cannot be removed — the API has no way to take one away. |
| Delete an office | It leaves the directory. **Refused while anything names it** — a staff account assigned to it, a Balita article, a Tulong page, a conversation — and the refusal does not say which. Nothing brings it back. Its banner stays stored. |
| Hide a Tulong page | It leaves the app's catalogue, but still opens from a link and still shows on the home screen while featured. **It leaves this screen's list too** (below). |
| Feature a Tulong page | It joins the home screen's featured pages, which shows the **six newest**; a seventh pushes the oldest off. |
| Upload a Tulong picture | Applied at once, a separate act; the server deletes the old one. |
| Delete a Tulong page | Deleted with its picture. Nothing refers to a page, so the server never refuses. |
| Change a hotline's number | A resident who taps it calls the new number. The form reads the old and new numbers back, in full, before the button. |
| Make a hotline inactive | It leaves the app's hotline list and home screen, and is kept here. |
| Delete a hotline | Gone for good; the confirmation offers making it inactive instead. |

Every act is audited against the administrator (`office.updated`, `service.deleted`, …) with **no
reason**, so none is asked for. Deletes are reachable only through a confirmation that lists the
effects before its button; a refusal is shown inside it in the server's words.

### 3. A Tulong page is not a programme

A Tulong page is information a resident reads — "Information only. There is no application endpoint",
in the API's own words. Its `eligibility` is a paragraph, not a rule. The console's programmes carry
weighted guidelines, a responsibility and a funding holder (`DL-65`, `DL-66`). The two never share a
type, a port or a screen (`DL-164`), and `check:directory` fails the build if the directory names a
programme type or the programmes module names a Tulong one.

## Images

Banners and pictures are chosen through `ImageFileField` (`shared/media`), the only file input in any
feature. It holds a file to `APP_IMAGE_POLICY` **as the server does** — five megabytes, and JPEG, PNG
or WebP recognised by the file's first bytes rather than its name (`src/modules/media/images.ts`) —
and refuses before anything is sent, in an alert that says what to do. An accepted file is previewed
from an object URL made by `ObjectUrls` and given back when the choice changes or the field goes.

Uploads travel as `multipart/form-data` through `ApiClient.postForm`/`patchForm`, the console's first
form bodies. The contract checks learned them: `check:wire-adoption` now holds a form helper to a
form route and a JSON helper to a JSON one, and reads a `toWire…` mapper's `…Wire` interface to hold
its keys to the operation — a mapper is no longer taken on trust.

No model carries an image address, no mapper reads `hero_url`, and no directory template draws an
`<img>`: the banner's bytes live at a public route on the API's host, and a template bound to that
address would load from another origin behind the console's image policy. A picture is said as
present or absent.

## What cannot be done here, and why

- **An office's description, head, hours, phone, email, address and map position after creation.**
  The published `OfficePatch` declares four fields — name, address, short name, category — and the
  console sends only what the contract declares (`check:wire-adoption`). The backend's handler
  accepts the rest; the spec does not say so. Backend item.
- **Clearing an office's short name or category.** A change travels as a form, which cannot say
  "none", and the server refuses an empty value. The form keeps what was there and says so.
- **Removing a banner.** The API has no way.
- **A Tulong page's address, category, who it is for, places and office after creation.** Same as
  offices: `ServicePatch` does not declare them, though the handler accepts them.
- **Listing a hidden page.** `GET services` leaves out a page hidden from the catalogue unless it is
  featured, and there is no admin list. The section says so and offers **Open a page by its
  address** (`GET services/{slug}`, which answers hidden pages), and hiding a page says beforehand
  that it will leave this list.
- **Featuring a page as it is created.** The create schema is strict and refuses `featured`; the
  form offers it once the page exists, as it does the picture.

## The lists

Offices and Tulong pages are browsed a page at a time, newest first as the server sends them, with
"more are available", never "page 1 of N" (`DL-161`). A record the mapper cannot read refuses the page
rather than dropping out of it; a Tulong page with one contact of a kind the console does not know is
unreadable rather than shorter, because a save sends the list back and would delete the contact.
Hotlines come whole, in the app's order, **capped at a hundred with no word of more**: a list that
long says it may be missing lines, to this screen and the app alike.

## Access

`office.manage`, `service.manage` and `hotline.manage` are the API's own keys, added to `PERMISSIONS`
unchanged (`DL-122`). The API grants them to `admin` alone; here the system administrator holds them
by holding every key, and no role names them. All three are mutating. The route opens for any of the
three, as the menu entry does; each section is offered only to its own key. None of that is the
protection: the API refuses anybody else.

## Checks

`check:directory` (in `verify`): the title says residents see it; effects before each form's button
and the picture's upload; deletes only through the confirmation, which lists the effects first; the
effects still say what somebody would regret not being told; no programme type in the directory and
no Tulong type in programmes; no image address on a model, in a mapper or a template; no feature file
input but the shared field, which refuses first; the API's image policy; a capped hotline list said
so; nothing logged or stored; the three keys the administrator's. Twenty-six planted regressions,
each caught, every file restored byte for byte.

## Known gaps

- The spec's `OfficePatch` and `ServicePatch` under-declare what the handlers accept; a hidden page has
  no admin list; the hotline list is capped silently; an office's delete refusal does not say what
  names it; a deleted office's banner is never removed from storage. All in
  `docs/integration/node-api-migration.md`.
- **Not run against a live API.** Built and tested against the vendored spec and composed fixtures.
