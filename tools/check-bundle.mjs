#!/usr/bin/env node
/**
 * check:bundle — the production artefact carries no invented residents.
 *
 * ## Why it inspects the build and not the source
 *
 * TAB 12 is explicit: *"Verify by inspecting the built artefact, not the source: a tree-shaking
 * assumption is not a guarantee, and a resident seed record shipped to a browser is a disclosure."*
 *
 * That distinction is the whole point. `data-access.providers.ts` selects the mock or the HTTP
 * adapters from `environment.dataSource`, and everybody *assumes* the unused branch is shaken out.
 * It usually is. It stops being when a seed file acquires a side effect, when a barrel re-exports
 * it, when a `const` is referenced from a type position that survives erasure, or when a build flag
 * changes. None of those produce an error — they produce a larger bundle that nobody reads, with a
 * hundred invented residents in it.
 *
 * A seeded resident is fictional, so this is not a privacy breach in itself. It is worse in a
 * quieter way: it means the bundle contains a *registry-shaped* payload that a reader could mistake
 * for real, and it means the mock reached a build that claims to be production — which is the
 * misconfiguration `check:environments` exists to prevent, arriving through a different door.
 *
 * ## What it looks for
 *
 * Names that appear only in seed data, and the seed module's own markers. Not the word "mock",
 * which legitimately appears in comments and type names.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist/taytay-social-welfare/browser');

/**
 * Strings that exist in the seed data and nowhere a production bundle should reach.
 *
 * Real surnames on purpose: they are what a seed record actually contains, and searching for the
 * word "seed" would miss a shipped payload whose variable names were minified away.
 */
const SEED_MARKERS = [
  'Aurelia',
  'Marilou',
  'Nicanor',
  'Bautista family',
  'MOCK_LATENCY',
  // The verification seed's drawn placeholders (`DL-167`): a sample "ID" must never ship.
  'SAMPLE ONLY - NOT A REAL ID',
  // The office inbox seed's drawn attachments (`DL-168`).
  'SAMPLE ONLY - NOT A REAL ATTACHMENT',
  // Every seeded app account's address is at this reserved name (`DL-168`).
  'accounts.example.test',
  // Every seeded directory address is at this reserved name (`DL-170`).
  'directory.example.test',
  // The home screen seed's reserved address and drawn banners (`DL-170`).
  'home.example.test',
  'SAMPLE BANNER - ',
  // The settings seed's reserved address (`DL-170`).
  'settings.example.test',
  // The digital ID seed's sample codes and card numbers (`DL-171`).
  'SAMPLE-QR.',
  'TAY-SAMPLE-',
  // The Balita seed's article titles (`DL-171`).
  'SAMPLE BALITA - ',
  // The audit trail seed's row ids (`DL-171`).
  'audit-sample-',
  'mockLatencyMs":250',
];

/**
 * Wording that exists only in the development identity provider (`DL-166`).
 *
 * `identity.provider.mock-verifier.ts` composes `mock:<role>:<subject>` credentials, which a
 * backend running `AUTH_VERIFIER=mock` accepts with whatever role they name. `angular.json` swaps
 * it in for `local-api` alone, so a production build never imports it — and this is the proof
 * taken from the artefact rather than from the configuration. A string literal survives
 * minification where a class name does not, so the marker is the sentence the screen shows.
 *
 * The marker is also required to still be **in** that file: a rewording that dropped it would
 * leave this check looking for a sentence nothing contains, passing for ever.
 */
const DEVELOPMENT_VERIFIER = 'src/app/data/http/identity/identity.provider.mock-verifier.ts';
const DEVELOPMENT_MARKERS = ['Development mock verifier'];

/**
 * Public identifiers a person has accepted into the artefact (`DL-166`), by the sha256 of the
 * value: a Firebase web API key ships in the bundle by design, and is not a secret, but one
 * nobody recorded is one nobody classified. No key has been supplied, so the list is empty and
 * every Google API key in the artefact still fails.
 */
const ACCEPTED_PATH = 'tools/accepted-public-identifiers.json';
const acceptedFingerprints = new Set(
  (JSON.parse(readFileSync(join(ROOT, ACCEPTED_PATH), 'utf8')).identifiers ?? []).map((entry) => entry.sha256),
);
const fingerprint = (value) => createHash('sha256').update(value).digest('hex');

function bundleFiles(dir) {
  const out = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      out.push(...bundleFiles(full));
    } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
      out.push(full);
    }
  }

  return out;
}

let files;

try {
  files = bundleFiles(DIST);
} catch {
  console.error(
    '\nBundle check could not read dist/taytay-social-welfare/browser.\n\n' +
      '  Run `npm run build` first. This check deliberately inspects the artefact rather than the\n' +
      '  source, so it has nothing to say until one exists.\n',
  );
  process.exit(1);
}

