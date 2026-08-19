#!/usr/bin/env node
/**
 * check:headers — the policy two ADRs depend on cannot be weakened quietly.
 *
 * ## Why this is P1 and not hardening polish
 *
 * TAB 13, verbatim: *"without the policy below, the residual XSS risk both authentication ADRs
 * accepted is unmitigated, not merely undocumented. Until this command lands, the chosen
 * authentication model is unsound as deployed."*
 *
 * ADR 0005 and ADR 0006 chose a first-party bearer token held in a private field over a cookie,
 * and that choice **accepted** a residual XSS risk on the explicit basis that a strict CSP would
 * contain it. A token in memory is not protected by `HttpOnly`; the thing standing between an
 * injected script and a caseworker's session is `script-src 'self'`. Weaken it and the accepted
 * risk becomes an unmitigated one, silently, in a file nobody re-reads.
 *
 * ## The weakening this exists to catch
 *
 * `style-src` was **missing entirely**, so Angular's build-time critical-CSS block — 2.3 kB of
 * inline `<style>` in `index.html` — fell through to `default-src 'self'` and would have been
 * blocked. The console would have rendered unstyled, and the obvious fix is
 * `style-src 'self' 'unsafe-inline'`.
 *
 * The command names that exact move: *"Do not add [unsafe-inline] to make the build work — that is
 * the exact silent weakening the topology document warns about."*
 *
 * It was fixed by **changing the feature**: `inlineCritical: false` removes the inline block
 * entirely, so `style-src 'self'` needs no nonce, no hash and no exception. That is the guardrail
 * followed rather than argued with.
 *
 * ## Rules
 *
 * 1. Every policy carries every required directive.
 * 2. No policy anywhere contains `unsafe-inline`, `unsafe-eval` or a wildcard source.
 * 3. `netlify.toml` and `public/_headers` agree — the second ships inside the bundle and is what
 *    actually serves on a host that reads it.
 * 4. The companion headers are present.
 * 5. HSTS is absent until somebody confirms the certificate chain, because it cannot be undone.
 * 6. The production build emits no inline `<style>` or `<script>`, which is what makes rule 2
 *    affordable.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const REQUIRED_DIRECTIVES = [
  'default-src',
  'script-src',
  'style-src',
  'connect-src',
  'object-src',
  'base-uri',
  'frame-ancestors',
  'form-action',
  'img-src',
];

/** Any of these in a policy defeats the control the authentication model leans on. */
const FORBIDDEN = ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", 'data: script-src'];

const COMPANION_HEADERS = ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'];

const failures = [];

/**
 * Comments explain these rules and must not trip them.
 *
 * `netlify.toml` carries a comment reading "DELIBERATELY ABSENT: Strict-Transport-Security", and
 * the first version of this check failed the build on it — telling somebody to remove the sentence
 * that documents the decision.
 */
function code(source) {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('#') && !line.trim().startsWith('//'))
    .join('\n');
}

function policiesIn(source) {
  return [...source.matchAll(/Content-Security-Policy[^\n]*?[:=]\s*"?([^"\n]+)"?/g)].map((m) => m[1]);
}

const files = ['netlify.toml', 'public/_headers'].filter((f) => existsSync(join(ROOT, f)));

if (files.length < 2) {
  failures.push(
    'Both netlify.toml and public/_headers must exist.\n' +
      '    The second ships INSIDE the bundle, so it is what serves on a host configured from a\n' +
      '    dashboard rather than from this repository.',
  );
}

