#!/usr/bin/env node
/**
 * check:verification — residents' ID verification review keeps its two promises (`DL-167`).
 *
 * ## A person decides; the software does not
 *
 * Whether a selfie shows the person on a government ID is a judgement somebody makes, with a reason,
 * against their name. A match score, a confidence or a "looks valid" beside the button becomes the
 * decision the first busy afternoon: a surface in this console where a signal could turn
 * into a verdict — the sixth, after `DL-42`, `DL-60`, `DL-66`, `DL-78` and `DL-98`. So:
 *
 *   1. The verification model carries no decision-shaped field, and no file in the module exports a
 *      function that scores, matches or decides.
 *
 * ## The images are a government ID and a face
 *
 *   2. The model carries no ID number and no image address; the port hands out bytes (`Blob`), never
 *      a URL, and the http adapter reads them through `ApiClient.blob` — the bearer token in a
 *      header, never in an address.
 *   3. Object URLs are made only through the shared `ObjectUrls` holder — the one file that calls
 *      `URL.createObjectURL`, and which revokes what it made (`DL-168`). The review holds its own,
 *      makes the images' addresses with it, revokes them all, and does so on destroy.
 *   4. An image is fetched only from the warning's own button: `openImage` is called in exactly one
 *      method, and the template calls that method only inside the warning modal.
 *   5. Nothing in the module writes to storage or the console, and no template binds an image
 *      source to anything but an object URL the review made.
 *
 * ## The reader of a rejection is the resident
 *
 *   6. The rejection's reason is sent as the `notes` the API shows the resident, the form names that
 *      reader before anybody types, and what each decision does comes from the domain's one list.
 *   7. `verification.review` is the server's key, mutating, held by the system administrator alone,
 *      and the route asks for it.
 *
 * ## An approval says the ID shows the account's name (`DL-197`)
 *
 *   8. The port's `approve` takes a `ConfirmedIdentity` and the http adapter sends it back as
 *      `confirmed_name` and `confirmed_birthdate`; the review's approval carries a `confirmation`
 *      the reviewer must tick, which the shared `StatusTransition` holds its button for; the moves
 *      offered come from `reviewMovesFor`, so an account with no name cannot be approved; and the
 *      queue list never renders the account's name — it belongs beside the ID, not in a list
 *      anybody scrolls.
 *
 * Each rule was validated against a planted regression before being trusted.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src', 'app');
const read = (...segments) => readFileSync(join(...segments), 'utf8');
const shown = (file) => relative(ROOT, file).split(sep).join('/');

const failures = [];

const DOMAIN = join(APP, 'domain', 'verification', 'verification-request.ts');
const FEATURE = join(APP, 'features', 'verification');
const REVIEW = join(FEATURE, 'verification-review.ts');
const REVIEW_TEMPLATE = join(FEATURE, 'verification-review.html');
const OBJECT_URLS = join(APP, 'shared', 'media', 'object-urls.ts');
const MAPPER = join(APP, 'data', 'http', 'mappers', 'verification.mapper.ts');
const MOCK = join(APP, 'data', 'mock', 'mock-verification.repository.ts');
const SEED = join(APP, 'data', 'mock', 'seed', 'verification-requests.seed.ts');

for (const file of [DOMAIN, REVIEW, REVIEW_TEMPLATE, MAPPER, MOCK, SEED]) {
  if (!existsSync(file))
    failures.push(`${shown(file)} is missing, so nothing about it was checked.`);
}
if (failures.length > 0) report();

/** Comments explain these rules and must not trip them. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|html)$/.test(entry) && !entry.endsWith('.spec.ts')) out.push(path);
  }
  return out;
}

/** The body of `interface Name { … }`, or `null`. */
function interfaceBody(text, name) {
  const start = text.search(new RegExp(`export interface ${name}\\b[^{]*\\{`));
  if (start === -1) return null;
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  return null;
}

