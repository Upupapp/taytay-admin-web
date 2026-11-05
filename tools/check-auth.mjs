#!/usr/bin/env node
/**
 * check:auth — no credential in storage, and no way to be signed in without one.
 *
 * Two rules, both from TAB 02 and ADR 0006, and both invisible to the compiler:
 * a `localStorage.setItem` typechecks perfectly, and so does an adapter that
 * hands back a fully permissioned user having asked for nothing.
 *
 * The second rule is the one with history behind it. The sweep recorded a
 * `signInAs` path in this console — a credential-less way to become a staff
 * member, written when there was no API to authenticate against. It has since
 * been removed. This check is what stops it, or anything shaped like it, coming
 * back the next time somebody wants a faster way to test a screen.
 *
 * Each rule was validated against a planted regression before being trusted.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Paths are compared against '/'-separated literals; on Windows `relative` answers with '\',
// and a comparison that can never match fails on correct code or skips the file it guards.
const posix = (path) => path.split(sep).join('/');

const SRC = join(ROOT, 'src');

const failures = [];
const fail = (file, message) => failures.push(`${file}\n    ${message}`);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.html')) out.push(full);
  }
  return out;
}

/** Comments are prose. Every rule here reasons about what the code does. */
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');

const files = walk(SRC).map((f) => {
  const source = readFileSync(f, 'utf8');
  return { path: posix(relative(ROOT, f)), code: stripComments(source) };
});

// ── 1. No credential may reach any persistent client-side store ──────────────
//
// ADR 0006: the access token lives in a private field and nowhere else. It does
// not survive a reload, which is the point — a memory-only token narrows the XSS
// window from "everything ever stored" to "this tab, while open".
//
// The whole of web storage is refused rather than "storage of anything that
// looks like a token", because a rule about *what* is stored needs somebody to
// judge each case correctly forever, and a rule about *whether* does not. The
// console has no legitimate use for web storage: DL-110 already refuses it for
// search terms, for the same reason.
const STORAGE = [
  ['localStorage', 'localStorage'],
  ['sessionStorage', 'sessionStorage'],
  ['document.cookie', 'document\\.cookie'],
  ['indexedDB', 'indexedDB'],
];

for (const { path, code } of files) {
  if (path.endsWith('.spec.ts')) continue;

  for (const [name, pattern] of STORAGE) {
    if (new RegExp(`\\b${pattern}\\b`).test(code)) {
      fail(
        path,
        `uses ${name}. Nothing in this console is written to web storage — the access token ` +
          'lives in a private field of AuthTokenHolder (ADR 0006), and a resident name typed into ' +
          'a form is personal data that must not outlive the tab (DL-110).',
      );
    }
  }
}

// ── 2. The token holder exposes no getter ────────────────────────────────────
//
// A readable token is a token a template can render. `authorization()` returns
// a header object, and there is deliberately nothing that returns the value.
const holderPath = 'src/app/core/auth/auth-token.holder.ts';
const holder = files.find((f) => f.path === holderPath)?.code ?? '';