for (const file of files) {
  const source = code(readFileSync(join(ROOT, file), 'utf8'));
  const policies = policiesIn(source);

  if (policies.length === 0) {
    failures.push(`${file} declares no Content-Security-Policy.`);
    continue;
  }

  for (const policy of policies) {
    for (const directive of REQUIRED_DIRECTIVES) {
      if (!policy.includes(`${directive} `)) {
        failures.push(
          `${file}: a policy is missing '${directive}'.\n` +
            `    Missing directives fall through to default-src, which is how a real requirement\n` +
            `    becomes an accident — and how somebody discovers it by the console rendering wrong.`,
        );
      }
    }

    for (const banned of FORBIDDEN) {
      if (policy.includes(banned)) {
        failures.push(
          `${file}: a policy contains ${banned}.\n` +
            `    ADR 0005 and ADR 0006 accepted a residual XSS risk on the basis that this policy\n` +
            `    contains it. A bearer token in memory has no HttpOnly to fall back on — weakening\n` +
            `    this makes an accepted risk an unmitigated one. Change the feature, not the policy.`,
        );
      }
    }

    /*
     * Mixed content (TAB 13 step 9). `upgrade-insecure-requests` takes no value, so it is checked
     * separately from the directives above rather than with a trailing space that will never match.
     *
     * It matters here more than on most sites: a single `http://` subresource on a page holding a
     * bearer token is a downgrade an attacker on the path can read.
     */
    if (!policy.includes('upgrade-insecure-requests')) {
      failures.push(
        `${file}: a policy omits 'upgrade-insecure-requests'.\n` +
          `    One http:// subresource on a page holding a bearer token is a downgrade somebody on\n` +
          `    the path can read.`,
      );
    }

    // A wildcard host in a fetch directive is the same weakening wearing a different hat.
    if (/(?:script|connect|style|img)-src[^;]*\s\*(?:\s|;|$)/.test(policy)) {
      failures.push(`${file}: a policy allows a wildcard source. Name the exact origins.`);
    }
  }

  for (const header of COMPANION_HEADERS) {
    if (!source.includes(header)) {
      failures.push(`${file} does not set ${header}.`);
    }
  }

  // ── 5. HSTS waits for the certificate chain ──────────────────────────────
  // An assignment, not a mention: the comment above documents why it is absent.
  if (/Strict-Transport-Security\s*[:=]/i.test(source)) {
    failures.push(
      `${file} sets Strict-Transport-Security.\n` +
        `    Deliberately absent until custom domains and certificates are confirmed: it cannot be\n` +
        `    undone from the server, and a wrong max-age locks every browser out of the console for\n` +
        `    its duration. It is on the manual TODO as an explicit deployment step.`,
    );
  }
}

// ── 3. the two files agree ─────────────────────────────────────────────────
if (files.length === 2) {
  const [toml, headers] = files.map((f) => code(readFileSync(join(ROOT, f), 'utf8')));

  const directivesOf = (policy) =>
    policy
      .split(';')
      .map((part) => part.trim().split(' ')[0])
      .filter(Boolean)
      .sort()
      .join(',');

  const tomlSet = new Set(policiesIn(toml).map(directivesOf));
  const headerSet = policiesIn(headers).map(directivesOf);

  for (const policy of headerSet) {
    if (!tomlSet.has(policy)) {
      failures.push(
        'public/_headers and netlify.toml declare different sets of CSP directives.\n' +
          '    They drifted once already on caching. The fallback file is the one that ships inside\n' +
          '    the bundle, so on a host that reads it, the drift is what actually serves.',
      );
      break;
    }
  }
}

// ── 6. nothing inline in what ships ────────────────────────────────────────
const INDEX = join(ROOT, 'dist/taytay-social-welfare/browser/index.html');

if (existsSync(INDEX)) {
  const index = readFileSync(INDEX, 'utf8');

  if (/<style[\s>]/.test(index)) {
    failures.push(
      'The production index.html contains an inline <style> block.\n' +
        "    `style-src 'self'` blocks it, and the tempting fix is 'unsafe-inline'. The right fix is\n" +
        '    `inlineCritical: false` in angular.json — change the feature, not the policy.',
    );
  }

  if (/<script(?![^>]*\ssrc=)/.test(index)) {
    failures.push(
      "The production index.html contains an inline <script>. `script-src 'self'` blocks it, and\n" +
        '    that directive is the one the authentication model actually leans on.',
    );
  }
}

if (failures.length > 0) {
  console.error('\nHeader check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(`Header check passed (${files.length} hosting files, no weakened policy).`);