/** The body of a class method `name(` … its matching `}`. */
function methodBody(text, name) {
  const start = text.search(new RegExp(`\\n\\s+(?:protected |private |public )?${name}\\(`));
  if (start === -1) return null;
  const open = text.indexOf('{', text.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  return null;
}

const domain = code(read(DOMAIN));
const moduleFiles = [
  ...walk(FEATURE),
  DOMAIN,
  MAPPER,
  MOCK,
  SEED,
  join(APP, 'data', 'http', 'http-repositories.ts'),
].filter((file) => existsSync(file));

/* ── 1. no verdict of the software's own ─────────────────────────────────── */

const DECISION_FIELD =
  /\b(\w*(?:score|confidence|match|likel|eligib|recommend|suggest|verdict|valid|genuine|fraud|risk|auto)\w*)\??\s*:/i;
const IDENTIFYING_FIELD = /\b(\w*(?:number|url|uri|href|src|link|address)\w*)\??\s*:/i;

for (const name of ['VerificationRequest', 'VerificationImages']) {
  const body = interfaceBody(domain, name);
  if (body === null) {
    failures.push(
      `interface ${name} could not be read from the domain, so its fields were not checked.`,
    );
    continue;
  }
  for (const line of body.split('\n')) {
    const decision = DECISION_FIELD.exec(line);
    if (decision !== null) {
      failures.push(
        `${name}.${decision[1]} is decision-shaped. A person decides whether a selfie is the person on ` +
          `the ID; a number beside the button becomes the decision (DL-167).`,
      );
    }
    const identifying = IDENTIFYING_FIELD.exec(line);
    if (identifying !== null) {
      failures.push(
        `${name}.${identifying[1]} names an ID number or an image address. Images are bytes read through ` +
          `the data layer after a warning; a number or a URL on the model is one paste from a log.`,
      );
    }
  }
}

const DECIDING_FUNCTION =
  /export (?:async )?function (\w*(?:auto(?:Approve|Reject|Decide)|score|match|confidence|suggest|recommend|verdict|compareFaces|faceMatch)\w*)\s*\(/i;
for (const file of moduleFiles) {
  const found = DECIDING_FUNCTION.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) {
    failures.push(
      `${shown(file)} exports ${found[1]}(), which decides or scores a verification. A person decides.`,
    );
  }
}

/* ── 2. bytes, never addresses ───────────────────────────────────────────── */

const ports = code(read(APP, 'domain', 'ports', 'repositories.ts'));
const port = interfaceBody(ports, 'VerificationRepository');

if (port === null) {
  failures.push('VerificationRepository could not be read, so its methods were not checked.');
} else {
  if (!/openImage\([^)]*\):\s*Observable<Blob>;/.test(port)) {
    failures.push(
      'VerificationRepository.openImage must answer Observable<Blob>: bytes, never an address.',
    );
  }
  if (/Observable<string>|:\s*string;/.test(port)) {
    failures.push(
      'VerificationRepository answers a string somewhere. An image address is not a thing a port hands out.',
    );
  }
}

const adapters = code(read(APP, 'data', 'http', 'http-repositories.ts'));
const httpClass = /export class HttpVerificationRepository[\s\S]*?\n}\n/.exec(adapters)?.[0] ?? '';

if (httpClass === '') {
  failures.push('HttpVerificationRepository could not be read from http-repositories.ts.');
} else {
  if (
    !/this\s*\.\s*api\s*\.\s*blob\s*\(\s*`\$\{API_ENDPOINTS\.media\}\/\$\{\w+\}\/content`\s*\)/.test(
      httpClass,
    )
  ) {
    failures.push(
      'HttpVerificationRepository.openImage must read GET media/{id}/content through ApiClient.blob.',
    );
  }
  if (/\btoken\b|\?access_token|createObjectURL/i.test(httpClass)) {
    failures.push(
      'HttpVerificationRepository names a token or makes an object URL. It hands bytes to the screen and nothing else.',
    );
  }
}

/* ── 3. object URLs come from the one holder, and are revoked ───────────── */

const reviewCode = code(read(REVIEW));
const holderCode = code(read(OBJECT_URLS));

/*
 * The holder (`DL-168`) is shared by every screen that shows fetched bytes, so its promise is
 * checked here as well as in `check:inbox`: it is the only maker, and it revokes what it made.
 */
