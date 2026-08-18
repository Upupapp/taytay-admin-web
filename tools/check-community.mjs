#!/usr/bin/env node
/**
 * Newsfeed and Events scope guardrail.
 *
 * The late-phase command's acceptance criteria are that TABs 01–23 keep
 * working, that unauthorised admin users cannot execute restricted actions,
 * that **no resident Angular portal or mobile interface is added**, and that
 * **no duplicate permission architecture is introduced**.
 *
 * The last two are the ones a codebase drifts into rather than decides, so most
 * of this file is about them:
 *
 *   1. **One RBAC** (`DL-122`). Newsfeed and Events keys live in the existing
 *      `PERMISSIONS` array, in the naming that array already uses.
 *   2. **No resident UI** (`DL-123`). The resident contract is types only —
 *      no component, no route, no template, anywhere.
 *   3. **A resident may never publish.** The capability list is reads and
 *      responses; every admin key it refuses is named.
 *   4. **One audit vocabulary.** The new seams extend `AuditAction`.
 *   5. **The additions are additive** — no nav entry points at nothing, and
 *      the sidebar was not reorganised.
 *
 * Exit 0 = clean, 1 = at least one violation.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const walk = (dir, exts) => {
  const out = [];
  if (!existsSync(join(root, dir))) return out;
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel, exts));
    else if (exts.has(extname(entry))) out.push(rel);
  }
  return out;
};

const block = (text, pattern, what) => {
  const found = pattern.exec(text)?.[0] ?? '';
  if (found === '') problems.push(`${what} has gone.`);
  return found;
};

const permissions = read('src/app/domain/access/permission.ts');
const matrix = read('src/app/domain/access/permission-matrix.ts');
const audit = read('src/app/domain/shared/audit.ts');
const contract = read('src/app/domain/community/resident-contract.ts');
const navigation = read('src/app/core/navigation/navigation.ts');
const routes = read('src/app/app.routes.ts');

const NEWSFEED_KEYS = [
  'newsfeed.view',
  'newsfeed.create',
  'newsfeed.edit',
  'newsfeed.publish',
  'newsfeed.schedule',
  'newsfeed.archive',
  'newsfeed.pin',
  'newsfeed.moderate',
  'newsfeed.view-insights',
];

const EVENT_KEYS = [
  'event.view',
  'event.create',
  'event.edit',
  'event.publish',
  'event.cancel',
  'event.archive',
  'event.manage-registrations',
  'event.export-registrants',
  'event.mark-attendance',
  'event.view-insights',
];

/* ── 1. One RBAC ─────────────────────────────────────────────────────────── */

// Scoped to the union, not the file: a role grant below names the same keys,
// and a file-wide search passes while the permission itself is gone.
const permissionUnion = block(
  permissions,
  /export const PERMISSIONS = \[[\s\S]*?\n\] as const;/,
  'PERMISSIONS',
);
for (const key of [...NEWSFEED_KEYS, ...EVENT_KEYS]) {
  if (!permissionUnion.includes(`'${key}'`)) {
    problems.push(
      `${key} is not in the central PERMISSIONS array. The late-phase command is explicit that ` +
        'the existing model is extended and no second RBAC is introduced — and `check:access` ' +
        'only sees keys that live there (DL-122).',
    );
  }
}
// One array, one naming convention.
for (const [, key] of permissionUnion.matchAll(/'([a-z][a-z.\-_]*)'/g)) {
  if (key.includes('_')) {
    problems.push(
      `The permission '${key}' uses snake_case. Every other key here is kebab-case, and one ` +
        'array with two conventions is one nobody can predict (DL-122).',
    );
  }
}

