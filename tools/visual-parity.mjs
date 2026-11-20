#!/usr/bin/env node
/**
 * Visual parity: the design board next to the running console, same width, same moment.
 *
 *   npm run parity -- Main                 one board (name from tools/visual-parity.json)
 *   npm run parity -- Main CitizensOverview
 *   npm run parity -- --all
 *   npm run parity -- Main --width 1280
 *
 * Needs the console running (`npm start`, the local-mock build, on CONSOLE_URL — default
 * http://localhost:4200). Against a real API set PARITY_EMAIL / PARITY_PASSWORD / PARITY_MFA.
 *
 * Writes, per board, to .parity/<Board>/:
 *   board.png   the mock-up from docs/design/admin/screens/<Board>.dc.html
 *   app.png     the console page at the route in visual-parity.json
 *   side.png    both, side by side, the mock-up on the left
 *   report.md   every heading and panel on each side with its box, and which mock-up headings
 *               the page does not have
 *
 * Numbers, names and row counts will differ — the page shows live data. Everything else
 * (layout, panel order and size, type, colour, controls) should not.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN = join(ROOT, 'docs/design');
const OUT = join(ROOT, '.parity');
const CONSOLE = (process.env.CONSOLE_URL ?? 'http://localhost:4200').replace(/\/$/, '');
const EMAIL = process.env.PARITY_EMAIL ?? 'marisol.alcantara@taytay.example.gov.ph';
const PASSWORD = process.env.PARITY_PASSWORD ?? 'parity-check-1';
const MFA = process.env.PARITY_MFA ?? '000000';

const args = process.argv.slice(2);
const widthArg = args.indexOf('--width');
const WIDTH = widthArg >= 0 ? Number(args[widthArg + 1]) : 1440;
const names = args.filter((a, i) => !a.startsWith('--') && (widthArg < 0 || i !== widthArg + 1));
const config = JSON.parse(await readFile(join(ROOT, 'tools/visual-parity.json'), 'utf8'));
const boards = args.includes('--all')
  ? config.boards
  : config.boards.filter((b) => names.includes(b.board));
if (boards.length === 0) {
  console.error(`Name a board: ${config.boards.map((b) => b.board).join(', ')} — or --all`);
  process.exit(1);
}

/* ── docs/design over http, so the boards' relative images and support.js load ── */
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(
    /^([/\\])+/,
    '',
  );
  const file = join(DESIGN, path);
  if (!file.startsWith(DESIGN) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const DESIGN_URL = `http://127.0.0.1:${server.address().port}`;

/* ── what is on a page: headings and panels, in reading order ── */
function outline() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)];
  };
  const text = (el) => (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,[role=heading]')]
    .filter(vis)
    .map((el) => ({ tag: el.tagName.toLowerCase(), text: text(el), box: box(el) }));
  const panels = [...document.querySelectorAll('body *')]
    .filter((el) => {
      if (!vis(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 140 || r.height < 70) return false;
      const s = getComputedStyle(el);
      const filled =
        s.backgroundImage !== 'none' ||
        (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent');
      return filled && parseFloat(s.borderTopLeftRadius) >= 12;
    })
    .map((el) => ({
      box: box(el),
      first: text(el).slice(0, 50),
      radius: getComputedStyle(el).borderTopLeftRadius,
      bg: getComputedStyle(el).backgroundColor,
    }));
  return {
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    headings,
    panels,
  };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: 1000 } });

async function signIn() {
  await page.goto(`${CONSOLE}/sign-in`);
  await page.waitForSelector('input[type=email]', { timeout: 30000 });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForTimeout(1500);
  const code = await page.$('input[autocomplete=one-time-code], input[inputmode=numeric]');
  if (code) {
    await code.fill(MFA);
    await page.keyboard.press('Enter');
  }
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 20000 });
}