for (const file of walk(APP).filter((f) => f !== OBJECT_URLS && !f.endsWith('.spec.ts'))) {
  if (/URL\s*\.\s*createObjectURL/.test(code(readFileSync(file, 'utf8')))) {
    failures.push(
      `${shown(file)} makes an object URL itself. Only ObjectUrls does, so one place revokes them all.`,
    );
  }
}
if (
  !/URL\s*\.\s*createObjectURL/.test(methodBody(holderCode, 'make') ?? '') ||
  !/URL\s*\.\s*revokeObjectURL/.test(methodBody(holderCode, 'revokeAll') ?? '')
) {
  failures.push('ObjectUrls must make object URLs in make() and revoke them in revoke() and revokeAll().');
}
if (!/new\s+ObjectUrls\(\)/.test(reviewCode) || !/this\s*\.\s*objectUrls\s*\.\s*make\(/.test(reviewCode)) {
  failures.push(
    'The review does not make its images’ addresses with its own ObjectUrls, so this check ' +
      'cannot vouch for how they are shown.',
  );
}
if (!/this\s*\.\s*objectUrls\s*\.\s*revokeAll\(\)/.test(reviewCode)) {
  failures.push(
    'The review never revokes its object URLs. A government ID would outlive the review in memory.',
  );
}
if (
  !/destroyRef\s*\.\s*onDestroy\(\s*\(\)\s*=>\s*this\s*\.\s*discardImages\(\)\s*\)/.test(reviewCode)
) {
  failures.push(
    'The review does not discard its images on destroy. Closing the review or leaving the page must revoke them.',
  );
}

/* ── 4. fetched only from the warning's own button ───────────────────────── */

const featureCode = walk(FEATURE)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => ({ file, text: code(readFileSync(file, 'utf8')) }));
const openCalls = featureCode.flatMap(({ file, text }) =>
  [...text.matchAll(/\.\s*openImage\s*\(/g)].map(() => file),
);
const confirmBody = methodBody(reviewCode, 'confirmOpen') ?? '';

if (openCalls.length === 0) {
  failures.push(
    'No screen calls openImage, so this check cannot vouch for when images are fetched.',
  );
} else if (
  openCalls.some((file) => file !== REVIEW) ||
  [...confirmBody.matchAll(/\.\s*openImage\s*\(/g)].length !== openCalls.length
) {
  failures.push(
    'openImage is called outside VerificationReview.confirmOpen. Images are fetched only after the warning.',
  );
}

const template = read(REVIEW_TEMPLATE);
const modal = /<app-modal[\s\S]*?<\/app-modal>/.exec(template)?.[0] ?? '';
const confirmCalls = [...template.matchAll(/confirmOpen\(\)/g)].length;

if (
  modal === '' ||
  confirmCalls === 0 ||
  [...modal.matchAll(/confirmOpen\(\)/g)].length !== confirmCalls
) {
  failures.push(
    'confirmOpen() is reachable from outside the warning modal. The warning comes before the images, every time.',
  );
}
if (
  /\(click\)="confirmOpen\(\)"/.test(template.replace(modal, '')) ||
  /ngOnInit|afterNextRender/.test(reviewCode)
) {
  failures.push('The review opens images without the warning, or on load.');
}

/* ── 5. no storage, no console, no other image source ────────────────────── */

const LEAK =
  /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|caches\s*\.\s*open|console\s*\.\s*\w+)\b/;
for (const file of moduleFiles) {
  const found = LEAK.exec(code(readFileSync(file, 'utf8')));
  if (found !== null) {
    failures.push(
      `${shown(file)} uses ${found[1]}. Nothing about a resident's ID is stored or logged.`,
    );
  }
}

for (const file of walk(FEATURE).filter((f) => f.endsWith('.html'))) {
  const text = readFileSync(file, 'utf8');
  for (const [, binding, value] of text.matchAll(/(\[src\]|\[attr\.src\]|\ssrc)="([^"]*)"/g)) {
    if (!(binding === '[src]' && value === 'image.url')) {
      failures.push(
        `${shown(file)} binds ${binding}="${value}". An image here is an object URL the review made, nothing else.`,
      );
    }
  }
}
for (const { file, text } of featureCode) {
  if (/APP_ENVIRONMENT|apiBaseUrl|API_ENDPOINTS/.test(text)) {
    failures.push(
      `${shown(file)} can build an API address. A screen reaches an image only through the port.`,
    );
  }
}

/* ── 6. the resident reads a rejection ───────────────────────────────────── */

if (!/reject\([^)]*\)[\s\S]*?\{\s*notes:\s*reason\s*\}/.test(httpClass)) {
  failures.push(
    'HttpVerificationRepository.reject must send the reason as notes — what the API shows the resident.',
  );
}

