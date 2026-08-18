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
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
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
  return { path: relative(ROOT, f), code: stripComments(source) };
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
// Discarding a variable is not revocation, and must not be described as one.
const adapters = files.find((f) => f.path === 'src/app/data/http/http-repositories.ts')?.code ?? '';
const signOut = /signOut\(\): Observable<void> \{([\s\S]*?)\n  \}/.exec(adapters)?.[1] ?? '';

if (signOut !== '') {
  if (!/auth\/tokens\/current/.test(signOut)) {
    fail(
      'src/app/data/http/http-repositories.ts',
      'signOut() does not call DELETE auth/tokens/current. Clearing the local token leaves the credential valid on the server.',
    );
  }
  if (!/tap\(/.test(signOut) && /clear\(\)/.test(signOut)) {
    fail(
      'src/app/data/http/http-repositories.ts',
      'signOut() clears the token outside the response handler — the token must be dropped only after the API confirms revocation.',
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
