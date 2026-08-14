#!/usr/bin/env node
/**
 * Access-control repository audit.
 *
 * Three things that unit tests cannot see, because they are properties of the
 * repository rather than of a running component:
 *
 *   1. The permission matrix documentation still describes the permission
 *      vocabulary in code. Adding a permission and forgetting the table is the
 *      realistic drift, and it turns the office's reference into a lie.
 *   2. No self-registration surface has crept in (`DL-32`).
 *   3. No password or credential literal has been committed. The mock
 *      deliberately stores none, and that must stay true.
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

/* ── 1. Matrix documentation matches the vocabulary in code ──────────────── */

const permissionSource = read('src/app/domain/access/permission.ts');

// The PERMISSIONS array is a flat list of string literals, so it parses
// reliably; role keys come from the ROLE_DEFINITIONS record.
const permissionsBlock = permissionSource.slice(
  permissionSource.indexOf('export const PERMISSIONS'),
  permissionSource.indexOf('] as const;'),
);
const permissions = [...permissionsBlock.matchAll(/'([a-z-]+\.[a-z-]+)'/g)].map((m) => m[1]);

const roleBlock = permissionSource.slice(
  permissionSource.indexOf('export const ROLE_DEFINITIONS'),
  permissionSource.indexOf('export function permissionsForRole'),
);
const roles = [...roleBlock.matchAll(/^\s{2}'?([a-z-]+)'?:\s*\{$/gm)].map((m) => m[1]);

if (permissions.length === 0 || roles.length === 0) {
  problems.push('Could not parse PERMISSIONS or ROLE_DEFINITIONS — the matrix check is blind.');
}

const matrixDoc = read('docs/access/permission-matrix.md');

for (const permission of permissions) {
  if (!matrixDoc.includes(`\`${permission}\``)) {
    problems.push(
      `docs/access/permission-matrix.md does not list \`${permission}\`. A permission missing ` +
        'from the matrix means the office reference no longer describes the system.',
    );
  }
}

// And nothing in the doc that no longer exists in code.
for (const match of matrixDoc.matchAll(/^\| `([a-z-]+\.[a-z-]+)`/gm)) {
  if (!permissions.includes(match[1])) {
    problems.push(
      `docs/access/permission-matrix.md lists \`${match[1]}\`, which no longer exists in code.`,
    );
  }
}

for (const role of roles) {
  if (!matrixDoc.includes(`\`${role}\``)) {
    problems.push(`docs/access/permission-matrix.md does not describe the role \`${role}\`.`);
  }
}

const claimed = /(\d+) permissions × (\d+) roles/.exec(matrixDoc);
if (claimed && (Number(claimed[1]) !== permissions.length || Number(claimed[2]) !== roles.length)) {
  problems.push(
    `The matrix claims ${claimed[1]} permissions × ${claimed[2]} roles; code has ` +
      `${permissions.length} × ${roles.length}.`,
  );
}
notes.push(`matrix: ${permissions.length} permissions, ${roles.length} roles, doc in step`);

/* ── 2. No self-registration surface ─────────────────────────────────────── */

const sourceFiles = walk('src', new Set(['.ts', '.html']));
const REGISTRATION = /\b(signUp|createAccount|registerUser)\b|path:\s*'(register|sign-up|signup)'/;

let scanned = 0;
for (const file of sourceFiles) {
  if (file.includes('check-access')) continue;
  scanned += 1;
  const text = readFileSync(join(root, file), 'utf8');
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!REGISTRATION.test(line)) continue;
    // A line that names the absence is the point, not a breach.
    const context = text
      .split(/\r?\n/)
      .slice(Math.max(0, index - 3), index + 3)
      .join(' ');
    if (/\b(no|never|not|without|undefined|expect)\b/i.test(context)) continue;
    problems.push(
      `${file}:${index + 1} looks like a self-registration surface, which DL-32 forbids: ` +
        `"${line.trim().slice(0, 90)}"`,
    );
  }
}

/* ── 3. No committed credential ──────────────────────────────────────────── */

const CREDENTIAL = /\b(password|passwd|secret|apiKey|api_key|token)\s*[:=]\s*['"][^'"]{6,}['"]/i;
for (const file of sourceFiles) {
  if (file.includes('check-access')) continue;
  const text = readFileSync(join(root, file), 'utf8');
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!CREDENTIAL.test(line)) continue;
    // Test fixtures name their own nature; a real credential would not.
    if (/ANY_PASSWORD|a-password-of-sufficient-length|placeholder|example/i.test(line)) continue;
    problems.push(
      `${file}:${index + 1} looks like a committed credential: "${line.trim().slice(0, 80)}"`,
    );
  }
}
notes.push(`scanned ${scanned} source files for registration surfaces and credentials`);

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nAccess check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Access check passed.');
