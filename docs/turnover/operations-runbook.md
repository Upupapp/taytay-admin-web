# Operations runbook

Every command here is copied from a document in the repositories, and each section names its
source. Most come from `taytay-backend/deploy/staging-shared-linode/README.md` (the "staging
README"), which since backend commit `9f42f49` (7 November 2026) holds every staging procedure
this runbook uses. Where a step has not been rehearsed, the runbook says so. What is still missing
is listed at the end, and closing it is work for the developer before production.

**This runbook is for staging.** Production does not exist yet, and its written runbook,
`taytay-backend/docs/deploy-linode.md`, describes a different setup (systemd or pm2 and nginx
rather than Docker and Caddy); see [environments-and-hosting.md](environments-and-hosting.md).

## Before you touch the server

- **The server is shared** with three other systems. Work only inside `/opt/taytay` and on the
  compose project `taytay` (run `docker compose` only from `/opt/taytay`), apart from Taytay's own
  cron file and backup log. Never restart the shared Caddy (`ebpco-caddy-1`) or any container that
  is not `taytay-…`, and never run server-wide Docker commands such as `docker system prune`.
- The commands reach the server through the SSH alias `ebpco-linode`, which exists only on a
  machine that holds the server's SSH key (staging README: "on a machine with the ebpco-linode SSH
  key").
- **Never print, copy or paste** `.env`, `.env.api` or `secrets/firebase-adminsdk.json`. Do not
  `cat` them, and do not send them through chat or e-mail.
- Staging holds **test data only**. Do not restore or load real residents' data into it.
- Record the commit hash of everything you deploy, with the date and your name. Nothing on the
  server records it for you.

## 1. Check health

Sources: `taytay-backend/README.md`, `taytay-backend/docs/deploy-linode.md`, staging README
("Check health and status").

```bash
curl https://taytay-api.139-162-51-165.sslip.io/api/v1/health
curl https://taytay-api.139-162-51-165.sslip.io/docs
ssh ebpco-linode 'cd /opt/taytay && docker compose ps'
```

`/api/v1/health` is a **liveness probe only**. It says the API process answers; it does not
connect to PostgreSQL, Firebase or file storage. A healthy answer does not prove the database
works. To check the whole path, sign in to the staff console at
https://taytay.139-162-51-165.sslip.io and open a list, for example Residents. `GET /docs` returns
the OpenAPI document itself.

Every API response carries an `X-Request-Id` header, and every error body carries the same value
as `request_id`. Quote it in a defect report: it is how the matching log line is found.

## 2. Redeploy the API

Source: staging README, "Redeploy the API". Run from a checkout of `taytay-backend` at the commit
you mean to deploy, after `npm test`, `npm run typecheck` and `npm run build` pass.

```bash
# 1. a dump taken just before the deploy, in case the release must be undone
ssh ebpco-linode '/opt/taytay/backup.sh'
# 2. copy the committed tree (git archive ignores anything uncommitted)
git archive HEAD | ssh ebpco-linode 'rm -rf /opt/taytay/backend.new && mkdir /opt/taytay/backend.new && tar -x -C /opt/taytay/backend.new'
# 3. keep the staging Dockerfile, keep the old tree as backend.prev, rebuild only taytay-api
ssh ebpco-linode 'cd /opt/taytay && cp backend/Dockerfile backend/.dockerignore backend.new/ && rm -rf backend.prev && mv backend backend.prev && mv backend.new backend && docker compose up -d --build taytay-api'
```

The first command takes a backup. The second copies the committed files to a new folder. The third
keeps the staging Dockerfile, keeps the replaced tree as `backend.prev` for a rollback (section 5),
and rebuilds and restarts only the `taytay-api` container. Then check health (section 1) and read
the start-up log (section 9).

## 3. Database migrations

Sources: `taytay-backend/deploy/staging-shared-linode/Dockerfile` and README;
`taytay-backend/docs/deploy-linode.md`.

- **On staging, migrations run every time the API container starts.** The container's command is
  `npm run migrate && exec node dist/server.js`. A new file in `migrations/` is applied by the
  redeploy in section 2; there is nothing extra to run.
- The runner applies, in order, each SQL file not yet recorded as applied. **There is no "down"
  step**: a migration cannot be undone by the runner. Undoing one means restoring a backup taken
  before it (section 6).
- **In production** (per `docs/deploy-linode.md`), migrations are applied before the first boot
  and on each release that adds a migration file:

  ```bash
  cd /opt/lguids
  set -a
  . ./.env
  set +a
  npm run migrate:prod
  ```

- `npm run seed` (barangays, offices, sample programmes and sample document types) was run once on
  staging, on 2026-11-05: `docker compose exec taytay-api npm run seed`. It refuses production.
  Running it again on staging adds sample document types, each named "(sample)", which are not an
  office's catalogue.
- The five barangays do not need the seed any more: migration `0039_taytay_barangays` inserts them
  as reference data in every database, production included (PSA PSGC 0405813001–0405813005), and
  leaves staging's seeded rows as they are (`DL-188`).

## 4. Redeploy the staff console

Source: staging README, "Deploy the console" and "The console's style nonce".

1. In `taytay-admin-web`, at the commit you mean to deploy, run `npm run verify`. It must pass.
2. Build for staging, then copy, stamp and swap in one command:

   ```bash
   npx ng build --configuration staging
   cd dist/taytay-social-welfare/browser
   tar -cf - . | ssh ebpco-linode 'cd /opt/taytay && rm -rf console.new && mkdir console.new && tar -x -C console.new \
     && sed -i "s#<app-root>#<app-root ngCspNonce=\"{{placeholder \`http.request.uuid\`}}\">#" console.new/index.html \
     && grep -c ngCspNonce console.new/index.html \
     && rm -rf console.prev && mv console console.prev && mv console.new console \
     && docker compose restart taytay-console'
   ```

   The new build is unpacked beside the live one and the style nonce is stamped into its
   `index.html`. Without the nonce the console loads unstyled, because its content-security policy
   allows no inline styles (`DL-172`). The `grep` must print `1`, or the chain stops before the
   swap. The old build stays as `console.prev` for a rollback. The restart is needed because the
   container keeps serving the folder it mounted at start.

3. Open https://taytay.139-162-51-165.sslip.io, sign in, and open one list.

## 5. Roll back

Sources: staging README, "Roll back"; `docs/integration/rollback.md` (who decides, what a rollback
does not fix). **Not yet rehearsed or timed** (launch gate line 18). Reverse the deploy first, then
investigate.

Each deploy keeps the build it replaced, one level deep. Swapping keeps the faulty build in `.prev`
so it can be examined or put back.

```bash
# console: swap, check the nonce, restart only the console
ssh ebpco-linode 'cd /opt/taytay && test -d console.prev && mv console console.bad && mv console.prev console && mv console.bad console.prev && grep -c ngCspNonce console/index.html && docker compose restart taytay-console'
# API: swap and rebuild only taytay-api
ssh ebpco-linode 'cd /opt/taytay && test -d backend.prev && mv backend backend.bad && mv backend.prev backend && mv backend.bad backend.prev && docker compose up -d --build taytay-api'
```

- **Console.** Static files with no data of its own; the swap is the whole rollback. Rolling back
  the console never fixes a fault in the API.
- **API.** The database keeps whatever the newer release did to it (there is no "down" step). If
  that release added a migration and the older code cannot run against it, the remaining route is
  the disaster-recovery restore of the dump taken just before the deploy (section 6), which
  **loses everything written since that dump**. Decide that with the owner.
- **Further back than one deploy:** redeploy an older commit with section 2 or 4.
- Nothing on the server records which commit each folder holds, so record every deploy.

**Production rollback is to be written when production exists**; its host is not chosen (GL-14).

## 6. Backups and a restore test

Source: staging README, "Backups". The script and its cron file are in the backend repository,
`deploy/staging-shared-linode/backup.sh` and `taytay-backup.cron`, exactly as installed.

- The database is dumped **every night at 02:17 Manila time** (18:17 UTC) by
  `/etc/cron.d/taytay-backup`, which runs `/opt/taytay/backup.sh`.
- Each run writes a compressed `pg_dump --clean --if-exists --no-owner` to
  `/opt/taytay/backups/taytay-<UTC time>.sql.gz` (mode 600), checks the gzip, deletes dumps older
  than **seven days**, and logs one line to `/var/log/taytay-backup.log`. It touches nothing
  outside `/opt/taytay`.
- The first dump and a test restore **into a scratch database** were made on 2026-11-06.
- The dumps are on the same server as the database. They protect against a bad migration or a
  mistaken delete, not against losing the server. Production needs backups off the machine
  (GL-5).

**Test a restore** (safe: a throwaway database inside the `taytay-postgres` container; the live
database is not read or written and the API keeps running):

```bash
ssh ebpco-linode 'cd /opt/taytay && f=$(ls -t backups/taytay-*.sql.gz | head -1) && echo "dump: $f" \
  && docker compose exec -T taytay-postgres dropdb -U taytay --if-exists taytay_restore_check \
  && docker compose exec -T taytay-postgres createdb -U taytay taytay_restore_check \
  && s=$(date +%s) \
  && zcat "$f" | docker compose exec -T taytay-postgres psql -U taytay -d taytay_restore_check -q -v ON_ERROR_STOP=1 >/dev/null \
  && echo "loaded in $(( $(date +%s) - s )) s" \
  && for t in schema_migrations users barangays offices audit_log; do printf "%s: " "$t"; docker compose exec -T taytay-postgres psql -U taytay -d taytay_restore_check -tAc "SELECT count(*) FROM $t"; done; \
  docker compose exec -T taytay-postgres dropdb -U taytay taytay_restore_check && echo "scratch database dropped"'
```

A pass: "loaded" is printed, `schema_migrations` equals the number of files in `migrations/` at the
deployed commit, the other counts are plausible, and the scratch database is dropped. Write down
the date, the dump's name, the load time and the counts: they are the observed figures launch gate
line 18 asks for. Repeat it before go-live.

**Restore into the live database: disaster recovery only.** It loads a dump over the live staging
database and **loses everything written since that dump**. Decide it with the owner, take a fresh
dump first (`ssh ebpco-linode /opt/taytay/backup.sh`) so the restore can itself be undone, and pick
the file by its time:

```bash
ssh ebpco-linode 'cd /opt/taytay && docker compose stop taytay-api \
  && zcat backups/<file>.sql.gz | docker compose exec -T taytay-postgres psql -U taytay -d taytay -v ON_ERROR_STOP=1 \
  && docker compose start taytay-api'
```

The dump drops and recreates what it contains. Tables a later migration added are not in it and
stay, so restore together with the code of the dump's date (roll back the API first, section 5).

## 7. Rotate the Firebase service-account key

Source: staging README, "Rotate the Firebase service-account key". **Not yet rehearsed.**

The API uses a Firebase Admin SDK key (a JSON file) to verify sign-in tokens and to update
accounts. On staging it is `/opt/taytay/secrets/firebase-adminsdk.json` (mode 600, owner root),
mounted read-only into the `taytay-api` container at `/run/secrets/firebase-adminsdk.json`.

1. A person with owner access to the Firebase project creates a new key in the Firebase console:
   **Project settings → Service accounts → Generate new private key**. Do not open, e-mail, chat or
   commit the downloaded file.
2. Put it on the server beside the current key, created mode 600, then swap and restart only the
   API. The old file is kept as `.old` until the new one is proven:

   ```bash
   ssh ebpco-linode 'umask 077 && cat > /opt/taytay/secrets/firebase-adminsdk.json.new' < /path/to/downloaded-key.json
   ssh ebpco-linode 'cd /opt/taytay/secrets && mv firebase-adminsdk.json firebase-adminsdk.json.old && mv firebase-adminsdk.json.new firebase-adminsdk.json && cd /opt/taytay && docker compose restart taytay-api'
   ```

3. Check health (section 1), read the start-up log for a credentials error (section 9), then sign
   in to the console and open a list: signing in is what exercises the key.
4. If anything fails, move `firebase-adminsdk.json.old` back the same way and restart
   `taytay-api`.
5. Once it works, delete the old key where it was issued: Google Cloud console → IAM & Admin →
   Service accounts → `firebase-adminsdk-…` → Keys → delete the older key. Then remove the old file
   (`ssh ebpco-linode 'rm /opt/taytay/secrets/firebase-adminsdk.json.old'`), the downloaded copy,
   and every other copy of the old key, including the one kept on the owner's PC (register row 3).
   Record the date in the register.

In production, the key may instead be given as `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`
in the environment file (`docs/deploy-linode.md`); the same steps apply to those values.

### The database password and the digital-ID signing key

Source: staging README, "Rotate the database password" and "Rotate the digital-ID signing key", which
hold the commands. **Neither is rehearsed yet.** Both keep the value in one shell on the server and
never print it.

- **Database password.** The live password is the `taytay` role's, inside the database: the
  `POSTGRES_PASSWORD` in `/opt/taytay/.env` is read by the `postgres` image only when its volume is
  first created. So the role is changed with `ALTER ROLE`, then `.env` and the `DATABASE_URL` in
  `.env.api` are rewritten, and `taytay-api` is recreated (a plain `restart` keeps the old
  environment). Backups and every `psql` command use the container's local socket and are not
  affected.
- **Digital-ID signing key** (`DIGITAL_ID_SIGNING_KEY` in `.env.api`). Rotating it **does not
  invalidate issued cards**: a card is a database row, and its QR code is signed afresh each time the
  app opens the card and lasts two minutes. Only a code already on a screen at the restart is
  refused as "not valid"; the resident reopens the card. Without the variable (staging runs in
  development mode), the API makes a new random key at every start, so every restart already
  rotates it; production refuses to start without one.

## 8. Create the first administrator

Source: staging README, "Create the first administrator". It is go-live item GL-13 and requirement
FR-API-7, closed by a committed command (`DL-188`): **`npm run admin:grant -- --email …`**, in
`taytay-backend` `src/ops/`. Rehearsed on staging on 7 November 2026 (backend `a7a1884`): run twice for the existing administrator, it answered "granted administrator to …" both times and changed nothing the second time; for an address with no Firebase account it refused and said why. **The owner signs this rehearsal off before it is run in production.**

**How it works.** It runs inside `taytay-api`, where the Firebase key already is, so the key never
leaves the server. It finds the Firebase account by its e-mail and refuses when there is none, when
it is disabled, or when its API account was closed. Otherwise it creates the user row the account's
first sign-in would create, as `admin`, or raises an existing row to `admin` the way the role
route does (an office role is cleared and recorded; a current digital ID is revoked). It writes one
audit row, which the console's audit trail shows as "Made an account an administrator, by the
bootstrap command run on the server", with no account as actor. It prints one line and never a
token or key. Running it twice changes nothing the second time. Order no longer matters: the person
may have signed in before or not.

1. The person has a Firebase account: they sign up, or Firebase console → Authentication → Users →
   **Add user**, with their work e-mail and a throwaway password.
2. `ssh ebpco-linode 'cd /opt/taytay && docker compose exec -T taytay-api npm run --silent admin:grant -- --email person@example.gov.ph'`
   prints `granted administrator to person@example.gov.ph`, or `refused: …` and why.
3. If step 1 used **Add user**: Firebase console → the user's menu → **Reset password**, so the
   person sets their own password.
4. The person signs in to the console, which shows **Users and roles**.

There is **no `admin:revoke`**, on purpose: an administrator is demoted in the console by another
administrator, audited under that person's name. If the only administrator is unavailable or
compromised: disable the account in the Firebase console (it stops working on its next call), grant
a new administrator with `admin:grant`, and demote the old account in the console.

Once one administrator exists, every other role is given in the console under **Users and roles**
(`/users`), which calls `PATCH /api/v1/admin/users/{id}/role`: admin only, never on one's own
account, and recorded in the app's audit trail. An office role (intake officer, social worker and
so on) is given there too, with the account's office. There is **no invite or password-reset
form** in the console, by design: accounts are provisioned by an administrator outside the console
(`DL-32`).

