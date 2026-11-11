/**
 * The per-response style nonce on Netlify (DL-172, DL-206).
 *
 * Angular injects component styles as `<style>` blocks, and the policy is `style-src 'self'` with
 * no `'unsafe-inline'`. Angular's answer is `ngCspNonce` on `<app-root>`: every block it injects
 * carries that value, and the policy admits only blocks carrying the value of this response. A
 * static host serves the same bytes to everybody, so it cannot mint one; this function does, and
 * writes the attribute and the header in the same response, as the staging Caddy does with its
 * request id.
 *
 * It only ever adds this response's own nonce to `style-src`. It never creates a policy: a page
 * that arrives without one is refused rather than served, because a console that looks right
 * with no policy in front of it is the failure DL-172 found, and nobody would see it.
 *
 * Declared in netlify.toml (`[[edge_functions]]`), so it sits beside the policy it edits.
 * `tools/check-headers.mjs` imports this file and exercises it.
 */

interface EdgeContext {
  next(): Promise<Response>;
}

const ROOT_TAG = '<app-root>';

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** The policy with `'nonce-…'` added to `style-src`, or null when it has no `style-src`. */
export function withStyleNonce(policy: string, nonce: string): string | null {
  let found = false;
  const directives = policy
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive !== '')
    .map((directive) => {
      if (directive.split(/\s+/)[0] !== 'style-src') {
        return directive;
      }
      found = true;
      return `${directive} 'nonce-${nonce}'`;
    });
  return found ? directives.join('; ') : null;
}

function refused(): Response {
  return new Response(
    'This page arrived without its Content-Security-Policy, so it is not served. ' +
      'The hosting configuration (netlify.toml) needs fixing.\n',
    {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    },
  );
}

export async function stampNonce(response: Response, nonce: string): Promise<Response> {
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) {
    return response;
  }
  const policy = response.headers.get('content-security-policy');
  if (policy === null) {
    return refused();
  }
  const stampedPolicy = withStyleNonce(policy, nonce);
  const html = await response.text();
  const headers = new Headers(response.headers);
  // The body changes length, and an entity tag would describe the bytes before the stamp.
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  if (stampedPolicy === null || !html.includes(ROOT_TAG)) {
    // Nothing to stamp: served as it came, policy unchanged. Unstyled is visible; unguarded is not.
    return new Response(html, { status: response.status, headers });
  }
  headers.set('content-security-policy', stampedPolicy);
  return new Response(html.replace(ROOT_TAG, `<app-root ngCspNonce="${nonce}">`), {
    status: response.status,
    headers,
  });
}

export default async function cspNonce(_request: Request, context: EdgeContext): Promise<Response> {
  return stampNonce(await context.next(), newNonce());
}
