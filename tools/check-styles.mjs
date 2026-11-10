#!/usr/bin/env node
/**
 * Style guard: colours, type sizes and shadows come from the tokens (DL-203).
 *
 * The redesign (DL-200 to DL-202) put every colour, type size and radius of the console in CSS
 * custom properties, and two checks audit those tokens: `check:contrast` measures the colour pairs
 * and `check:brand` compares them with the TypeScript mirror. Neither can see a literal typed into a
 * component stylesheet. A `#5a6478` in one feature is a colour nobody measured, a `13px` is a size
 * that stays put the day the scale moves, and a `box-shadow` brings back the decoration the design
 * removed. Phase 4 swept every one of them out by hand; this keeps them out.
 *
 * It reads every stylesheet under `src/` — component `.scss`/`.css` files and the inline `styles`
 * of components — and fails on:
 *
 *   1. **A colour literal**: hex, `rgb()`/`rgba()`, `hsl()`/`hsla()` (and `hwb`, `lab`, `lch`,
 *      `oklab`, `oklch`, `color()`), or a CSS named colour (`white`, `navy`, …) in a property that
 *      takes a colour. A named colour is the same literal spelled differently, and the easiest way
 *      round the first rule. System colours (`CanvasText`, …), `transparent` and `currentcolor` are
 *      not literals of ours and pass.
 *   2. **A raw px font size**: `font-size` or the `font` shorthand with a px figure, or a `--fs-*`
 *      token declared outside the token files. Sizes are the `--fs-*` scale; a relative size (`%`,
 *      `em`) that scales with its box is not a raw px size and passes.
 *   3. **A shadow or a glow**: `box-shadow` other than `none` or the focus ring drawn from the focus
 *      tokens (`0 0 0 var(--focus-ring-offset) var(--focus-ring-inner)`), any `text-shadow` other
 *      than `none`, and `drop-shadow()` in a filter. The focus ring is a ring, not a shadow, and
 *      must stay visible.
 *
 * **Who is exempt, and from what.** Only the two files that define the colour tokens,
 * `src/styles.scss` and `src/styles/_brand-tokens.scss`, and only *as the value of a custom
 * property* (`--gold: #f5da18`), because that is what defining a token is. A rule in those files
 * (the print background, the focus ring) is held to the same three rules as any other. `shared/ui`
 * and the global partials (`_patterns.scss`, `_interaction.scss`, …) get no exemption: they were
 * clean when this was written, and they are what every feature copies from.
 *
 * A radius or a height is not checked: many legitimate values (`1px` hairlines, `50%`, a `2px`
 * underline offset) are not tokens, and a rule that cannot tell them apart from a stray `14px`
 * radius would be one people learn to edit rather than read. DESIGN_SYSTEM.md asks for the radius
 * and height tokens; review holds that line.
 *
 * Exit 0 = clean, 1 = at least one violation.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const posix = (rel) => rel.split(sep).join('/');

const walk = (dir, exts) => {
  const out = [];
  if (!existsSync(join(root, dir))) return out;
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel, exts));
    else if (exts.has(extname(entry))) out.push(posix(rel));
  }
  return out;
};

/** The only files where a literal may appear, and there only as a token's value. */
const TOKEN_FILES = new Set(['src/styles.scss', 'src/styles/_brand-tokens.scss']);
const GUIDE = 'docs/design/DESIGN_SYSTEM.md';

/* ── Collect the stylesheets ─────────────────────────────────────────────── */

/** Each source: the file, the CSS text, and the line it starts on (for inline styles). */
const sources = [];

for (const file of walk('src', new Set(['.scss', '.css']))) {
  sources.push({ file, text: read(file), firstLine: 1 });
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * A component's inline `styles`: one template literal or string, or an array of them. Read
 * literally rather than with a regex for the whole value, because a template literal can hold a
 * `]` and an array can hold several literals.
 */
const inlineBlocks = (source) => {
  const blocks = [];
  const opener = /(^|[\s{,])styles\s*:\s*/g;
  let match;
  while ((match = opener.exec(source)) !== null) {
    let at = match.index + match[0].length;
    const inArray = source[at] === '[';
    if (inArray) at += 1;
    for (;;) {
      while (at < source.length && /[\s,]/.test(source[at])) at += 1;
      const quote = source[at];
      if (quote !== '`' && quote !== "'" && quote !== '"') break;
      let end = at + 1;
      while (end < source.length && source[end] !== quote) end += source[end] === '\\' ? 2 : 1;
      blocks.push({ text: source.slice(at + 1, end), firstLine: lineOf(source, at + 1) });
      at = end + 1;
      if (!inArray) break;
    }
  }
  return blocks;
};

let inlineCount = 0;
for (const file of walk('src', new Set(['.ts']))) {
  if (file.endsWith('.spec.ts')) continue;
  for (const block of inlineBlocks(read(file))) {
    inlineCount += 1;
    sources.push({ file, ...block });
  }
}

// A scan that finds nothing reports clean. Fewer stylesheets than the console has ever had means
// the walk is broken, not that the styles went.
if (sources.length < 60) {
  problems.push(
    `Only ${sources.length} stylesheets were found under src/. The scan is broken, not the styles.`,
  );
}
for (const file of TOKEN_FILES) {
  if (!existsSync(join(root, file))) {
    problems.push(
      `${file} has gone. It is one of the two files the colour tokens are declared in.`,
    );
  } else if (!/^\s*--[\w-]+\s*:\s*#[0-9a-f]{3,8}\s*;/im.test(read(file))) {
    problems.push(`${file} declares no colour token. The exemption below would cover nothing.`);
  }
}

/* ── Rules ───────────────────────────────────────────────────────────────── */

/**
 * Comments, string contents and `url()` arguments blanked, keeping every newline so line numbers
 * hold. A `url(#gradient)` names a fragment, not a colour.
 */
const clean = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (line, lead) => lead + ' '.repeat(line.length - lead.length))
    .replace(
      /'[^'\n]*'|"[^"\n]*"/g,
      (string) => string[0] + ' '.repeat(string.length - 2) + string[0],
    )
    .replace(/url\([^)\n]*\)/gi, (url) => `url(${' '.repeat(url.length - 5)})`);