**Production** has no Firebase project or host yet, and its recipe (`docs/deploy-linode.md`) runs
the API without Docker; the same command runs there where the API runs, once the staging rehearsal
is signed off.

### Staff sign-in accounts: add one, reset a password, close one when someone leaves

The sign-in accounts live in the Firebase console (Authentication → Users), not in the staff
console. Whoever holds the Firebase project does these steps; the role is always given in the staff
console afterwards.

- **A new staff member.** Firebase console → Authentication → Users → **Add user**, with their work
  e-mail and a throwaway password. Then the user's menu → **Reset password**, so they set their own.
  When they have signed in once, an administrator gives the role and office in **Users and roles**.
- **A forgotten password.** Firebase console → the user's menu → **Reset password**. Firebase sends
  the person a link to set a new one. Nobody else learns the password.
- **Someone leaves.** In the staff console, change their account to "Resident" (this clears the
  office role and is recorded). Then Firebase console → the user's menu → **Disable account**. A
  disabled account stops working at its next call. Disable rather than delete, so the audit trail
  still names a real account.

## 9. Read the logs

Source: staging README, "Read the API logs".

```bash
# the API: the last 100 lines
ssh ebpco-linode 'cd /opt/taytay && docker compose logs --tail 100 taytay-api'
# one request, by the X-Request-Id / request_id a user quoted
ssh ebpco-linode 'cd /opt/taytay && docker compose logs --since 24h taytay-api | grep -F "REQUEST-ID"'
# the console's static server, and the nightly backups
ssh ebpco-linode 'cd /opt/taytay && docker compose logs --tail 50 taytay-console'
ssh ebpco-linode 'tail -n 7 /var/log/taytay-backup.log'
```

