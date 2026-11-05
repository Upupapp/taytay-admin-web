# Home screen

The first screen every resident opens in the Taytay app: its **banners** and **quick links**, kept
here, and **what the app is given now** beside them. Built on what the Node API serves (`DL-164`,
`DL-170`), admin only on the server (`home.manage`):

| | Reads | Writes |
| --- | --- | --- |
| Banners | `GET admin/home/banners` (every banner, shown and hidden, whole) | `POST`, `PATCH {id}`, `DELETE {id}` under `admin/home/banners` (JSON); the image stored first through `POST media` (a form) |
| Banner images | `GET media/{id}/content` (bytes, bearer in a header) | — |
| Quick links | `GET admin/home/links` (whole) | `POST`, `PATCH {id}`, `DELETE {id}` under `admin/home/links` (JSON) |
| Preview | `GET home` (public) | — |

## The things to understand first

### 1. Residents see this, and the screen says so first

"Residents see this in the Taytay app" is the page's subtitle. A save in either list reads the
preview again, so "what the app shows now" is always the server's answer after the change, never the
form's idea of it.

### 2. A banner's image has no description, and the screen says so rather than asking for one

A banner is a picture, and a resident who cannot see it is owed words for it (`DL-125`). The API keeps
none: `home_banners` stores a title, an image, a link, an order and whether it is shown
(`migrations/0008_home.sql`), and the spec's `Banner` and `BannerWrite` have no other field. A box
the console filled and the server dropped would be a description somebody believes residents hear,
so there is none: the banners section and the banner form both say **the app has no description of a
banner's image to give, because the API keeps none**, and the gap is a backend item. `check:home`
fails the build if a description field, a mapper read, a body key or a free-text box for one appears.

### 3. What an act does, before the button

`HOME_EFFECTS`, read from the backend at `2736e28` (`src/modules/home/routes.ts` and
`repository.ts`, `src/modules/media/routes.ts`), between the fields and the button:

| Act | What the API does |
| --- | --- |
| Add a banner, shown | It appears on the home screen among the shown banners, by order then age. |
| Add a banner, hidden | Kept here; shown nowhere until it is shown. |
| Add or replace an image | **Stored first**, then the banner saved naming it. If the banner is refused, the image stays stored, unused — nothing removes it. |
| Replace or remove an image | The banner shows the new one, or none. **The old image stays stored**; nothing removes it. |
| Hide / show a banner | It leaves, or returns to, the home screen; it is kept either way. |
| Delete a banner | Deleted; nothing brings it back; its image stays stored. The confirmation offers hiding instead. |
| Add a link | It appears on the home screen. **Every link is shown**, by order — there is no hidden link, so deleting is the only way to take one off. |
| Any link or banner address | The app opens it when tapped; the API checks only its length, not that it opens anything. |

Every act is audited (`banner.*`, `link.*`) with no reason, so none is asked for. Deletes are
reachable only through a confirmation listing the effects before its button.

## Images

Chosen through the shared `ImageFileField`, which refuses past five megabytes or by the file's first
bytes before anything is sent (`APP_IMAGE_POLICY`, as in the app directory). Shown only as bytes read
through the data layer — the banner form's current image when asked for, the preview's automatically,
since a banner's image is a public picture — from object URLs given back when the form changes banner,
the preview is read again, or the page is left. The model holds the image's id, never the
`image_url` address the API also sends.

## The preview

`GET home` as the app is given it: shown banners in order with their images, every link, the names of
the featured Tulong pages (the app shows the six newest), and how many hotlines and Balita articles it
carries. Names and counts only — an article's or a page's words are not read, because a preview says
what is there; the Balita and Tulong screens are where the words live. A home screen with a banner the
mapper cannot read is not previewed rather than previewed without it.

## Access

`home.manage` is the API's own key, added to `PERMISSIONS` unchanged (`DL-122`): the administrator's
alone, held by holding every key, named by no role, mutating. The route and the menu entry ask for it.

## Checks

`check:home` (in `verify`): the title says residents see it; effects before each form's button;
deletes only through the confirmation, effects before its button; the effects still say an image
outlives what replaces or deletes it and offer hiding before deleting; no description invented, read,
sent or collected, and the absence said on both screens; images bound only from template variables,
held by `ObjectUrls` and given back on destroy; nothing logged or stored; the key the administrator's.
Eighteen planted regressions, each caught, every file restored byte for byte.

## Known gaps

- **No description of a banner's image** on the API. Backend item.
- **Images are never removed from storage** — not when a banner's image is replaced or removed, not
  when a banner is deleted, not when an upload is left unused because the banner was refused.
- **The spec's `PATCH admin/home/banners/{id}` body is `BannerWrite`, which requires `title`**, while
  the handler takes a partial body; the console sends the title on every change, which both accept.
  `LinkWrite` declares nothing required, while the handler requires `label` and `href` on a create;
  the console always sends both.
- **Not run against a live API.** Built and tested against the vendored spec and composed fixtures.
