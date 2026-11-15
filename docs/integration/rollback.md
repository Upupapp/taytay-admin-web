# Rollback — console and API on staging

TAB 12 step 6: _"Plan the rollback. The console is a static bundle; the fast reversal is
redeploying the previous build. Record the exact steps, the person who may take the decision, and
the maximum time to execute."_

This file describes **staging**, the only environment that exists: the shared Linode set up on
5 November 2026 (taytay-backend `deploy/staging-shared-linode/README.md`). **Production rollback is
to be written when production exists.** Its host is not chosen yet (requirements GL-14: Linode with
Caddy as on staging, or Netlify), and its steps are written and rehearsed once it is. Until 7
November 2026 this file described a hosting dashboard's "Publish deploy" button; that applies only
if Netlify is chosen.

## What makes the console cheap to roll back

The console is **a static bundle with no server state**. It runs no migrations, holds no sessions
of its own, and writes nothing it would have to undo. Rolling it back is serving an older set of
files — which is why the answer to almost every console incident is _reverse the deploy first, then
investigate_, rather than diagnosing under pressure.

**The API is not like this.** A backend rollback may meet data written under the newer version and
a database structure the older code does not expect. Its steps are below, with that caveat.

## Who decides

|                   |                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **May decide**    | The MSWDO head, or the officer holding the deployment account.                                                                         |
| **May execute**   | Anyone holding the SSH key for the staging server (alias `ebpco-linode`).                                                              |
| **Does not need** | A meeting. Reversing a static deploy is not a decision that improves with discussion — the previous build was working ten minutes ago. |

The decision to roll **forward** instead — to fix and redeploy — needs the same person, and should
be taken only when the fault is understood. "We think we know what it is" is a reason to roll back
and then find out.

## What the server keeps

Each staging deploy keeps the build it replaced, one level deep:

- `/opt/taytay/console.prev` — the previous console files, nonce already stamped into its
  `index.html`.
- `/opt/taytay/backend.prev` — the previous API source tree (a `git archive` plus the staging
  Dockerfile). The image is rebuilt from it on rollback.

Nothing on the server records which commit either folder holds, so record the commit with every
deploy. To go back further than one deploy, redeploy an older commit with the normal deploy steps
from a checkout of that commit.

**The server is shared.** Every command below works inside `/opt/taytay` and on the compose project
`taytay` only. Never restart the shared Caddy (`ebpco-caddy-1`) or any container that is not
`taytay-…`.

## Steps — console

1. Swap the folders, keeping the faulty build as `console.prev` so it can be examined or restored,
   then restart only the console container. The restart is needed: the container mounts the folder
   it found at start-up, and keeps serving the renamed one until it restarts.

   ```bash
   ssh ebpco-linode 'cd /opt/taytay && test -d console.prev \
     && mv console console.bad && mv console.prev console && mv console.bad console.prev \
     && grep -c ngCspNonce console/index.html && docker compose restart taytay-console'
   ```

   The `grep` must print `1`. If it prints `0`, stamp the nonce (staging README, "Deploy the
   console").

2. Hard-reload https://taytay.139-162-51-165.sslip.io and confirm the build you expected.
3. Confirm sign-in works and one list screen loads.

**Measured 2026-11-15: the other build was served about 2.5 seconds after step 1 started** (2.4 s
and 2.9 s in two runs). The rest of the five minutes is steps 2–3, the person checking.

`index.html` is served `no-store` (`console.Caddyfile`), so the next request after the swap gets the
old bundle — there is no cache to wait out. That header is load-bearing for the rollback, not only
for freshness: with a cached `index.html`, a rollback would reach only the browsers that happened to
revalidate.

## Steps — API

1. **Decide first whether the faulty release changed the database.** Compare the `migrations/`
   folder of the two commits. The migration runner has no "down" step.
2. Swap the source folders and rebuild only `taytay-api`:

   ```bash
   ssh ebpco-linode 'cd /opt/taytay && test -d backend.prev \
     && mv backend backend.bad && mv backend.prev backend && mv backend.bad backend.prev \
     && docker compose up -d --build taytay-api'
   ```

   The rebuild runs `npm ci` and the TypeScript build on the shared server, so it takes minutes,
   not seconds. Migrations run on start, and do nothing when the older code has fewer files.

3. Check health and the start-up log (staging README, "Read the API logs"), then sign in to the
   console and open one list.
4. **If the older code cannot run against the newer database**, the remaining route is restoring
   the dump taken just before the deploy (the deploy runs `backup.sh` first). That is the
   disaster-recovery restore in the staging README: it **loses everything written since the dump**,
   so it is decided with the owner, not taken as a routine rollback step.

**Measured 2026-11-15:**

- the older API was answering **25 seconds** after step 2 started, and unreachable for about
  **9 seconds** of that, while its container was recreated;
- going forward again took 26 seconds, with about 8 seconds unreachable.

Docker's layer cache still held both images. A cold build, or one after a dependency change, runs
`npm ci` on the shared server and takes minutes.

A console rollback never fixes a fault in the API, and an API
rollback never fixes a fault in the console.

## What a rollback does not fix

- **An API fault, by rolling back the console.** Symptoms that look like the console — blank
  lists, failed saves — are frequently the API, and the difference is visible in the browser's
  network panel before any decision is taken.
- **A configuration fault in the deploy itself.** Rolling back to a build that was _also_ misbuilt
  gets a working-looking console pointing at the wrong API. `check:environments` exists so that
  build never publishes.
- **Data written by the faulty API.** Swapping the code back leaves those rows in place.

## Rehearsed once, 2026-11-15

The command asks for _"a rollback executed once in staging and timed."_ It has now been done, with
the owner's approval:

- staging went back from the live-updates release (console `92ad6a5`, API `52c82cb`) to the one
  before it, then forward again;
- only Taytay's containers were touched, and the database was not restored.

The times are in the steps above, and the full record is in
[`evidence-ledger.md`](./evidence-ledger.md) under 2026-11-15.

What the rehearsal did **not** cover, so a real rollback should not assume it:

- **Nobody signed in.** There were no staging credentials on the machine that ran it. Step 3 of each
  half was replaced by a database read that needs no sign-in (`/api/v1/offices`) and by which build
  each side served (`/api/v1/changes` answers 401 on the newer API and 404 on the older one).
- **A warm build.** Both API images were still in Docker's cache. A cold build, or one after a
  dependency change, takes minutes.
- **A database restore.** The older code ran against the newer database, so step 4 of the API half
  was never needed. The restore is tested separately, into a scratch database, and has not been
  timed (launch gate line 18).

To rehearse again, first confirm the `.prev` folders are there:
`ssh ebpco-linode 'ls -d /opt/taytay/*.prev'`. Each half is the same command run twice.