if (holder === '') {
  fail(holderPath, 'missing. The access token must have exactly one home.');
} else {
  if (!/#token/.test(holder)) {
    fail(holderPath, 'the token must be a private class field (#token), not a property a caller can reach.');
  }
  if (/(get token|token\(\): string|readonly token =)/.test(holder)) {
    fail(holderPath, 'exposes the raw token. Provide only attach/clear-shaped operations — a value a component can read is a value a template can print.');
  }
  if (/signal\s*<[^>]*>\s*\(\s*(null|'')/.test(holder) && /token/i.test(holder)) {
    fail(holderPath, 'holds the token in a signal. A signal is readable by every component that injects the service.');
  }
}

// ── 2b. The refresh token has one home too, and no way out of it ─────────────
//
// `DL-166`. The Firebase refresh token is longer-lived than the ID token and renews it for as long
// as the account stands, so it gets the access token's treatment and more: a private field of the
// identity provider, no getter, no method or property named for it, never in the grant the provider
// hands the staff adapter (which would put it one `hold()` away from a second home).
const PROVIDER_PATH = 'src/app/data/http/identity/identity.provider.ts';
const GRANT_PATH = 'src/app/data/http/identity/identity.model.ts';
const provider = files.find((f) => f.path === PROVIDER_PATH)?.code ?? '';
const grantModel = files.find((f) => f.path === GRANT_PATH)?.code ?? '';

if (provider === '') {
  fail(PROVIDER_PATH, 'missing. The refresh token must have exactly one home, and this is it.');
} else {
  if (!/#refreshToken\b/.test(provider)) {
    fail(PROVIDER_PATH, 'the refresh token must be a private class field (#refreshToken), not a property a caller can reach.');
  }
  if (
    /\bget\s+refreshToken\b|\brefreshToken\s*\(\s*\)|\b(?:public|protected|private|readonly|static)\s+(?:readonly\s+)?refreshToken\b|^\s*refreshToken\s*[:=]/m.test(
      provider,
    )
  ) {
    fail(PROVIDER_PATH, 'exposes the refresh token through a getter, method or property. It is read only by refresh(), from #refreshToken.');
  }
  if (/signal\s*<[^>]*>\s*\(/.test(provider)) {
    fail(PROVIDER_PATH, 'holds state in a signal. A signal is readable by every component that injects the service.');
  }
}

if (grantModel === '') {
  fail(GRANT_PATH, 'missing. The grant shape is what keeps the refresh token out of the staff adapter.');
} else if (/refresh_?token/i.test(grantModel)) {
  fail(GRANT_PATH, 'names a refresh token in the grant or port. The provider keeps it; nothing it returns may carry it.');
}

// ── 2c. No Firebase SDK ───────────────────────────────────────────────────────
//
// `DL-166`, after node-api-transport-design.md §4: sign-in is Firebase Auth over REST. The SDK's
// default persistence is IndexedDB, its heartbeat writes there regardless, and it hands any
// injector holding `Auth` an object whose tokens are public — every one of them a second home for a
// credential. Refused as an import and as a dependency, so it cannot arrive as either.
const FIREBASE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"](?:firebase|@firebase\/[^'"]+|firebase\/[^'"]+|@angular\/fire(?:\/[^'"]+)?)['"]/;

for (const { path, code } of files) {
  if (FIREBASE_IMPORT.test(code)) {
    fail(path, 'imports the Firebase SDK. Sign-in is Firebase Auth over REST, held in two private fields (DL-166).');
  }
}

{
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  const sdk = declared.filter((name) => name === 'firebase' || name.startsWith('@firebase/') || name === '@angular/fire');

  if (sdk.length > 0) {
    fail('package.json', `depends on ${sdk.join(', ')}. Sign-in is Firebase Auth over REST; the SDK is refused (DL-166).`);
  }
}

// ── 2d. The development credential exists in one swapped file, for one configuration ──
//
// `DL-166`. Against a backend running `AUTH_VERIFIER=mock`, `mock:<role>:<subject>` is a working
// credential with whatever role it names. The file that composes one is swapped in by angular.json
// for `local-api` and nothing else, so no production or staging build imports it (the DL-136
// technique). That only holds while the composition lives in that file alone and no other module
// imports it — a helper "for tests" in a shared file would ship.
const VERIFIER_PATH = 'src/app/data/http/identity/identity.provider.mock-verifier.ts';
const VERIFIER_SPEC = 'src/app/data/http/identity/identity.provider.mock-verifier.spec.ts';

if (!files.some((f) => f.path === VERIFIER_PATH)) {
  fail(VERIFIER_PATH, 'missing, so the place the development credential may be composed could not be checked.');
}

for (const { path, code } of files) {
  if (path === VERIFIER_PATH || path === VERIFIER_SPEC) continue;

  if (/['"`]mock:/.test(code)) {
    fail(path, 'composes a development (`mock:`) credential. Only the swapped-in local-api identity provider may.');
  }

  if (/identity\.provider\.mock-verifier['"]/.test(code)) {
    fail(path, 'imports the development identity provider. Only angular.json may bring it in, by file replacement.');
  }
}

{
  const workspace = JSON.parse(readFileSync(join(ROOT, 'angular.json'), 'utf8'));
  const using = [];

  for (const [project, definition] of Object.entries(workspace.projects ?? {})) {
    for (const [target, spec] of Object.entries(definition.architect ?? {})) {
      for (const [configuration, options] of Object.entries({ '(default)': spec.options ?? {}, ...(spec.configurations ?? {}) })) {
        for (const replacement of options.fileReplacements ?? []) {
          if (String(replacement.with ?? '').endsWith('identity.provider.mock-verifier.ts')) {
            using.push(`${project}:${target}:${configuration}`);
          }
        }
      }
    }
  }

  const wrong = using.filter((where) => !where.endsWith(':build:local-api'));

  if (using.length === 0) {
    fail('angular.json', 'no configuration swaps in the development identity provider, so local-api would sign in through Firebase with no key.');
  }

  if (wrong.length > 0) {
    fail('angular.json', `swaps in the development identity provider for ${wrong.join(', ')}. It belongs to build:local-api alone.`);
  }
}

// ── 3. Nothing produces an authenticated user without a credential ───────────
//
// The removed `signInAs` is the shape this looks for: any method that returns an
// identity while taking a role, an id, or nothing at all.
const IMPERSONATION = /\b(signInAs|impersonate|becomeUser|loginAs|actAs|assumeRole|forceSignIn|autoSignIn)\b/;

for (const { path, code } of files) {
  if (IMPERSONATION.test(code)) {
    fail(
      path,
      'defines or calls a credential-less sign-in. Every session begins with a credential presented to the API; ' +
        'a shortcut for testing becomes a shortcut in production.',
    );
  }
}

// ── 4. Only the staff adapters may hold a token ──────────────────────────────
//
// `hold()` is what turns a response into a session. If anything outside the
// authentication path can call it, the credential requirement is decorative.
const HOLD_ALLOWED = [
  'src/app/core/auth/auth-token.holder.ts',
  'src/app/data/http/http-repositories.ts',
];

for (const { path, code } of files) {
  if (path.endsWith('.spec.ts')) continue;
  if (HOLD_ALLOWED.includes(path)) continue;

  if (/\.hold\s*\(/.test(code)) {
    fail(path, 'calls AuthTokenHolder.hold(). Only the staff adapter may turn a sign-in response into a session.');
  }
}

// ── 5. Sign-out is server-side revocation ────────────────────────────────────
//
// Discarding a variable is not revocation, and must not be described as one. The Node API revokes
// at `POST auth/sign-out` (every refresh token the account holds), so the adapter must call it —
// literally, or through `API_ENDPOINTS.signOut` resolving to it.
//
// And the request must go out BEFORE the token is dropped, or it is sent unauthenticated and
// revokes nothing while the screen says signed out. The token is dropped once the API has answered,
// whatever it answered (`DL-165`, superseding the Laravel-era rule that a failed revocation keeps
// the token): so `clear()` must sit in a `finalize`/`tap` after the request, never before it.
const ADAPTER_PATH = 'src/app/data/http/http-repositories.ts';
const adapters = files.find((f) => f.path === ADAPTER_PATH)?.code ?? '';
const contract = files.find((f) => f.path === 'src/app/data/http/api.contract.ts')?.code ?? '';
const signOut = /signOut\(\): Observable<void> \{([\s\S]*?)\n  \}/.exec(adapters)?.[1] ?? '';
const signOutPath = /\bsignOut:\s*'([^']+)'/.exec(contract)?.[1] ?? null;

if (signOut === '') {
  fail(ADAPTER_PATH, 'signOut() could not be found in the staff adapter, so revocation was not checked.');
} else {
  const callsRevocation =
    /['"`]auth\/sign-out['"`]/.test(signOut) ||
    (/API_ENDPOINTS\s*\.\s*signOut\b/.test(signOut) && signOutPath === 'auth/sign-out');

  if (!callsRevocation) {
    fail(
      ADAPTER_PATH,
      'signOut() does not call POST auth/sign-out. Clearing the local token leaves every refresh token valid on the server.',
    );
  }

  const request = signOut.search(/this\s*\.\s*(api|http)\s*\./);
  const clearing = signOut.search(/\.\s*clear\s*\(\s*\)/);

  if (request === -1) {
    fail(ADAPTER_PATH, 'signOut() makes no request at all. Revocation is something the server does.');
  } else if (clearing !== -1 && (clearing < request || !/\b(finalize|tap)\s*\(/.test(signOut.slice(request)))) {
    fail(
      ADAPTER_PATH,
      'signOut() clears the token before, or outside, the answer to its revocation request. Cleared first, ' +
        'the request goes out unauthenticated and revokes nothing.',
    );
  }
}

// ── 6. Authorization is decided from what the server issued ─────────────────
//
// TAB 03 moved the console onto the permissions `GET /api/v1/me` resolves.
// `ROLE_DEFINITIONS` stays as documentation, as the office-facing reference
// matrix, and as a fixture for the mock adapter and tests — but nothing that
// *decides* may read it, or the console is computing an answer the server has
// already given and the two will disagree.
//
// Deliberately scoped to the deciders rather than every reader: the
// administration screen renders the matrix for the office, which is the map's
// legitimate use, and forbidding that would only push it somewhere less visible.
//
// The HTTP adapters are deciders too (`DL-165`). The Node API has two staff roles and publishes
// what it grants as `permissions` on `/me`; an adapter that filled a permission set from
// `ROLE_DEFINITIONS[role]` would be the same second authority, one folder over, and the guards
// would never see the difference.
const DECIDERS = [
  'src/app/core/access/',
  'src/app/core/auth/session.store.ts',
  'src/app/core/auth/session-state.ts',
  'src/app/data/http/',
];

for (const { path, code } of files) {
  if (path.endsWith('.spec.ts')) continue;
  if (!DECIDERS.some((prefix) => path.startsWith(prefix))) continue;

  if (/\bROLE_DEFINITIONS\b/.test(code)) {
    fail(
      path,
      'reads ROLE_DEFINITIONS. Guards, directives and the session decide from the permissions the ' +
        'server resolved (GET /me); the role map is documentation and a fixture. Two authorities ' +
        'means showing a caseworker a button the server refuses, or hiding one it would allow.',
    );
  }
}

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('\nAuthentication check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  console.error(
    `${failures.length} problem${failures.length === 1 ? '' : 's'}.\n\n` +
      'ADR 0006 holds the access token in memory only, and its residual XSS risk is accepted on\n' +
      'that basis. Weakening any of the above changes a decision, not an implementation detail.\n',
  );
  process.exit(1);
}

console.log('Authentication check passed.');