// A second permission array anywhere would be invisible to `check:access`.
for (const file of walk('src/app/domain', new Set(['.ts']))) {
  if (file.endsWith(join('access', 'permission.ts'))) continue;
  if (file.includes('.spec.')) continue;
  const text = read(file);
  // `NAME: readonly string[] = [` has no space before the colon, and an
  // earlier version of this pattern required one — so a second array
  // declared the ordinary way slipped straight past it.
  if (/export const \w*PERMISSIONS\w*\s*(?::[^=;]*)?=\s*\[/.test(text)) {
    problems.push(
      `${file} declares its own permission array. There is one permission model, and the office ` +
        'reference is generated from it (DL-122).',
    );
  }
}
notes.push(`rbac: ${NEWSFEED_KEYS.length + EVENT_KEYS.length} keys in the one array, kebab-case`);

/* ── 2. No resident UI ───────────────────────────────────────────────────── */

// The command says the admin portal may define typed interfaces for the
// resident app and must not implement it. A component, template or route is
// an implementation.
const RESIDENT_UI = /\b(residentPortal|ResidentPortal|resident-app|ResidentApp|resident-portal)\b/;
for (const file of walk('src/app', new Set(['.ts', '.html']))) {
  if (file.includes('.spec.')) continue;
  const text = read(file);
  if (RESIDENT_UI.test(text)) {
    problems.push(`${file} looks like a resident-facing surface. Only contracts belong here (DL-123).`);
  }
}
for (const file of walk('src/app/domain/community', new Set(['.ts', '.html', '.scss']))) {
  if (file.includes('.spec.')) continue;
  if (extname(file) !== '.ts') {
    problems.push(`${file}: the community boundary is types only — no template, no stylesheet.`);
  }
  if (/@Component\(/.test(read(file))) {
    problems.push(`${file} declares a component. The resident app is built elsewhere (DL-123).`);
  }
}
if (existsSync(join(root, 'src/app/features/resident'))) {
  problems.push('A resident feature folder exists. No resident portal belongs in this repository.');
}
notes.push('resident app: contracts only, no component, template or route');

/* ── 3. A resident may never publish ─────────────────────────────────────── */

const capabilityUnion = block(
  contract,
  /export type ResidentCapability =[\s\S]*?;/,
  'ResidentCapability',
);
const capabilities = [...capabilityUnion.matchAll(/'([a-z.\-]+)'/g)].map((match) => match[1]);
const FORBIDDEN_VERBS = /(create|edit|publish|schedule|archive|pin|moderate|cancel|manage|export|attendance|insights)/;
for (const capability of capabilities) {
  if (FORBIDDEN_VERBS.test(capability)) {
    problems.push(
      `Residents were given '${capability}'. A resident capability that could publish would let ` +
        'somebody post under the MSWDO’s masthead, which is a different kind of harm from any ' +
        'this application otherwise guards against (DL-123).',
    );
  }
}

const mustNever = block(
  contract,
  /export const RESIDENT_MUST_NEVER: readonly string\[\] = \[[\s\S]*?\n\];/,
  'RESIDENT_MUST_NEVER',
);
for (const key of [...NEWSFEED_KEYS, ...EVENT_KEYS]) {
  if (key === 'newsfeed.view' || key === 'event.view') continue;
  if (!mustNever.includes(`'${key}'`)) {
    problems.push(
      `RESIDENT_MUST_NEVER does not name ${key}. Listing every refused key is what makes an ` +
        'addition delete a line rather than slip past review (DL-123).',
    );
  }
}

// The resident's view of a post must not name the member of staff who pressed
// publish, and the event view must not count who signed up.
const postView = block(contract, /export interface ResidentPostView\s*\{[\s\S]*?\n\}/, 'ResidentPostView');
for (const leak of ['publishedByStaffId', 'authorAccount', 'authorId', 'staffId']) {
  if (postView.includes(leak)) {
    problems.push(`ResidentPostView names a member of staff (${leak}). A resident sees an office.`);
  }
}
const eventView = block(contract, /export interface ResidentEventView\s*\{[\s\S]*?\n\}/, 'ResidentEventView');
if (/registrationCount|attendeeList|registrants/.test(eventView)) {
  problems.push(
    'ResidentEventView tells a resident how many neighbours registered. A low count on a ' +
      'sensitive service is disclosive in a municipality this size.',
  );
}
notes.push(`resident capabilities: ${capabilities.length}, all reads or responses`);

/* ── 4. One audit vocabulary ─────────────────────────────────────────────── */

const actionUnion = block(audit, /export type AuditAction =[\s\S]*?;/, 'AuditAction');
const REQUIRED_SEAMS = [
  'published',
  'scheduled',
  'archived',
  'pinned',
  'comment-hidden',
  'comment-restored',
  'comment-replied',
  'cancelled',
  'registration-changed',
  'attendance-changed',
];
for (const seam of REQUIRED_SEAMS) {
  if (!actionUnion.includes(`'${seam}'`)) {
    problems.push(
      `The audit seam '${seam}' has gone. The command names publishing, moderation, registration ` +
        'and attendance as the acts that must be recordable.',
    );
  }
}
// And every one must have a label, or the explorer renders a bare key.
const labels = block(
  read('src/app/domain/governance/audit-view.ts'),
  /export const AUDIT_ACTION_LABELS[\s\S]*?\n\};/,
  'AUDIT_ACTION_LABELS',
);
for (const seam of REQUIRED_SEAMS) {
  const quoted = seam.includes('-') ? `'${seam}'` : seam;
  if (!new RegExp(`${quoted}:`).test(labels)) {
    problems.push(`The audit action '${seam}' has no label, so the trail would render a bare key.`);
  }
}
notes.push(`audit: ${REQUIRED_SEAMS.length} new seams on the one action vocabulary`);

/* ── 5. Additive, and nothing points at nothing ──────────────────────────── */

for (const [, route] of navigation.matchAll(/route: '(\/[a-z-]+)'/g)) {
  if (!new RegExp(`path: '${route.slice(1)}'`).test(routes)) {
    problems.push(
      `The navigation offers ${route} and no route answers it. A nav entry pointing at nothing is ` +
        'the one thing the routing file has never allowed.',
    );
  }
}
// The route segment is plural and the permission resource is singular: every
// other resource in both vocabularies is singular, and TAB 03 made `events.*`
// stop being the outlier. The URL did not change — a bookmarked link is a
// promise to a caseworker, and renaming a permission is no reason to break one.
for (const [module, resource] of [
  ['newsfeed', 'newsfeed'],
  ['events', 'event'],
]) {
  if (!new RegExp(`route: '/${module}'`).test(navigation)) {
    problems.push(`The ${module} module has no navigation entry.`);
  }
  if (!new RegExp(`permissionGuard\\('${resource}\\.view'\\)`).test(routes)) {
    problems.push(`The ${module} route is not guarded by ${resource}.view.`);
  }
}
// The existing sections must survive: the command said place them naturally,
// not reorganise the sidebar.
for (const section of ['Casework', 'Delivery', 'Administration']) {
  if (!new RegExp(`title: '${section}'`).test(navigation)) {
    problems.push(
      `The '${section}' navigation section has gone. The late-phase command adds modules; it does ` +
        'not reorganise what is already there.',
    );
  }
}
notes.push('navigation: two modules added, four sections intact, every entry routed and guarded');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nCommunity scope check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Community scope check passed.');