const copy = read(FEATURE, 'verification.copy.ts');
if (!/rejectLabel:\s*'[^']*resident[^']*'/i.test(copy)) {
  failures.push(
    "The rejection reason's label does not name the resident. Whoever types it must know who reads it.",
  );
}
if (
  !/rejected:\s*\{[\s\S]*?consequences:\s*VERIFICATION_DECISION_EFFECTS\.rejected/.test(
    reviewCode,
  ) ||
  !/approved:\s*\{[\s\S]*?consequences:\s*VERIFICATION_DECISION_EFFECTS\.approved/.test(reviewCode)
) {
  failures.push(
    "A decision's consequences must come from VERIFICATION_DECISION_EFFECTS, the domain's one sourced list.",
  );
}
if (
  !/approved:\s*\[[\s\S]*?verified[\s\S]*?digital ID[\s\S]*?\],\s*rejected:\s*\[[\s\S]*?resident reads/.test(
    domain,
  )
) {
  failures.push(
    'VERIFICATION_DECISION_EFFECTS no longer says approval verifies the account and issues a digital ID, or that the resident reads a rejection.',
  );
}

/* ── 8. an approval says the ID shows the account's name ─────────────────── */

if (!/approve\(\s*id:\s*VerificationRequestId,\s*note:\s*string,\s*confirmed:\s*ConfirmedIdentity,?\s*\)/.test(port)) {
  failures.push(
    "VerificationRepository.approve does not take the ConfirmedIdentity the reviewer checked (DL-197).",
  );
}
if (
  !/approve\([\s\S]*?confirmed_name:\s*confirmed\s*\.\s*name,\s*confirmed_birthdate:\s*confirmed\s*\.\s*birthDate/.test(
    httpClass,
  )
) {
  failures.push(
    'HttpVerificationRepository.approve must send back confirmed_name and confirmed_birthdate, which the API compares with the account.',
  );
}
if (!/approved:\s*\{[\s\S]*?confirmation:\s*\{[\s\S]*?\},?\s*\)?,?\s*\},\s*rejected:/.test(reviewCode)) {
  failures.push(
    "The review's approval carries no confirmation to tick. Approving says the ID shows the account's name (DL-197).",
  );
}
if (!/moves\s*=\s*computed\(\(\)\s*=>\s*reviewMovesFor\(/.test(reviewCode)) {
  failures.push(
    'The review offers moves that do not come from reviewMovesFor, so an account with no name could be approved.',
  );
}
const transition = code(read(APP, 'shared', 'cases', 'status-transition.ts'));
if (!/canConfirm\s*=\s*computed\([\s\S]*?this\s*\.\s*confirmationOk\s*\(\s*\)[\s\S]*?\);/.test(transition)) {
  failures.push(
    "StatusTransition's button no longer waits for a destination's confirmation to be ticked.",
  );
}
const queueTemplate = read(FEATURE, 'verification-queue-page.html');
if (/\baccount\b|accountName|identity/.test(queueTemplate)) {
  failures.push(
    "The queue list renders what the account gives. The name is shown in a review, beside the ID it is checked against (DL-197).",
  );
}

/* ── 7. one key, the server's, held by the administrator alone ───────────── */

const permission = code(read(APP, 'domain', 'access', 'permission.ts'));
const vocabulary = permission.slice(
  permission.indexOf('export const PERMISSIONS'),
  permission.indexOf('] as const;'),
);
// Everything after the vocabulary: the role definitions and the shared lists they spread, which a
// slice from ROLE_DEFINITIONS would miss (INTAKE_PERMISSIONS is declared above it).
const roles = permission.slice(permission.indexOf('] as const;'));
const readOnly = code(read(APP, 'domain', 'access', 'permission-matrix.ts'));

if (!vocabulary.includes("'verification.review'")) {
  failures.push("PERMISSIONS does not hold 'verification.review', the API's own key.");
}
if (
  /'verification\.review'/.test(roles) ||
  /'verification\.review'/.test(permission.slice(0, permission.indexOf('export const PERMISSIONS')))
) {
  failures.push(
    "A role lists 'verification.review' by name. The API grants it to administrators alone; only the system administrator, who holds every key, may.",
  );
}
if (/verification\.review/.test(readOnly)) {
  failures.push(
    "'verification.review' is classified read-only. It approves or rejects an identity.",
  );
}
if (
  !/path:\s*'verification',[\s\S]*?canActivate:\s*\[servedGuard\('verification'\),\s*permissionGuard\('verification\.review'\)\]/.test(
    read(APP, 'app.routes.ts'),
  )
) {
  failures.push(
    "The /verification route does not ask for servedGuard('verification') and permissionGuard('verification.review').",
  );
}

report();

function report() {
  if (failures.length > 0) {
    console.error(`\nVerification check FAILED (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }
  console.log(
    `Verification check passed (${moduleFiles.length} files: no verdict, no address, images only after the warning, ` +
      "revoked on leave, the resident named as a rejection's reader, the account's name confirmed against the ID).",
  );
}
