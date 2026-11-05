# Users and roles

Every account in the residents' app — residents and staff alike, because on the Node API they are
one kind of account with a role — and the administrator deciding who among them is staff, and which
office a staff account answers for. Built on what the API serves (`DL-164`, `DL-168`):
`GET admin/users`, `PATCH admin/users/{id}/role`, `PATCH admin/users/{id}/office`, and the office
directory (`GET offices`). The spec has no read of one account.

## The two things to understand first

### 1. Most rows are residents, so the screen shows the minimum

A screen for deciding who is staff needs to tell accounts apart and nothing more: **name, email, role
and office.** The API also sends each account's mobile number and home barangay; neither is mapped,
so no template can reach them (CLAUDE.md §6.1). It omits birth dates and addresses itself. The screen
says what it leaves out. An account with no name — not given, or cleared when it was closed — says
"No name given", never a blank.

### 2. A change says what the server does, before the button

Choosing a role shows what the server does on that change, then the button that names the role it
changes to. The sentences are `ROLE_CHANGE_EFFECTS` and `ROLE_CHANGE_ALWAYS`, in the domain, read
from the backend at `2736e28` (`changeUserRole` and its handler, `UserRepository.changeRole`,
`auth/capabilities.ts`, `auth/resolve-user.ts`):

| Changed to | What the API does |
| --- | --- |
| Resident (`registered`) | Marks the account unverified; revokes any digital ID; the account can no longer use this console |
| Verified resident (`verified`) | Marks it verified **now, without an ID review**; issues no digital ID; no console |
| Staff (`staff`) | Console access as staff; the office inbox and news only once assigned an office; verification status unchanged; revokes any digital ID |
| Administrator (`admin`) | Console access with every capability, every office's conversations; verification status unchanged; revokes any digital ID |
| Always | Applies at that person's next request (the database role replaces the token's) — an open console or app keeps showing what it showed until reloaded, but the server refuses what the new role does not allow. The office link is kept, unused, when an account stops being staff. The server audits the change and **keeps no reason**, so none is asked for. |

An office is the same: linking a staff account to an office gives it that office's inbox and news
from its next request, and only that office's; clearing the link closes both, and when the person
next signs in the console tells them they are not assigned (`DL-168` part 1). Staff only — the
server refuses an office for any other role, so the picker is offered only for staff, and a leftover
link on a non-staff account is shown as unused.

## What is not offered

- **One's own role.** The server refuses it whoever asks; the panel says another administrator can
  make the change, rather than offering a button certain to be refused.
- **A reason box.** Both changes are audited against the administrator's account with no reason; a
  box whose words go nowhere is a record somebody believes exists.
- **A record by address.** The API cannot read one account, so an account is managed in a drawer
  beside the list, as an ID review is, and after a change the list is read again rather than patched.
- **Search or a role filter.** The API's list takes a cursor and nothing else; a filter the console
  applied to one page would hide matches on the pages it has not read.

## The list

Newest accounts first, as the server sends them; a page at a time with "more are available", never
"page 1 of N" (`DL-161`). An account whose role is outside the four the API lets an administrator give
— the spec types it as a bare string — refuses the page rather than dropping out of it. Offices are
named from the directory, read in full; if it cannot be read, offices show by their identifier, none
can be assigned, and the screen says why.

## Access

`user.view`, `user.change-role` and `user.assign-office` are the API's own keys, added to
`PERMISSIONS` unchanged (`DL-122`). The API grants them to `admin` alone; here the system administrator
holds them by holding every key, and no role names them — in the mock either. `user.view` reads; the
other two change who may use this console and are mutating. The route asks for `user.view` and the
menu entry mirrors it; the panel offers each change only to its own key. None of that is the
protection: the API refuses anybody else.

## Checks

`check:accounts` (in `verify`) holds the module to the above: no mobile, barangay, birth date,
address or verification status on the model, in the mapper or in a template; no `console` or storage;
each change's effects between its choice and its one button; the port and the adapter carrying the
change and nothing else, no free text in the panel, the effects saying no reason is kept; a demotion
saying the digital ID is revoked and `verified` saying it skips the ID review; one's own role checked
before the form and in the method; the three keys the administrator's alone, the changes mutating,
the route and the menu asking for `user.view`. Twenty-one planted regressions, each caught.

## Known gaps

- **No search.** Finding one account means paging; the API has no query for it.
- **No account detail.** No `GET admin/users/{id}`, so nothing beyond the list's fields can be shown —
  which is also why the ID review cannot name the account it reviews (owner decision 7 in
  `node-api-migration.md`).
- **Closed accounts are listed like any other.** The list item carries no `closed` flag.
- **Not run against a live API.** Built and tested against the vendored spec and composed fixtures.
