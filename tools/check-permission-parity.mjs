#!/usr/bin/env node
/**
 * check:permission-parity — a route guarded by a key the API never sends is a route nobody reaches.
 *
 * ## The finding (L-23)
 *
 * `fromServerIdentity` keeps only the keys it recognises from the list the server sends and invents
 * nothing — correctly, and by design (`DL-133`). So a permission the API never grants is a
 * permission no user can ever hold, and `permissionGuard('dashboard.view')` refuses everybody, in
 * every role, forever — not as an error, but as a screen nobody can open.
 *
 * ## What it compares since the Node API (`DL-165`)
 *
 * The Laravel API published 61 permission keys in `AccessControlPermission`, and 24 of the
 * console's 43 route guards asked for one it did not have. The Node API publishes what it grants as
 * the `StaffCapability` enum in its spec — the keys `GET /me` returns in `permissions`, built from a
 * table of the API's own route guards. Fifteen capabilities, about the residents' app back office:
 * verification review, offices, services, hotlines, Balita, digital IDs, users, audit.
 *
 * **One** of them is a key a console route asks for: `audit.view`. So 42 of 43 guards are
 * unreachable against the real API. That is not 18 guards regressing; it is the measure of
 * `DL-164` — the console's modules are casework and the API's are not — and it falls as platform
 * screens are built on the capabilities the API does grant, or as the API grows casework.
 *
 * Nothing here maps one vocabulary onto the other. Deciding that `case.view` "means"
 * `household.view-counts` would be the console computing a grant the server never made.
 *
 * ## A ratchet, in both directions
 *
 * The console runs on mock adapters in development, where every route opens, so nothing is broken
 * there. It fails on a new unreachable guard, and on a guard fixed without lowering the number.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROUTES = 'src/app/app.routes.ts';

/**
 * 24 → 42 on 5 November 2026 (`DL-165`): re-pointed from Laravel's `AccessControlPermission` to the
 * Node spec's `StaffCapability`. The API was replaced; no guard changed. LOWER THIS as guards become
 * reachable; never raise it. Raising it means adding a screen no user can open.
 */
const CEILING = 42;

const spec = JSON.parse(readFileSync(join(ROOT, 'src/app/data/http/contract/openapi.json'), 'utf8'));
const capabilities = spec.components?.schemas?.StaffCapability?.enum;
const granted = new Set(Array.isArray(capabilities) ? capabilities : []);

if (granted.size === 0) {
  console.error('\nCould not read components.schemas.StaffCapability from the vendored spec.\n');
  process.exit(1);
}

/*
 * The enum is only worth comparing against if it is what `/me` actually carries. A spec that kept
 * the enum and stopped referencing it from `UserProfile.permissions` would leave this check
 * measuring a vocabulary nothing sends.
 */
const carried = spec.components?.schemas?.UserProfile?.properties?.permissions?.items?.$ref;

if (carried !== '#/components/schemas/StaffCapability') {
  console.error('\nUserProfile.permissions no longer carries StaffCapability, so this check would compare against nothing /me sends.\n');
  process.exit(1);
}

const routes = readFileSync(join(ROOT, ROUTES), 'utf8');
/*
 * A guard may name several keys and opens for any of them (`DL-170`: the app directory, one route
 * for three keys). It is read as one guard, and it is unreachable if **any** key it names is outside
 * what the server sends — stricter than the guard's own "any", because a key nobody can hold, listed
 * beside one somebody can, reads as a grant that exists.
 */
const guardKeys = [
  ...routes.matchAll(/permissionGuard\(\s*('[a-z][a-z.-]+'(?:\s*,\s*'[a-z][a-z.-]+')*)\s*,?\s*\)/g),
].map((m) => [...m[1].matchAll(/'([a-z][a-z.-]+)'/g)].map((k) => k[1]));
const guards = guardKeys.map((keys) => keys.join(' | '));
const callSites = [...routes.matchAll(/permissionGuard\s*\(/g)].length;

/*
 * Relative reach: every guard call must have been read as a key. A guard written with a constant or
 * a double-quoted string would otherwise drop out of the comparison and pass by absence.
 */
if (guards.length === 0 || guards.length !== callSites) {
  console.error(
    `\n${callSites} permissionGuard calls in ${ROUTES}, ${guards.length} read as a key. Write each as a single-quoted literal.\n`,
  );
  process.exit(1);
}

const unreachable = guardKeys
  .filter((keys) => keys.some((key) => !granted.has(key)))
  .map((keys) => keys.join(' | '));

const detail =
  `  ${unreachable.length} of ${guards.length} guarded routes ask for a key the API never sends.\n` +
  `  ${[...new Set(unreachable)].sort().join('\n  ')}\n`;

if (unreachable.length > CEILING) {
  console.error(
    `\nPermission parity check failed: ${unreachable.length - CEILING} new unreachable route guard(s).\n\n` +
      detail +
      `\n  The API grants ${granted.size} capabilities and the console asks for keys outside that set.\n` +
      `  fromServerIdentity keeps only what the server sends, so this guard refuses every user in\n` +
      `  every role — not as an error, but as a screen nobody can open.\n\n` +
      `  Use a key from StaffCapability, or get the capability added to the API first.\n`,
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
  `Permission parity at the recorded ceiling (${unreachable.length}/${guards.length} unreachable guards against ${granted.size} StaffCapability keys, L-23 outstanding).`,
);
