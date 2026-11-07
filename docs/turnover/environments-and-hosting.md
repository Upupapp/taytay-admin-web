# Environments and hosting

## The four environments

From §6 of the requirements document, brought up to date on 2026-11-07.

|               | local-mock                   | local-api                            | staging                                                           | production                              |
| ------------- | ---------------------------- | ------------------------------------ | ----------------------------------------------------------------- | --------------------------------------- |
| Purpose       | Design and demos on a laptop | Developer testing                    | Office acceptance testing, **test data only** (NFR-PRIV-15)       | Real residents and staff                |
| API           | None (sample data)           | `http://localhost:3000/api/v1`       | https://taytay-api.139-162-51-165.sslip.io/api/v1                 | `api.<approved-domain>`, not chosen     |
| Staff console | `npm start`                  | `ng serve --configuration local-api` | https://taytay.139-162-51-165.sslip.io                            | Not set up; host not decided (GL-14)    |
| Sign-in       | Sample accounts              | Development tokens                   | Firebase project `taytay-lgu-ids-staging`                         | No Firebase project yet                 |
| Database      | None                         | In-memory or Docker PostgreSQL       | PostgreSQL 16 in Docker, nightly dump kept 7 days, restore tested | Managed PostgreSQL with TLS, not set up |
| Files         | None                         | Local folder                         | Docker volume on the server                                       | Private Linode Object Storage bucket    |
| E-mail        | None                         | Not sent                             | Not sent (`EMAIL_SENDER=mock`)                                    | SMTP, sender not chosen                 |
| Server        | Laptop                       | Laptop                               | Shared Linode, 2 GB, Docker, behind a shared Caddy                | Not set up                              |

The residents' app picks its environment when it is built (`dev`, `staging` or `prod`). Sample
data is allowed only in a development debug build; staging and production builds refuse it.

## Staging, as it is today

Source: `taytay-backend/deploy/staging-shared-linode/README.md` and the files beside it. Deployed
2026-11-05; nightly backups from 2026-11-06. This package was written without contacting the
server; everything below is as the repository records it.

### The server is shared

Staging runs on **LGUIDS-SHARED-LINODE** (139.162.51.165, Ubuntu 24.04, 2 GB of memory). The same
server hosts three other systems, eBPCO, Esperanza and Milagros, all in Docker behind **one**
Caddy web server that belongs to eBPCO (container `ebpco-caddy-1`, configuration
`/opt/ebpco/Caddyfile`).

**Only the Taytay parts may be touched.** They are:

1. everything under `/opt/taytay` (the Docker Compose project named `taytay`);
2. the two Taytay site blocks appended to the shared Caddyfile (the text is
   `deploy/staging-shared-linode/caddy-taytay.snippet`; a backup of the Caddyfile from before they
   were added is `Caddyfile.bak-taytay-20261105`);
3. the shared Caddy's membership of the `taytay-staging` Docker network;
4. the backup job `/etc/cron.d/taytay-backup` and its log `/var/log/taytay-backup.log`.

Never stop, restart, rebuild or edit another project's containers, files or Caddy blocks. A
mistake there takes down systems that have nothing to do with Taytay.

### What runs

| Container         | Image or build                   | Memory limit | Networks                                       | Role                                         |
| ----------------- | -------------------------------- | ------------ | ---------------------------------------------- | -------------------------------------------- |
| `taytay-postgres` | `postgres:16`                    | 256 MB       | `taytay-internal` only (not reachable outside) | The database `taytay`, user `taytay`         |
| `taytay-api`      | Built from `/opt/taytay/backend` | 384 MB       | `taytay-internal`, `taytay-staging`            | The API on port 3000; migrates on each start |
| `taytay-console`  | `caddy:2-alpine`                 | 64 MB        | `taytay-staging`                               | Serves the console's static files and CSP    |

Two Docker volumes hold the data: `taytay-pgdata` (the database) and `taytay-media` (uploaded
files). The shared Caddy forwards `taytay-api.139-162-51-165.sslip.io` to `taytay-api:3000` and
`taytay.139-162-51-165.sslip.io` to `taytay-console:80`.

### Layout on the server

```text
/opt/taytay/
  docker-compose.yml               from deploy/staging-shared-linode/
  console.Caddyfile                static console + its content-security policy
  backend/                         `git archive` of taytay-backend + the Dockerfile
  backend.prev/                    the backend/ the last deploy replaced (for a rollback)
  console/                         `ng build --configuration staging` output (browser/)
  console.prev/                    the console/ the last deploy replaced (for a rollback)
  secrets/firebase-adminsdk.json   mode 600, root: the Firebase Admin SDK key, never in git
  .env, .env.api                   mode 600: generated on the server; never copied off it
  backup.sh                        the nightly database dump (in the repo since 9f42f49)
  backups/                         taytay-<UTC time>.sql.gz, mode 600, seven days kept
/etc/cron.d/taytay-backup          runs backup.sh at 02:17 Manila time (taytay-backup.cron)
```

### How staging is configured

`.env.api` sets `NODE_ENV=development` **on purpose**: production mode refuses to start without
SMTP, Linode Object Storage and a TLS database, none of which staging has. It therefore names
every provider explicitly:

- `AUTH_VERIFIER=firebase`: real Firebase sign-in, never the mock;
- `MEDIA_STORE=local`: files in the `taytay-media` volume;
- `EMAIL_SENDER=mock`: no e-mail is sent, so a resident's sign-up code never arrives;
- `DATABASE_SSL=disable`: the database is reachable only on the private `taytay-internal` network;
- `CORS_ALLOWED_ORIGINS`: the console's exact address.

The console's content-security policy allows no inline styles, so after each console upload a
per-request nonce is stamped into `index.html` (`DL-172`; command in
[operations-runbook.md](operations-runbook.md)).