/* The mock session lives in memory: move with the router, never reload. */
async function go(route) {
  await page.evaluate((r) => {
    history.pushState({}, '', r);
    dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1800);
}

const board = await browser.newPage({ viewport: { width: WIDTH, height: 1000 } });
await signIn();
const summary = [];

for (const b of boards) {
  const dir = join(OUT, b.board);
  await mkdir(dir, { recursive: true });

  await board.goto(
    `${DESIGN_URL}/admin/screens/${b.board}.dc.html${b.state ? `?state=${encodeURIComponent(b.state)}` : ''}`,
  );
  await board.waitForTimeout(1500);
  await board.screenshot({ path: join(dir, 'board.png'), fullPage: true });
  const want = await board.evaluate(outline);

  let got;
  if (b.signedOut) {
    const fresh = await browser.newPage({ viewport: { width: WIDTH, height: 1000 } });
    await fresh.goto(`${CONSOLE}${b.route}`);
    await fresh.waitForTimeout(2000);
    await fresh.screenshot({ path: join(dir, 'app.png'), fullPage: true });
    got = await fresh.evaluate(outline);
    await fresh.close();
  } else {
    await go(b.route);
    if (b.click) {
      await page.click(b.click).catch(() => console.warn(`  ${b.board}: no ${b.click}`));
      await page.waitForTimeout(1800);
    }
    await page.screenshot({ path: join(dir, 'app.png'), fullPage: true });
    got = await page.evaluate(outline);
  }

  // side by side, the mock-up on the left
  const img = async (f) =>
    `data:image/png;base64,${(await readFile(join(dir, f))).toString('base64')}`;
  const side = await browser.newPage({ viewport: { width: WIDTH * 2 + 24, height: 800 } });
  await side.setContent(`<body style="margin:0;display:flex;gap:24px;align-items:flex-start;background:#fff;font:600 14px sans-serif">
    <div><div style="padding:6px">MOCK-UP ${b.board}</div><img src="${await img('board.png')}"></div>
    <div><div style="padding:6px">CONSOLE ${b.route}</div><img src="${await img('app.png')}"></div></body>`);
  await side.screenshot({ path: join(dir, 'side.png'), fullPage: true });
  await side.close();

  const norm = (t) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
  const gotH = new Set(got.headings.map((h) => norm(h.text)));
  const missing = want.headings.filter((h) => h.text && !gotH.has(norm(h.text)));
  const fmt = (list, f) => list.map(f).join('\n') || '—';
  await writeFile(
    join(dir, 'report.md'),
    `# ${b.board} ↔ ${b.route} at ${WIDTH}px

| | Mock-up | Console |
|---|---|---|
| Page size | ${want.width} × ${want.height} | ${got.width} × ${got.height} |
| Headings | ${want.headings.length} | ${got.headings.length} |
| Panels (filled, radius ≥ 12) | ${want.panels.length} | ${got.panels.length} |

## Mock-up headings the console does not have (${missing.length})
${fmt(missing, (h) => `- ${h.tag} "${h.text}" at x${h.box[0]} y${h.box[1]} ${h.box[2]}×${h.box[3]}`)}

## Mock-up — headings [x, y, w, h]
${fmt(want.headings, (h) => `- ${h.tag} ${JSON.stringify(h.box)} ${h.text}`)}

## Console — headings [x, y, w, h]
${fmt(got.headings, (h) => `- ${h.tag} ${JSON.stringify(h.box)} ${h.text}`)}

## Mock-up — panels [x, y, w, h]
${fmt(want.panels, (p) => `- ${JSON.stringify(p.box)} r${p.radius} "${p.first}"`)}

## Console — panels [x, y, w, h]
${fmt(got.panels, (p) => `- ${JSON.stringify(p.box)} r${p.radius} "${p.first}"`)}
`,
  );
  summary.push(
    `${b.board.padEnd(20)} missing headings ${String(missing.length).padStart(2)}   panels ${want.panels.length}→${got.panels.length}   height ${want.height}→${got.height}`,
  );
  console.log(`✓ ${b.board} → .parity/${b.board}/side.png`);
}

console.log(`\n${summary.join('\n')}`);
await browser.close();
server.close();
