#!/usr/bin/env node
/**
 * The checks that check the checkers.
 *
 * ## What went wrong
 *
 * `check:routes` walked `/this\.api\.(\w+)\s*[<(]/` — the dot contiguous on both sides. Every call
 * written as
 *
 *     return this.api
 *       .item<Foo>(API_ENDPOINTS.bar)
 *       .pipe(map(toFoo));
 *
 * — the shape Prettier produces the moment a chain wraps — matched nothing. Three adapter methods
 * were added and the composed-path count did not move by one. They were not reported as unwired;
 * they were never seen.
 *
 * That is the worst possible failure for a ratchet. An unwired path that gets *reported* is a
 * finding. A path absent from both sides of the comparison is a green number about a surface
 * nothing is reading, and it stays green for as long as nobody thinks to re-derive it by hand.
 *
 * Four tools had the same pattern. Thirteen calls were invisible across them; eleven happened to be
 * fine, which is luck, and two were real pre-existing debt — an unmapped read and a filter key the
 * API silently ignores — hidden for as long as the blind spot had existed.
 *
 * ## What this enforces
 *
 * A regex that scans **source code for a call on an object** may not weld the dots or the paren.
 * `this\.api\.post\(` must be written `this\s*\.\s*api\s*\.\s*post\s*\(`, because the
 * source it reads is Prettier-formatted and a long chain wraps.
 *
 * ## Why the rule is narrow, and what it cost to learn that
 *
 * The first attempt at this enforced "no welded dot anywhere" and mechanically rewrote all 118
 * occurrences across 27 tools. Every tool's output was byte-identical afterwards, which looked like
 * proof and was not: `\s*` also matches nothing, so a rewritten pattern cannot report *less*. What
 * it can do is stop meaning what it said. `127\.0\.0\.1` came out as `127\s*\.\s*0.0\s*\.\s*1`
 * — with an unescaped dot in the middle, now matching any character — and `psa\.gov\.ph`,
 * `chart\.js` and a CSS `0\.01ms` were all rewritten to tolerate whitespace inside a literal that
 * can never contain any. None of that is a member access. A dot in a regex is only a member access
 * because of what the pattern is *for*, and no amount of looking at the character can tell you.
 *
 * So the rewrite was reverted and the rule reduced to what was actually measured: patterns that
 * read a call on an object. Those are identifiable — they name a receiver and a verb and a paren —
 * and they are the only ones the wrapped-chain blind spot can reach.
 *
 * The screen that produced the measurement is worth keeping in mind as a method: widen a scanner's
 * patterns monotonically, re-run it, and diff. Identical output means the assumption costs nothing
 * *today*; it does not mean the assumption is safe, which is why this check exists as well.
 *
 * A second rule was tried and abandoned as **unsound**: rewriting a literal space to `\s+`. In a
 * pattern ending `\n  \}` it catches only the first of two spaces and yields `\n\s+ \}`, which
 * demands *three* whitespace characters where the source has two. That is stricter, not looser, and
 * it turned five passing checks into confident false failures. A widening rule that is not
 * monotonic is not a widening rule.
 *
 * Patterns inside comments are skipped: there, a regex is prose about a pattern rather than a
 * pattern.
 *
 * Exit 0 = clean, 1 = at least one scanner has gone blind again.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = join(dirname(fileURLToPath(import.meta.url)));

const LITERAL = /(^|[=(,:[&|!?{;\n]\s*)\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/([gimsuy]*)/g;

/*
 * A pattern that reads a call on an object: a receiver, at least one dotted hop, and a paren or a
 * generic. `this\.api\.post\(`, `foo\.bar\.baz<`, `repo\.list\(`.
 *
 * Anchored on a **letter-led** identifier on both sides of every dot, so `127\.0\.0\.1` and
 * `0\.01ms` are not member accesses; and requiring the trailing `\(` or `<`, so `psa\.gov\.ph`
 * and `chart\.js` — dotted names that are never called — do not qualify either.
 */
