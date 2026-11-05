# Taytay Rizal Social Welfare — Angular Frontend

Staff console for the Municipal Social Welfare and Development Office (MSWDO) of
Taytay, Rizal, and for the staff who run the residents' Taytay app. Angular 22,
standalone, zoneless, strict TypeScript.

Read [`CLAUDE.md`](./CLAUDE.md) before contributing — it is the project
constitution and holds the architecture, boundaries and non-negotiable rules.

## Status

The backend is the Node API in `taytay-backend` (since 2026-10-20; `DL-164`).
Against it the console serves staff sign-in (Firebase), notifications, and the
platform screens: ID verification, office inbox, users and roles, app
directory, home screen, app settings, digital IDs, Balita and the app audit
trail (`DL-167`–`DL-171`).

The MSWDO casework modules (requests, cases, releases, referrals, visits, …)
have no endpoint on that API. They run on sample data in `local-mock`; against
the real API they are hidden from the menu and named on one "not connected"
page. Whether the API grows them is an owner decision —
[`docs/integration/node-api-migration.md`](./docs/integration/node-api-migration.md).

## Local development

```bash
npm install
npm start          # local-mock: http://localhost:4200, sample data, no backend
```

Against the real API on this machine (no Docker needed):

```bash
# in taytay-backend
npm run dev:memory # API on http://127.0.0.1:3000, in-memory database, mock tokens

# here
npx ng serve --configuration local-api
```

`local-api` signs in through the backend's development token verifier: type
any email, pick staff or admin. Staging signs in against the Firebase project
`taytay-lgu-ids-staging` (`DL-169`).

## Checks

```bash
npm run verify     # lint + typecheck + every repository check + tests + production build
```

Individually: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Layout

```
src/app/domain/     Models, status catalogs, transition rules, repository ports
src/app/data/       Mock and HTTP adapters + the single mock/http switch
src/app/core/       Session, permissions, guards, interceptors, notifications
src/app/shared/     Reusable UI primitives, pipes, view-state helpers
src/app/features/   Routed screens
src/app/layout/     Authenticated application shell
```

## Related repositories

`taytay-backend` (Node API) and `taytay-mobile-app` (resident Flutter app) are
separate repositories. Nothing server-side or mobile belongs here.

## Remote

`origin` is `Upupapp/taytay-admin-web`. Commits land on `main`; pushing and
deploying are human decisions (CLAUDE.md rule 9).