### Still to do on staging

From the staging README and the requirements go-live list:

- A real name, `staging.lguids.com.ph` (a DNS A record to 139.162.51.165), instead of sslip.io.
- An HTTP-referrer restriction on the Firebase browser key for the console's address (GL-6).
- SMTP and object storage, then `NODE_ENV=production`, so that production's start-up refusals are
  exercised before production (R-3).
- Test accounts for the seven office roles, for the UAT round (`docs/uat/README.md`).

## Production, as it must be

**Nothing below exists yet.** The launch gate is NO-GO, and production also needs the owner's
written authorisation (deliverable D7).

### What must be supplied, and by whom

| Item                                     | What it is for                                                                                                                                                       | To be supplied by                                                                           | Status       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------ |
| Production Linode virtual machine        | Runs the API                                                                                                                                                         | Paul Espinas                                                                                | Not supplied |
| Managed PostgreSQL                       | The database, not reachable from the internet, TLS verified (`DATABASE_SSL=require`)                                                                                 | Paul Espinas                                                                                | Not supplied |
| Linode Object Storage bucket and key     | Private file storage (`MEDIA_STORE=linode`); never a public bucket                                                                                                   | Paul Espinas                                                                                | Not supplied |
| Domain and API address                   | `api.<approved-domain>` for the API, a name for the console, TLS certificates                                                                                        | Paul Espinas                                                                                | Not supplied |
| Firebase production project              | Sign-in for residents and staff, separate from staging, with Android and iOS apps registered                                                                         | Paul Espinas                                                                                | Not supplied |
| Apple Team ID                            | Signing the iOS app                                                                                                                                                  | Paul Espinas                                                                                | Not supplied |
| Android upload keystore                  | Uploading Android releases. Google Play App Signing holds the app signing key, so a lost upload key is reset through the Play Console rather than ending the listing | Paul Espinas creates it with the Play listing; handed to the LGU at turnover (mobile D-186) | Not supplied |
| SMTP account                             | Sign-up and password-reset codes (`EMAIL_SENDER=smtp`)                                                                                                               | Owner's decision: which sender                                                              | Not chosen   |
| Google Play and Apple developer accounts | Publishing the app, under the municipality's own identity (mobile `docs/integration/manual-tasks.md` §4)                                                             | The LGU                                                                                     | Not recorded |
| Console hosting                          | Linode with Caddy, as on staging, or Netlify (`netlify.toml` exists)                                                                                                 | Owner's decision (GL-14)                                                                    | Not decided  |
| Digital ID signing key                   | `DIGITAL_ID_SIGNING_KEY`, at least 32 characters; required in production                                                                                             | Generated on the production server                                                          | Not created  |

### How production differs from staging

- **The API must run with `NODE_ENV=production`.** It then refuses to start if any of these is
  missing or still a mock: `DATABASE_URL`, `DIGITAL_ID_SIGNING_KEY`, `AUTH_VERIFIER=firebase`,
  `MEDIA_STORE=linode`, `EMAIL_SENDER=smtp`, an encrypted database connection, and an `https`
  `PUBLIC_WEB_BASE_URL`. The error names the variable and never prints its value. `npm run seed`
  refuses to run.
- **The written production runbook is a different shape from staging.**
  `taytay-backend/docs/deploy-linode.md` describes the API on a Linode VM under systemd (or pm2)
  in `/opt/lguids`, behind nginx with a certbot certificate, with migrations run by hand through
  `npm run migrate:prod`. Staging uses Docker Compose behind Caddy, migrating on start. Which
  shape production takes is to be decided with the infrastructure.
- **Backups must leave the server.** Staging's dumps sit on the same machine as the database,
  which protects against a bad migration or a mistaken delete but not against losing the server.
  Production needs managed PostgreSQL with its own backups, or copies sent off the machine, and a
  restore performed and timed (GL-5, launch gate line 18).
- **The console's production configuration** (`src/environments/environment.ts`) has the API
  address `https://api.<approved-domain>/api/v1` and no Firebase key. Until both are filled in,
  a production console says sign-in is not configured and sends nothing (`DL-166`).
- **The app's production build** needs the production API address
  (`--dart-define=TAYTAY_API_BASE_URL`), `env/firebase.prod.json`, the keystore and the Apple Team
  ID (`taytay-mobile-app/docs/release.md`, "Still pending from Paul").

### Environment variables the API reads

Names only, from `taytay-backend/src/config.ts`. Values live in the server's environment file,
never in git. `.env.example` in the backend lists each name with a placeholder.

| Group         | Variables                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Process       | `NODE_ENV`, `PORT`, `LOG_LEVEL`, `SERVICE_NAME`, `API_VERSION`                                                                                                     |
| Database      | `DATABASE_URL`, `DATABASE_SSL`                                                                                                                                     |
| Sign-in       | `AUTH_VERIFIER`, `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_PATH` or `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`                                          |
| File storage  | `MEDIA_STORE`, `MEDIA_LOCAL_DIR`, `LINODE_OBJECT_ENDPOINT`, `LINODE_OBJECT_REGION`, `LINODE_OBJECT_BUCKET`, `LINODE_OBJECT_ACCESS_KEY`, `LINODE_OBJECT_SECRET_KEY` |
| E-mail        | `EMAIL_SENDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_AUTH`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME`                                  |
| Web addresses | `CORS_ALLOWED_ORIGINS`, `PUBLIC_WEB_BASE_URL`, `DEV_CONSOLE_ORIGIN`, `DEV_WEB_BASE`                                                                                |
| Digital ID    | `DIGITAL_ID_SIGNING_KEY`                                                                                                                                           |
