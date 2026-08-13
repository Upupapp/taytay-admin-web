# Taytay Rizal Social Welfare — Angular Frontend

Staff console for the Municipal Social Welfare and Development Office (MSWDO) of
Taytay, Rizal. Angular 22, standalone, zoneless, strict TypeScript.

Read [`CLAUDE.md`](./CLAUDE.md) before contributing — it is the project
constitution and holds the architecture, boundaries and non-negotiable rules.

## Status

Foundation in place: routing skeleton, typed domain models, mock/HTTP data seam,
shared UI primitives and the authenticated app shell. Most feature screens are
deliberate placeholders that later work will replace.

## Local development

```bash
npm install
npm start          # http://localhost:4200
```

The app starts against **in-memory mock adapters** — there is no backend in this
repository. Sign-in offers a list of seeded staff accounts so every role and
permission path can be exercised.

## Checks

```bash
npm run verify     # lint + typecheck + tests + production build
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

The backend API and the resident-facing Flutter app are separate local
repositories. Nothing server-side or mobile belongs here.

## Local-only

No remote is configured. Work stays local; nothing is pushed or deployed from
this repository.
