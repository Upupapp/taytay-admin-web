#!/usr/bin/env node
/**
 * check:permission-parity — a route guarded by a key the API never sends is a route nobody reaches.
 *
 * ## The finding (L-23)
 *
 * The console defines 70 permission keys. The API publishes 61, in
 * `AccessControlPermission` in the vendored contract. **Thirty of them match.**
 *
 * That matters because of how the console resolves a session. `fromServerIdentity` keeps only the
 * keys it recognises from the list the server sends and invents nothing — correctly, and by
 * design. So a permission the API has never heard of is a permission no user can ever hold, and
 * `permissionGuard('dashboard.view')` refuses everybody, in every role, forever.
 *
 * Measured against `app.routes.ts`: **24 of 43 guarded routes**, including the landing page.
 *
 * Not all 24 are the same problem, and the fix differs:
 *
 *   * some are naming divergences over an act both sides implement — the console splits
 *     `resident.create` and `resident.update` where the API grants `resident.manage`;
 *   * some are concepts the API genuinely does not have — `case.view` awaits ADR 0044,
 *     `beneficiary.*` is a projection the console invented (`DL-71`), `dashboard.view` and
 *     `settings.manage` have no server-side counterpart at all.
 *
 * Which is which is a decision for the API owner and the office, not for a checker. What a checker
 * can do is make sure the number stops growing.
 *
 * ## Why this is not a `verify` failure today
 *
 * The console still runs on mock adapters (`environment.dataSource === 'mock'`), where permissions
 * come from seed data and every route opens. Nothing is broken *now*. It breaks the day TAB 12
 * flips the flag — and it breaks silently, as a blank console rather than an error.
 *
 * So this is a ratchet on the recorded ceiling, like `check:mapper-adoption`. It fails in both
 * directions: a new unreachable guard, and a guard fixed without lowering the number.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ROUTES = 'src/app/app.routes.ts';

/**
 * Recorded 18 August 2026, TAB 06. LOWER THIS as guards are reconciled with the API's catalog;
 * never raise it. Raising it means adding a screen no user can open.
 */
const CEILING = 24;

const contract = readFileSync(join(ROOT, 'src/app/data/http/contract/types.ts'), 'utf8');
const union = /export type AccessControlPermission =([\s\S]*?);/.exec(contract)?.[1] ?? '';
const granted = new Set([...union.matchAll(/'([a-z][a-z.-]+)'/g)].map((m) => m[1]));

if (granted.size === 0) {
  console.error('\nCould not read AccessControlPermission from the vendored contract.\n');
  process.exit(1);
}

const routes = readFileSync(join(ROOT, ROUTES), 'utf8');
const guards = [...routes.matchAll(/permissionGuard\('([a-z][a-z.-]+)'\)/g)].map((m) => m[1]);
const unreachable = guards.filter((key) => !granted.has(key));

const detail =
  `  ${unreachable.length} of ${guards.length} guarded routes ask for a key the API never sends.\n` +
  `  ${[...new Set(unreachable)].sort().join('\n  ')}\n`;

if (unreachable.length > CEILING) {
  console.error(
    `\nPermission parity check failed: ${unreachable.length - CEILING} new unreachable route guard(s).\n\n` +
      detail +
      `\n  The API grants ${granted.size} permissions and the console asks for keys outside that set.\n` +
      `  fromServerIdentity keeps only what the server sends, so this guard refuses every user in\n` +
      `  every role — not as an error, but as a screen nobody can open.\n\n` +
      `  Use a key from AccessControlPermission, or get the key added to the API's catalog first.\n`,
  );
  process.exit(1);
}

if (unreachable.length < CEILING) {
  console.error(
    `\nPermission parity improved — ${CEILING - unreachable.length} fewer unreachable guard(s) than recorded.\n\n` +
      `  Lower CEILING to ${unreachable.length} in tools/check-permission-parity.mjs so the ground is held.\n`,
  );
  process.exit(1);
}

console.log(
  `Permission parity at the recorded ceiling (${unreachable.length}/${guards.length} unreachable guards, L-23 outstanding).`,
);
