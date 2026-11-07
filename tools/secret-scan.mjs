#!/usr/bin/env node
/**
 * scan:secrets — full-history secret scan of this repository.
 *
 * The Node port of `docs/integration/tools/secret-scan.php`, which was removed on 2026-11-07
 * because CLAUDE.md rule 1 allows no PHP in this repository. Same rules, same allowlist, same
 * output; the port was checked against the PHP version on a planted repository before the PHP
 * file went (evidence ledger, "The secret scanner is Node now").
 *
 * ## What it reads
 *
 * Every blob **reachable from any ref** — the whole history, not just the working tree. It asks
 * git for `rev-list --objects --all` and feeds that list to `cat-file --batch --buffer`, the same
 * pipeline the PHP version was fed by hand.
 *
 * Deliberately NOT `--batch-all-objects`. That also yields dangling objects left by aborted
 * operations, `git add` followed by a reset, and rebases: blobs no commit references, which can
 * never be pushed and which no history rewrite would remove. Reporting them produces alarms
 * nobody can action, and an alarm nobody can action is how a gate stops being read.
 *
 * Binary blobs (any NUL byte) and blobs over 1,500,000 bytes (lockfiles, images, minified
 * bundles) are counted and skipped. `check:bundle` covers the built artefact.
 *
 * ## Accepted findings
 *
 * A scanner with no way to accept a finding is a scanner that is permanently red, and a gate
 * that is permanently red is one everybody learns to ignore — which is worse than not having
 * it. The alternative people reach for is weakening the pattern, which blinds the scanner to
 * the real thing as well. So the patterns stay sharp and each accepted hit is listed by
 * `rule|path`, with a reason a reviewer wrote, in `docs/integration/secret-scan-allowlist.txt`.
 *
 * ## Byte semantics
 *
 * The PHP version ran PCRE on raw bytes, without UTF-8 mode. Every byte is read here as one
 * latin1 character and written back the same way, and `\s` is spelled out as PCRE's own set
 * (tab, LF, VT, FF, CR, space), because a JavaScript `\s` also matches a no-break space. A path
 * or a match with non-ASCII bytes therefore prints exactly as the PHP version printed it.
 *
 * Usage:
 *   npm run scan:secrets
 *   node tools/secret-scan.mjs [repo] [allowlist]
 *
 * `repo` defaults to `.`, and the allowlist to `docs/integration/secret-scan-allowlist.txt`,
 * relative to the current directory. Exit 0 when nothing unaccepted is found, 1 when something
 * is, 2 when git cannot be run. The PHP version always exited 0. Not part of `npm run verify`:
 * it reads all of history, and it is run before a push.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const repo = process.argv[2] ?? '.';
const allowFile = process.argv[3] ?? 'docs/integration/secret-scan-allowlist.txt';

const LARGEST_SCANNED = 1_500_000;

/** PHP's `file($f, FILE_IGNORE_NEW_LINES)`: split on LF, drop one CR before it, no final empty. */
function phpLines(text, skipEmpty) {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const out = [];
  for (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (skipEmpty && line === '') continue;
    out.push(line);
  }
  return out;
}

/** PHP's `trim()`, which strips fewer characters than `String.prototype.trim`. */
const phpTrim = (s) => s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');

function readLatin1(path) {
  try {
    return readFileSync(path).toString('latin1');
  } catch {
    return null;
  }
}

const allowed = new Set();
const allowText = existsSync(allowFile) ? readLatin1(allowFile) : null;
if (allowText !== null) {
  for (const line of phpLines(allowText, true)) {
    if (phpTrim(line).startsWith('#')) continue;
    const key = phpTrim(line.split('#', 1)[0] ?? '');
    if (key !== '') allowed.add(key);
  }
}

const listed = spawnSync('git', ['-C', repo, 'rev-list', '--objects', '--all'], {
  maxBuffer: 256 * 1024 * 1024,
});
if (listed.error !== undefined || listed.status !== 0) {
  process.stderr.write(`secret-scan: git rev-list failed in ${repo}\n`);
  process.exit(2);
}

/** sha → paths, in the order git first named them. */
const paths = new Map();
const shas = [];
for (const line of phpLines(listed.stdout.toString('latin1'), false)) {
  const first = line.trimStart().split(/[ \t]+/, 1)[0] ?? '';
  if (first !== '') shas.push(first);
  const sp = line.indexOf(' ');
  if (sp === -1) continue;
  const sha = line.slice(0, sp);
  const p = line.slice(sp + 1);
  if (p === '') continue;
  if (!paths.has(sha)) paths.set(sha, new Set());
  paths.get(sha)?.add(p);
}

const WS = '[\\t\\n\\x0B\\f\\r ]';
const NOT_WS = '\\t\\n\\x0B\\f\\r ';