/**
 * A declaration: a property (custom properties and SCSS variables included), a colon that is not
 * a pseudo-element's, and a value that ends at `;` or `}`. A selector such as `a:hover {` never
 * matches, because its "value" runs into the `{`.
 */
const DECLARATION = /(?<![\w$-])(\$?-{0,2}[a-zA-Z][\w-]*)\s*:(?!:)([^;{}]*)(?=[;}])/g;

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/i;
const COLOUR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i;
const NAMED_COLOURS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
    'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
    'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
    'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
    'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
    'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
    'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
    'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
    'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
    'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);
/** Properties whose value is (or carries) a colour, so a bare word in them is read as one. */
const TAKES_COLOUR =
  /^(?:--|\$)|color$|^(?:background|border|outline|fill|stroke|text-decoration|column-rule|box-shadow|text-shadow)(?:-|$)/;
const IDENTIFIER = /(?<![\w-])[a-z]+(?![\w-])/gi;

const PX = /(?<![\w.-])\d*\.?\d+px(?![\w-])/i;
const FOCUS_RING =
  /^(?:inset\s+)?0\s+0\s+0\s+var\(--focus-ring-(?:offset|width)\)\s+var\(--focus-ring-(?:inner|color)\)$/;

const counts = { declarations: 0, colour: 0, size: 0, shadow: 0 };
const flag = (kind, where, message) => {
  counts[kind] += 1;
  problems.push(`${where} ${message}`);
};

for (const { file, text, firstLine } of sources) {
  const isTokenFile = TOKEN_FILES.has(file);
  const css = clean(text);
  for (const match of css.matchAll(DECLARATION)) {
    counts.declarations += 1;
    const property = match[1].toLowerCase();
    const value = match[2]
      .replace(/!important/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const where = `${file}:${firstLine - 1 + lineOf(css, match.index + match[0].indexOf(match[1]))}`;
    const isCustom = property.startsWith('--');
    const quoted = `\`${match[1]}: ${value.slice(0, 60)}\``;

    // A token file declaring a token is the one place a literal belongs.
    if (isTokenFile && isCustom) continue;

    /* 1. Colour literals */
    const literal =
      HEX.exec(value)?.[0] ??
      COLOUR_FUNCTION.exec(value)?.[0].replace(/\s*\($/, '()') ??
      (TAKES_COLOUR.test(property)
        ? [...value.matchAll(IDENTIFIER)]
            .map((m) => m[0])
            .find((w) => NAMED_COLOURS.has(w.toLowerCase()))
        : undefined);
    if (literal !== undefined) {
      flag(
        'colour',
        where,
        `sets a colour literal (${literal}) in ${quoted}. Use a colour token from src/styles.scss ` +
          `(${GUIDE}, "Colours"): a colour typed here is one check:contrast never measured (DL-203).`,
      );
    }

    /* 2. Raw px font sizes */
    const isFontSize =
      property === 'font-size' ||
      property === 'font' ||
      (isCustom && (property.startsWith('--fs-') || property.includes('font-size')));
    if (isFontSize && PX.test(value)) {
      flag(
        'size',
        where,
        `sets a raw px font size in ${quoted}. Use the --fs-* scale (${GUIDE}, "Type"); ` +
          'a new size is a token in src/styles.scss, not a number in a component (DL-203).',
      );
    }

    /* 3. Shadows and glows */
    const isBoxShadow = property === 'box-shadow' || property === '-webkit-box-shadow';
    if (isBoxShadow && value !== 'none' && !FOCUS_RING.test(value)) {
      flag(
        'shadow',
        where,
        `draws a shadow: ${quoted}. The design has no shadows or glows; a box-shadow is \`none\` ` +
          'or the focus ring `0 0 0 var(--focus-ring-offset) var(--focus-ring-inner)` (DL-203).',
      );
    }
    if (property === 'text-shadow' && value !== 'none') {
      flag(
        'shadow',
        where,
        `draws a text glow: ${quoted}. The design has no shadows or glows (DL-203).`,
      );
    }
    if (/(?<![\w-])drop-shadow\s*\(/i.test(value)) {
      flag(
        'shadow',
        where,
        `draws a drop shadow: ${quoted}. The design has no shadows or glows (DL-203).`,
      );
    }
  }
}

notes.push(
  `stylesheets: ${sources.length - inlineCount} files and ${inlineCount} inline style blocks, ` +
    `${counts.declarations} declarations`,
);
notes.push(
  `literals: ${counts.colour} colour, ${counts.size} px font size, ${counts.shadow} shadow ` +
    `(tokens may hold literals only in ${[...TOKEN_FILES].join(' and ')})`,
);

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nStyle check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Style check passed.');
