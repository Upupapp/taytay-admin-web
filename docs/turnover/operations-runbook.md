# Operations runbook

Every command here is copied from a document in the repositories, and each section names its
source. Where no command is written down anywhere, this runbook says so rather than inventing one.
Those gaps are listed at the end, and closing them is work for the developer before production.

**This runbook is for staging.** Production does not exist yet, and its written runbook,
`taytay-backend/docs/deploy-linode.md`, describes a different setup (systemd or pm2 and nginx
rather than Docker and Caddy); see [environments-and-hosting.md](environments-and-hosting.md).

## Before you touch the server

- **The server is shared** with three other systems. Work only inside `/opt/taytay`, and on the
  Taytay parts listed in [environments-and-hosting.md](environments-and-hosting.md). Never
  restart the shared Caddy (`ebpco-caddy-1`) or any container that is not `taytay-…`.
- The commands reach the server through the SSH alias `ebpco-linode`, which exists only on a
  machine that holds the server's SSH key (staging README: "on a machine with the ebpco-linode SSH
  key").
- **Never print, copy or paste** `.env`, `.env.api` or `secrets/firebase-adminsdk.json`. Do not
  `cat` them, and do not send them through chat or e-mail.
- Staging holds **test data only**. Do not restore or load real residents' data into it.
- Record the commit hash of everything you deploy, with the date and your name. Nothing on the
  server records it for you.

## 1. Check health

Source: `taytay-backend/README.md`, `taytay-backend/docs/deploy-linode.md`.

```bash
curl https://taytay-api.139-162-51-165.sslip.io/api/v1/health
curl https://taytay-api.139-162-51-165.sslip.io/docs
```

`/api/v1/health` is a **liveness probe only**. It says the API process answers; it does not
connect to PostgreSQL, Firebase or file storage. A healthy answer does not prove the database
works. To check the whole path, sign in to the staff console at
https://taytay.139-162-51-165.sslip.io and open a list, for example Residents. `GET /docs` returns
the OpenAPI document itself.

Every API response carries an `X-Request-Id` header, and every error body carries the same value
as `request_id`. Quote it in a defect report: it is how the matching log line is found.

## 2. Redeploy the API

Source: `taytay-backend/deploy/staging-shared-linode/README.md`, "Redeploy". Run from a checkout
of `taytay-backend` at the commit you mean to deploy, after `npm test`, `npm run typecheck` and
`npm run build` pass.

```bash
# from this repo, on a machine with the ebpco-linode SSH key
git archive HEAD | ssh ebpco-linode 'rm -rf /opt/taytay/backend.new && mkdir /opt/taytay/backend.new && tar -x -C /opt/taytay/backend.new'
ssh ebpco-linode 'cd /opt/taytay && cp backend/Dockerfile backend/.dockerignore backend.new/ && rm -rf backend && mv backend.new backend && docker compose up -d --build taytay-api'
```

The first command copies the committed files (only committed files: `git archive` ignores
anything uncommitted) to a new folder. The second keeps the staging Dockerfile, swaps the folders
and rebuilds and restarts only the `taytay-api` container. Then check health (section 1).

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

## 4. Redeploy the staff console

Sources: staging README ("Layout on the server", "The console's style nonce"); `netlify.toml`.

1. In `taytay-admin-web`, at the commit you mean to deploy, run `npm run verify`. It must pass.
2. Build for staging:

   ```bash
   npx ng build --configuration staging
   ```

   The files to upload are in `dist/taytay-social-welfare/browser`.

3. Replace the contents of `/opt/taytay/console` on the server with those files. **No command for
   this copy is written in the repositories.** The `taytay-console` container serves the folder
   read-only, so no restart is described.
4. Stamp the style nonce into the new `index.html`. Without this step the console loads unstyled,
   because its content-security policy allows no inline styles (`DL-172`):

   ```bash
   ssh ebpco-linode "sed -i 's#<app-root>#<app-root ngCspNonce=\"{{placeholder \`http.request.uuid\`}}\">#' /opt/taytay/console/index.html"
   ```

5. Open https://taytay.139-162-51-165.sslip.io, sign in, and open one list.

## 5. Roll back

**No rollback has been rehearsed** on staging (launch gate line 18), and no rollback command for
the staging setup is written in the repositories.