const PATTERNS = [
  ['private-key', new RegExp('-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----', 'g')],
  ['aws-access-key-id', new RegExp('\\b(?:AKIA|ASIA)[0-9A-Z]{16}\\b', 'g')],
  ['google-api-key', new RegExp('\\bAIza[0-9A-Za-z_\\-]{35}\\b', 'g')],
  [
    'github-token',
    new RegExp('\\bgh[pousr]_[A-Za-z0-9]{36}\\b|\\bgithub_pat_[A-Za-z0-9_]{22,}', 'g'),
  ],
  ['slack-token', new RegExp('\\bxox[abprs]-[A-Za-z0-9-]{10,}', 'g')],
  ['stripe-live-key', new RegExp('\\bsk_live_[A-Za-z0-9]{20,}', 'g')],
  [
    'jwt',
    new RegExp('\\beyJ[A-Za-z0-9_\\-]{10,}[.][A-Za-z0-9_\\-]{10,}[.][A-Za-z0-9_\\-]{10,}', 'g'),
  ],
  [
    'dsn-with-password',
    new RegExp(
      `\\b(?:postgres|postgresql|mysql|redis|mongodb)(?:\\+srv)?://[^:${NOT_WS}/@]+:[^@${NOT_WS}]+@`,
      'g',
    ),
  ],
  ['laravel-app-key', new RegExp('base64:[A-Za-z0-9+/]{40,}={0,2}', 'g')],
  ['gcp-service-account', new RegExp(`"private_key_id"${WS}*:`, 'g')],
  [
    'assigned-secret',
    new RegExp(
      '\\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret)\\b' +
        `${WS}*[:=]>?${WS}*['"]([^'"${NOT_WS}]{8,})['"]`,
      'gi',
    ),
  ],
];

// Values that are obviously not live credentials.
const PLACEHOLDER =
  /^(?:your[-_].*|change[-_]?me|example.*|placeholder.*|xxx+|\.{3,}|null|true|false|secret|password|passw0rd|s3cret|test.*|dummy.*|fake.*|sample.*|redacted.*|<.*>|\$\{.*\}|%s|.*_here|base64:.{0,10})$/i;

const findings = new Map();
const accepted = new Set();
let blobs = 0;
let scanned = 0;

function inspect(sha, type, size, content) {
  if (type !== 'blob') return;
  blobs++;
  if (size > LARGEST_SCANNED || content === null) return;
  if (content.includes('\0')) return;
  scanned++;

  for (const [name, re] of PATTERNS) {
    for (const m of content.matchAll(re)) {
      const hit = m[0];
      const value = m[1] ?? hit;
      if (name === 'assigned-secret' && PLACEHOLDER.test(value)) continue;
      const line = content.slice(0, m.index).split('\n').length;
      const named = paths.get(sha);
      const where = named !== undefined ? [...named].join(', ') : '(unreferenced blob)';
      const key = `${name}|${where}|${hit.slice(0, 60)}`;
      if (findings.has(key)) continue;
      if (allowed.has(`${name}|${where}`)) {
        accepted.add(`${name}|${where}`);
        continue;
      }
      findings.set(key, {
        rule: name,
        path: where,
        blob: sha.slice(0, 10),
        line,
        match: hit.replace(new RegExp(`${WS}+`, 'g'), ' ').slice(0, 100),
      });
    }
  }
}

/**
 * Reads `git cat-file --batch` output as it arrives: a header line `<sha> <type> <size>`, the
 * object's bytes, then one newline. Only a blob small enough to scan is held in memory.
 */
function readBatch(stream) {
  return new Promise((resolve, reject) => {
    let mode = 'header';
    let headerParts = [];
    let sha = '';
    let type = '';
    let size = 0;
    let need = 0;
    let body = null;

    const finish = () => {
      inspect(sha, type, size, body === null ? null : Buffer.concat(body).toString('latin1'));
      body = null;
      mode = 'header';
    };

    stream.on('data', (chunk) => {
      let i = 0;
      while (i < chunk.length) {
        if (mode === 'header') {
          const nl = chunk.indexOf(10, i);
          if (nl === -1) {
            headerParts.push(chunk.subarray(i));
            return;
          }
          headerParts.push(chunk.subarray(i, nl));
          i = nl + 1;
          const header = Buffer.concat(headerParts).toString('latin1');
          headerParts = [];
          if (header === '') continue;
          const parts = header.split(' ');
          if (parts.length < 3) continue;
          sha = parts[0] ?? '';
          type = parts[1] ?? '';
          const parsed = Number.parseInt(parts[2] ?? '', 10);
          size = Number.isNaN(parsed) ? 0 : parsed;
          need = size;
          body = type === 'blob' && size <= LARGEST_SCANNED ? [] : null;
          mode = need > 0 ? 'body' : 'trailer';
        } else if (mode === 'body') {
          const take = Math.min(need, chunk.length - i);
          body?.push(chunk.subarray(i, i + take));
          i += take;
          need -= take;
          if (need === 0) mode = 'trailer';
        } else {
          const nl = chunk.indexOf(10, i);
          if (nl === -1) return;
          i = nl + 1;
          finish();
        }
      }
    });
    stream.on('end', () => {
      if (mode !== 'header') finish();
      resolve();
    });
    stream.on('error', reject);
  });
}

const batch = spawn('git', ['-C', repo, 'cat-file', '--batch', '--buffer'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});
const exited = new Promise((resolve) => {
  batch.on('error', () => resolve(-1));
  batch.on('close', (code) => resolve(code ?? -1));
});
batch.stdin.end(shas.length > 0 ? `${shas.join('\n')}\n` : '');
await readBatch(batch.stdout);
if ((await exited) !== 0) {
  process.stderr.write(`secret-scan: git cat-file failed in ${repo}\n`);
  process.exit(2);
}

let out = `repo: ${repo}\n`;
out += `blobs seen: ${blobs}   text blobs scanned: ${scanned}\n`;
out += `accepted (reviewed, in the allowlist): ${accepted.size}\n`;
out += `findings: ${findings.size}\n`;
if (findings.size > 0) {
  out += `${'-'.repeat(100)}\n`;
  for (const f of findings.values()) {
    out += `[${f.rule}] ${f.path}:${f.line} (blob ${f.blob})\n    ${f.match}\n`;
  }
}
process.stdout.write(Buffer.from(out, 'latin1'));
process.exitCode = findings.size > 0 ? 1 : 0;