- **API.** Structured logs (pino), passed through a redaction step (`src/logging/redact.ts`) that
  strips tokens, passwords, government identifiers and full addresses. Quote the request id in a
  defect report rather than copying log lines.
- **Console.** The console logs detail to the browser console in development only; staff see a
  plain message (console `CLAUDE.md` §6).

## 10. When the API is down

1. **Confirm it.** Run the health check in section 1. If it fails, the API process is not
   answering. If it answers but the console fails, the fault may be in the database, Firebase or
   the console; check by signing in and opening a list.
2. **Tell staff what was saved.** The console queues nothing and retries nothing in the
   background. A send that failed says so, and anything that did not show as saved **was not
   saved** and has to be entered again (`DL-87`, `DL-118`). The console's connection banner
   watches the computer's own network connection, not the API, so it may not appear when only the
   API is down.
3. **If it started after a deploy**, roll back (section 5) and investigate afterwards.
4. **If the container has stopped**, start it with the documented command, then check health:

   ```bash
   ssh ebpco-linode 'cd /opt/taytay && docker compose start taytay-api'
   ```

   A redeploy (section 2) also rebuilds and restarts it.

5. **If data is lost or damaged**, stop and decide with the owner before restoring (section 6):
   a restore loses everything written since the dump.
6. **Do not** restart the shared Caddy or any other project's container, and do not change the
   CORS settings to "make it work" (console `CLAUDE.md` §2, rule 5).
