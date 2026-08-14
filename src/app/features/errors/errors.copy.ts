/**
 * Copy for the denial and not-found screens (`DL-23`).
 *
 * Every string here is deliberately **record-free**. A denial page must say
 * that access was refused without disclosing what was being reached for: naming
 * the route, the record or the resident would confirm that it exists, which is
 * the disclosure the refusal is supposed to prevent (`DL-31`).
 *
 * The only identity mentioned is the signed-in user's own, which they already
 * know.
 */
export const ERRORS_COPY = {
  forbiddenHeading: 'You do not have access to that section',
  forbiddenBody: (displayName: string): string =>
    `You are signed in as ${displayName}. If you need this access, ask the MSWDO head or a system administrator to adjust your role.`,
  forbiddenAction: 'Back to dashboard',

  notFoundHeading: 'Page not found',
  notFoundBody: 'The address you followed does not match anything in this application.',
  notFoundAction: 'Back to dashboard',
} as const;