const WELDED_MEMBER = /(?:[A-Za-z_]\w*|\\\))\\\.[A-Za-z_(\\]/;

/*
 * A call marker anywhere in the pattern: an escaped `\(`, a bare `(` opening a capture group, a
 * character class holding `(`, or a generic `<(`.
 *
 * A **bare** `(` is deliberately not a call marker, and trying it is what settled the question: it
 * fired on ten property reads whose paren is an alternation — `meta\.(pageSize|totalItems)`,
 * `API_ENDPOINTS\.(\w+)`, `{{[^}]*\.(birthDate|…)`. A property read is not what wraps. Prettier
 * breaks a *method chain*; it does not put a newline between an object and a plain property, and a
 * template interpolation never wraps at all.
 *
 * The one shape that slips past — `/this\.disclose(/`, welded with an unescaped paren — cannot ship
 * silently: an unterminated group is not a valid regex and Node refuses to load the file. The
 * interpreter is the check there, which is a stronger guarantee than this one.
 */
const READS_A_CALL = /\\\(|\[[^\]]*\(|<\(/;

/** The whitespace-tolerant form, `\s*\.`, which is what a corrected pattern looks like. */
const TOLERANT = /\\s\*\\\./;

/*
 * A dot inside a quoted literal is data, not syntax.
 *
 * `denyUnless<DocumentAccessGrant>\(user, 'document\.download'\)` reads a call — but its dot is
 * inside a permission key, where no formatter will ever put a newline. Stripping quoted runs before
 * looking for a member access is what separates the two, and it is the same distinction the
 * reverted mass-rewrite could not make.
 */
const withoutQuoted = (body) => body.replace(/'[^']*'|"[^"]*"/g, "''");

/** A member access in the corrected, whitespace-tolerant form: `this\s*\.\s*api`. */
const TOLERANT_MEMBER = /(?:[A-Za-z_]\w*|\\\))\\s\*\\\.\\s\*/;

/** Reads a call on an object, however it is written. */
const readsCall = (body) => {
  const bare = withoutQuoted(body);
  return (WELDED_MEMBER.test(bare) || TOLERANT_MEMBER.test(bare)) && READS_A_CALL.test(body);
};

/** …and does so with the dots welded, which is the defect. */
const callOnObject = (body) => WELDED_MEMBER.test(withoutQuoted(body)) && READS_A_CALL.test(body);

/** Spans covered by a comment, where a regex is an explanation rather than a scanner. */
function commentMask(text) {
  const mask = new Uint8Array(text.length);
  for (const m of text.matchAll(/\/\*[\s\S]*?\*\//g)) mask.fill(1, m.index, m.index + m[0].length);
  for (const m of text.matchAll(/^[ \t]*\/\/[^\n]*/gm)) mask.fill(1, m.index, m.index + m[0].length);
  return mask;
}

const problems = [];
let scanned = 0;
let patterns = 0;
let calls = 0;

const files = readdirSync(TOOLS)
  .filter((file) => file.endsWith('.mjs') && !file.startsWith('.'))
  .filter((file) => file !== 'check-scanners.mjs');

if (files.length < 20) {
  problems.push(`Only ${files.length} tools were found. The scan is broken, not the tools.`);
}

for (const file of files) {
  const text = readFileSync(join(TOOLS, file), 'utf8');
  const mask = commentMask(text);
  scanned++;

  for (const m of text.matchAll(LITERAL)) {
    const bodyStart = m.index + m[1].length + 1;
    if (mask[bodyStart] === 1) continue;

    patterns++;
    const body = m[2];

    if (readsCall(body)) calls++;

    if (callOnObject(body) && !TOLERANT.test(body)) {
      const line = text.slice(0, bodyStart).split('\n').length;
      problems.push(
        `${file}:${line} reads a call on an object with the dots welded: /${body.slice(0, 70)}/\n` +
          `    A chain that wrapped across lines will not match, and the check will then be green\n` +
          `    about a surface it is not reading. Write \\s*\\.\\s* and \\s*\\( instead.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`\nScanner check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    `\n  A ratchet that silently stops watching part of the surface is the failure this whole\n` +
      `  class of tooling exists to prevent. See DL-143.\n`,
  );
  process.exit(1);
}

console.log(
  `  scanners: ${scanned} tools, ${patterns} regexes, ${calls} of them reading a call on an object — all whitespace-tolerant`,
);
console.log('Scanner check passed.');