7. Record what happened, when, what was done, and the request ids involved. For production,
   `docs/integration/launch-runbook.md` sets out abort criteria agreed in advance.

Who is called, and how fast, is not set by any document in the repositories:

| Role during an outage | Name and contact      |
| --------------------- | --------------------- |
| First responder       | ________ per contract |
| Decides on a rollback | ________ per contract |
| Informs the office    | ________ per contract |

If personal data may have been exposed, it is not only an outage. Tell the Data Privacy Officer
at once. The breach procedure is go-live item GL-16 and is not written yet.

## Gaps in the written procedures

Closed on 7 November 2026 (backend `9f42f49`): the console copy command, the staging rollback, the
backup script and cron file in the repository, the restore-test commands, the log commands, the
Firebase key rotation and the staging first-administrator steps. Closed by `DL-188` (backend
production-readiness round): a committed first-administrator command (GL-13), and the rotation of the
database password and the digital-ID signing key. Still open:

| Gap                                                                         | Where it belongs                        |
| --------------------------------------------------------------------------- | --------------------------------------- |
| Rollback, restore and key rotation not rehearsed or timed                   | Staging, then launch gate line 18       |
| `npm run admin:grant` rehearsed on staging 7 Nov 2026; owner sign-off due   | Owner (GL-13)                           |
| Database-password rotation for the managed production database not detailed | `docs/deploy-linode.md`, when it exists |
| Backups only on the same server                                             | GL-5                                    |
| No production runbook for the chosen host (GL-14), including its rollback   | When production exists                  |
| No breach procedure (GL-16), no alerting to a named person (GL-12)          | LGU, with the developer                 |