if (files.length === 0) {
  console.error('\nBundle check found no JavaScript in the build output. Something is wrong with the build.\n');
  process.exit(1);
}

/*
 * WHICH ARTEFACT IS THIS?
 *
 * The development configuration serves the mock, so its bundle contains seed data **correctly**.
 * Run against that, the check would report "the mock reached a production build" — alarming,
 * wrong, and the fastest way to teach somebody that this check cries wolf.
 *
 * Production sets `outputHashing: all`, so its entry point is `main-<hash>.js` where the
 * development one is `main.js`. That is the cheapest honest signal available from the artefact
 * itself, which is the only thing this check is allowed to look at.
 */
// Either separator: on Windows the walked paths use '\', and a '/'-only pattern calls every
// production build a development one.
const isProductionArtefact = files.some((file) => /[\\/]main-[A-Z0-9]{8,}\.js$/i.test(file));

if (!isProductionArtefact) {
  console.error(
    '\nBundle check is looking at a development build, which serves the mock and therefore\n' +
      'contains seed data by design.\n\n' +
      '  Run `npm run build` (production) first. This check exists to inspect what ships.\n',
  );
  process.exit(1);
}

/**
 * Secrets, in the artefact rather than in the source (TAB 13 step 8).
 *
 * The repository scanner at `docs/integration/tools/secret-scan.php` reads git history and
 * **skips minified bundles** — reasonably, since a 1 MB line of transpiled JavaScript produces
 * nothing but false positives against a generic entropy rule.
 *
 * That leaves the one case TAB 13 names: *"including anything a build variable could have baked
 * in."* A static host's build variables are public, and a value read at build time is not in git
 * at all — it appears for the first time in the artefact, which is precisely where nothing was
 * looking.
 *
 * So these are **shaped** patterns rather than entropy: a bundle is full of high-entropy strings
 * that are hashes, and a check that cries wolf on those is a check somebody turns off.
 */
const GOOGLE_API_KEY = /\bAIza[0-9A-Za-z_-]{35}\b/g;

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bghp_[A-Za-z0-9]{36}\b/, 'a GitHub personal access token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'a GitHub fine-grained token'],
  [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}/, 'a Stripe secret key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [
    /(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)["']?\s*[:=]\s*["'][^"']{12,}["']/i,
    'something assigned to a credential-shaped name',
  ],
];

const failures = [];

{
  let verifier = '';

  try {
    verifier = readFileSync(join(ROOT, DEVELOPMENT_VERIFIER), 'utf8');
  } catch {
    // Reported below.
  }

  for (const marker of DEVELOPMENT_MARKERS) {
    if (!verifier.includes(marker)) {
      failures.push(
        `${DEVELOPMENT_VERIFIER} no longer contains the marker "${marker}".\n` +
          `    This check looks for it in the artefact; a marker nothing contains passes for ever.\n` +
          `    Keep the sentence, or move the marker to wording the file still has.`,
      );
    }
  }
}

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  for (const [key] of source.matchAll(GOOGLE_API_KEY)) {
    if (!acceptedFingerprints.has(fingerprint(key))) {
      failures.push(
        `${relative(ROOT, file)} contains a Google API key that nobody recorded in ${ACCEPTED_PATH}.\n` +
          `    A Firebase web API key is public by design, and is accepted by recording its fingerprint\n` +
          `    (sha256 ${fingerprint(key)}) once it is restricted in Google Cloud. Any other Google key is a leak.`,
      );
    }
  }

  for (const marker of DEVELOPMENT_MARKERS) {
    if (source.includes(marker)) {
      failures.push(
        `${relative(ROOT, file)} contains the development verifier's wording "${marker}".\n` +
          `    The local-api identity provider reached a production build. It composes credentials a\n` +
          `    mock-verifying backend accepts with any role; only angular.json's local-api replacement may bring it in.`,
      );
    }
  }

  for (const [pattern, description] of SECRET_PATTERNS) {
    if (pattern.test(source)) {
      failures.push(
        `${relative(ROOT, file)} contains ${description}.\n` +
          `    Build variables on a static host are public, and a value baked in at build time is\n` +
          `    not in git — so the repository scanner never sees it. This is the only place it shows.`,
      );
    }
  }

  for (const marker of SEED_MARKERS) {
    if (source.includes(marker)) {
      failures.push(
        `${relative(ROOT, file)} contains the seed marker "${marker}".\n` +
          `    The mock reached a production build. A tree-shaking assumption is not a guarantee —\n` +
          `    check what changed: a side effect in a seed module, a barrel re-export, or a build flag.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('\nBundle check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

const bytes = files.reduce((total, file) => total + statSync(file).size, 0);

console.log(
  `Bundle check passed (${files.length} files, ${(bytes / 1024).toFixed(0)} kB, ` +
    'no seed markers, no development verifier, no unrecorded or credential-shaped strings).',
);
