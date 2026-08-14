import { InjectionToken } from '@angular/core';

import type { AuthenticatedUser } from '../access/staff-user';

/**
 * Read-only view of who is signed in, for code that must enforce access but
 * has no business owning the session.
 *
 * It exists so the **data adapters** can re-check permission and data scope
 * before returning or changing anything. That is what makes the acceptance rule
 * real: hiding a control in the UI is not protection, so the layer that serves
 * the data refuses too. When the HTTP adapters take over, the same checks are
 * the API's job — this token is how the mock stands in for that.
 *
 * Implemented in `core` by the session store; adapters only read it.
 */
export interface AccessContext {
  /** The signed-in identity, or `null` when anonymous. */
  currentUser(): AuthenticatedUser | null;
}

export const ACCESS_CONTEXT = new InjectionToken<AccessContext>('AccessContext');
