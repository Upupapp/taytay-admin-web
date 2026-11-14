import { HttpContextToken } from '@angular/common/http';

/**
 * Marks a request whose failure nobody asked about: the live-updates stream (`DL-222`).
 *
 * The change feed is opened by the console, not by a person, and it drops and reconnects as a
 * matter of course — a proxy closing an idle connection, a laptop lid, the server's own fifteen
 * minute limit. A toast or an inbox entry for each of those would teach an office to ignore the
 * error notices that matter. So the error interceptor raises **no** notice for a request carrying
 * this token. It still maps the failure, and a `401` still ends the session exactly as any other
 * request's would: a credential the API refused is not a quiet matter.
 */
export const QUIET_FAILURE = new HttpContextToken<boolean>(() => false);
