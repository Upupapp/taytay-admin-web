/**
 * The http adapters and their port bindings, read the same way by every check that reads them.
 *
 * ## Why this is shared
 *
 * Until `DL-224` the adapters were one file, `http-repositories.ts`, and each check read it by
 * name. The staff adapter now lives apart, in `staff-repository.ts`, because it is the one adapter
 * bound eagerly and a module is bundled whole wherever it is imported. A check that kept reading
 * one file would have stopped seeing the staff adapter's requests and gone on passing — the failure
 * `check:scanners` exists for: a green number about a surface nothing is reading (`DL-143`).
 *
 * So the file list is held once, here, and `unlistedApiCallers` names any other file under
 * `data/http` that calls the API, so the list cannot fall behind the code without failing a check.
 *
 * Bindings are read in both forms `data-access.providers.ts` uses: `useClass: HttpX` for the eager
 * staff adapter, and `useFactory: lazyPort((m) => m.HttpX)` for every port whose adapter is fetched
 * on its first question.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Every file holding an http adapter, in the order they are joined. */
export const ADAPTER_FILES = [
  'src/app/data/http/http-repositories.ts',
  'src/app/data/http/staff-repository.ts',
  'src/app/data/http/http-assistance-imports.ts',
];

/**
 * The adapters as one source, with `locate(offset)` giving `file:line` for an offset in it. Files
 * are joined by one newline, so an offset maps back to exactly one file.
 */
export function readAdapters(root) {
  const parts = ADAPTER_FILES.map((path) => ({
    path,
    text: readFileSync(join(root, path), 'utf8'),
  }));
  const source = parts.map((part) => part.text).join('\n');

  function locate(offset) {
    let start = 0;
    for (const part of parts) {
      const end = start + part.text.length + 1;
      if (offset < end) {
        const line = part.text.slice(0, Math.max(0, offset - start)).split('\n').length;
        return `${part.path.split('/').pop()}:${line}`;
      }
      start = end;
    }
    return `${ADAPTER_FILES[0].split('/').pop()}:?`;
  }

  return { source, locate };
}

/** `useClass: X`, or `useFactory: lazyPort((m) => m.X)` — whitespace anywhere a formatter puts it. */
const BINDING = new RegExp(
  String.raw`provide:\s*(\w+),\s*(?:useClass:\s*(\w+)|useFactory:\s*lazyPort\(\s*\(\s*(\w+)\s*\)\s*=>\s*(\w+)\s*\.\s*(\w+)\s*\))`,
  'g',
);

/** Every port binding in a providers file: `{ token, adapter, lazy }`. */
export function bindingsIn(providers) {
  return [...providers.matchAll(BINDING)]
    .filter(([, , eager, parameter, receiver]) => eager !== undefined || parameter === receiver)
    .map(([, token, eager, , , lazy]) => ({
      token,
      adapter: eager ?? lazy,
      lazy: eager === undefined,
    }));
}

/** The adapter bound to one token, in either form, or `undefined`. */
export function boundAdapter(providers, token) {
  return bindingsIn(providers).find((binding) => binding.token === token)?.adapter;
}

/** Files under `data/http`, specs aside, that call `this.api` but are not in `ADAPTER_FILES`. */
export function unlistedApiCallers(root) {
  const http = join(root, 'src', 'app', 'data', 'http');
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) continue;
      const path = relative(root, full).split(/[\\/]/).join('/');
      if (ADAPTER_FILES.includes(path)) continue;
      if (/this\s*\.\s*api\s*\.\s*\w+/.test(readFileSync(full, 'utf8'))) out.push(path);
    }
  };
  walk(http);
  return out;
}