- **Console.** The console is static files with no data of its own, so going back means putting
  the previous build back: build the earlier commit and repeat section 4.
  `docs/integration/rollback.md` sets out the reasoning and who may decide ("reverse the deploy
  first, then investigate"), but its steps are written for a hosting dashboard such as Netlify,
  not for staging's folder on the Linode. Rolling back the console never fixes a fault in the
  API.
- **API.** The documented redeploy archives `HEAD`, so going back to an earlier version means
  running section 2 from a checkout of the earlier commit. If the release being undone added a
  migration, the database keeps the new structure (there is no "down" step); if the older code
  cannot run against it, the remaining route is restoring the backup taken before the release
  (section 6), which **loses everything written since that backup**.
- Before any risky API release, note the name of the latest file in `/opt/taytay/backups/`, so you
  know which dump predates it.

## 6. Backups and a restore test

Source: staging README, "Backups".

- The database is dumped **every night at 02:17 Manila time** (18:17 UTC) by
  `/etc/cron.d/taytay-backup`, which runs `/opt/taytay/backup.sh`.
- Each run writes a compressed `pg_dump` to `/opt/taytay/backups/taytay-<UTC time>.sql.gz`
  (mode 600), checks the gzip, deletes dumps older than **seven days**, and logs one line to
  `/var/log/taytay-backup.log`. It touches nothing outside `/opt/taytay`.
- The first dump and a test restore **into a scratch database** were made on 2026-11-06.

To restore a dump into the staging database:

```bash
ssh ebpco-linode 'cd /opt/taytay && docker compose stop taytay-api \
  && zcat backups/<file>.sql.gz | docker compose exec -T taytay-postgres psql -U taytay -d taytay -v ON_ERROR_STOP=1 \
  && docker compose start taytay-api'
```

Read before using it:

- This command loads the dump into the **live** staging database, `taytay`. It is a recovery
  step, not a test.
- `backup.sh` and the cron file exist only on the server; they are **not in any repository**.
  The `pg_dump` options they use are therefore not recorded, so whether a dump can be loaded over
  a database that still has tables in it is not written down. The commands used for the
  2026-11-06 scratch-database test are not written down either.
- The dumps are on the same server as the database. They protect against a bad migration or a
  mistaken delete, not against losing the server. Production needs backups off the machine
  (GL-5).

A restore test should be repeated before go-live, timed, and written down with its commands
(launch gate line 18: "a backup that has never been restored is a hypothesis").

## 7. Rotate the Firebase service-account key

Sources: `taytay-backend/docs/integration-readiness.md` ("Firebase projects"), staging README
("Layout on the server"), `deploy/staging-shared-linode/docker-compose.yml`. **No rotation
procedure is written in the repositories**; the steps below put the documented pieces together
and have not been rehearsed.

The API uses a Firebase Admin SDK key (a JSON file) to verify sign-in tokens and to update
accounts. On staging it is `/opt/taytay/secrets/firebase-adminsdk.json` (mode 600, owner root),
mounted read-only into the `taytay-api` container at `/run/secrets/firebase-adminsdk.json`.

1. A person with owner access to the Firebase project creates a new key in the Firebase console:
   **Project settings → Service accounts**.
2. Put the new file in place of `/opt/taytay/secrets/firebase-adminsdk.json`, mode 600, owner
   root. **No command for the transfer is documented.** Use a direct, encrypted copy to the server;
   never e-mail, chat, a shared drive or git.
3. Restart the API so it reads the new file, using the stop and start commands from section 6:

   ```bash
   ssh ebpco-linode 'cd /opt/taytay && docker compose stop taytay-api && docker compose start taytay-api'
   ```

4. Sign in to the console to confirm sign-in still works.
5. In the Firebase or Google Cloud console, delete the old key, so a lost copy stops working.
6. Delete any other copy of the old file, including any kept on a personal computer.

In production, the key may instead be given as `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`
in the environment file (`docs/deploy-linode.md`); the same steps apply to those values.

## 8. Create the first administrator

**There is no written procedure yet.** It is go-live item GL-13 and requirement FR-API-7
("Planned"). What the repositories record:

- The API reads a `role` claim on the Firebase token (`registered`, `verified`, `staff` or
  `admin`) and otherwise takes the role from its own database
  (`taytay-backend/docs/integration-readiness.md`).
- There is no provisioning step and no staff-creation endpoint. **The first admin needs a `role`
  custom claim set on the Firebase account before its first sign-in, or a database edit**
  (`docs/integration/node-api-migration.md`, owner question 5).
- Once one administrator exists, every other role is given in the console under **Users and
  roles** (`/users`), which calls `PATCH /api/v1/admin/users/{id}/role`: admin only, never on
  one's own account, and recorded in the app's audit trail. An office role (intake officer,
  social worker and so on) is given there too, with the account's office.
- On staging, the owner's account was made the administrator by setting the custom claim with
  Firebase tooling that is not in any repository.
- There is **no invite or password-reset form** in the console, by design: accounts are
  provisioned by an administrator outside the console (`DL-32`).

Before production, the developer writes this procedure (GL-13), and it is tried once on an empty
database.

## 9. Read the logs

- **API.** The API writes structured logs (pino) to its process output, after passing them
  through a redaction step (`src/logging/redact.ts`) that strips tokens, passwords, government
  identifiers and full addresses. **No command for reading them on staging is written in the
  repositories.** Search for the `X-Request-Id` of the failing request.
- **Backups.** One line per nightly run in `/var/log/taytay-backup.log`.
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

The developer should close these before production:

| Gap                                                                   | Where it belongs                               |
| --------------------------------------------------------------------- | ---------------------------------------------- |
| No command for copying a console build to `/opt/taytay/console`       | Staging README                                 |
| No rollback rehearsed or written for the staging setup                | Staging README; `docs/integration/rollback.md` |
| `backup.sh` and `/etc/cron.d/taytay-backup` are not in the repository | `deploy/staging-shared-linode/`                |
| Restore-test commands (scratch database) not written down             | Staging README, "Backups"                      |
| No command for reading the API's logs or listing container status     | Staging README                                 |
| No key-rotation procedure (Firebase, database password, signing key)  | Staging README; `docs/deploy-linode.md`        |
| No first-administrator procedure (GL-13)                              | `docs/deploy-linode.md`                        |
| No breach procedure (GL-16), no alerting to a named person (GL-12)    | LGU, with the developer                        |
