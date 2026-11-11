import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { RETURN_URL_PARAM, safeReturnUrl } from '@core/access/access.guards';
import { SessionStore } from '@core/auth/session.store';
import {
  isPlausibleEmail,
  isPlausiblePassword,
  SIGN_IN_METHOD,
  type DevelopmentRoleClaim,
  type SignInCredentials,
} from '@domain/index';
import { BRAND_COPY } from '@shared/brand/brand.copy';
import { MunicipalSeal } from '@shared/brand/municipal-seal';
import { Icon } from '@shared/ui/icon/icon';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';

import { AUTH_COPY } from './auth.copy';
import { SignInArt } from './sign-in-art';

/**
 * Credential sign-in.
 *
 * **WCAG 2.2 §3.3.8 Accessible Authentication (Minimum), Level AA** treats
 * remembering a password as a cognitive function test, permitted only when the
 * step offers an Alternative, a Mechanism, Object Recognition or Personal
 * Content. This screen relies on **Mechanism**, and provides it in three ways:
 *
 *  - `autocomplete="username"` / `"current-password"`, so browsers and password
 *    managers can fill the form;
 *  - paste is never blocked — no `onpaste` handler exists anywhere here;
 *  - a show-password toggle, so a manually typed password can be checked.
 *
 * There is no CAPTCHA, puzzle, or transcription step, and none may be added:
 * each would be a cognitive function test with no satisfier.
 *
 * There is also **no registration form**. Accounts are provisioned by an
 * administrator (`DL-32`); the screen says so rather than leaving a user
 * hunting for a link that does not exist.
 *
 * What the form offers depends on how this build signs in (`SIGN_IN_METHOD`,
 * `DL-166`): a password; nothing at all, said plainly, when no identity provider
 * is configured; or, in `local-api` only, the development verifier, which checks
 * no password and asks which role a new account should be recorded with.
 */
@Component({
  selector: 'app-sign-in-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MunicipalSeal, Icon, SignInArt, ThemeToggle],
  templateUrl: './sign-in-page.html',
  styleUrl: './sign-in-page.scss',
})
export class SignInPage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly method = inject(SIGN_IN_METHOD);

  protected readonly copy = AUTH_COPY;
  protected readonly brand = BRAND_COPY;

  /** Set when this build has no identity provider: the screen explains, and offers no form. */
  protected readonly notConfigured = this.method.kind === 'not-configured' ? this.method : null;
  /** Set in `local-api` only. */
  protected readonly development = this.method.kind === 'development-verifier' ? this.method : null;
  protected readonly roleClaim = signal<DevelopmentRoleClaim>('staff');

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly code = signal('');
  protected readonly passwordVisible = signal(false);
  protected readonly submitting = signal(false);
  /** Client-side messages only. Server refusals live on `session.error`. */
  protected readonly clientErrors = signal<readonly string[]>([]);

  protected readonly serverError = this.session.error;

  /** True once the password is accepted and a second factor is outstanding. */
  protected readonly awaitingCode = computed(
    () => this.session.status() === 'second-factor-required',
  );
  protected readonly challenge = this.session.pendingChallenge;
  protected readonly retryAfterSeconds = this.session.retryAfterSeconds;

  protected readonly errors = computed<readonly string[]>(() => {
    const server = this.serverError();
    return server ? [...this.clientErrors(), server] : this.clientErrors();
  });

  private readonly returnUrl = toSignal(
    this.route.queryParamMap.pipe(map((params) => safeReturnUrl(params.get(RETURN_URL_PARAM)))),
    { initialValue: null },
  );

  protected onEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.clearMessages();
  }

  protected onPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.clearMessages();
  }

  protected onRoleClaim(claim: DevelopmentRoleClaim): void {
    this.roleClaim.set(claim);
  }

  protected togglePasswordVisible(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.submitting() || this.notConfigured !== null) {
      return;
    }

    const email = this.email().trim();
    const password = this.password();
    const development = this.development;

    // Shape errors are named specifically, because they are about what the
    // user typed. Credential errors never are. The development verifier reads
    // no password, so it asks for none.
    const problems: string[] = [];
    if (!isPlausibleEmail(email)) {
      problems.push(this.copy.emailRequired);
    }
    if (development === null && !isPlausiblePassword(password)) {
      problems.push(this.copy.passwordRequired);
    }
    if (problems.length > 0) {
      this.clientErrors.set(problems);
      return;
    }

    const credentials: SignInCredentials =
      development === null
        ? { email, password }
        : { email, password, developmentRoleClaim: this.roleClaim() };

    this.submitting.set(true);
    this.session.signIn(credentials).subscribe({
      next: (signedIn) => {
        this.submitting.set(false);
        // Cleared whichever way this went: on success it is no longer needed,
        // and on a second-factor challenge it must not sit in memory through a
        // step that can take minutes.
        this.password.set('');

        if (signedIn) {
          void this.router.navigateByUrl(this.returnUrl() ?? '/dashboard');
        }
        // Otherwise either the attempt was refused — the message is on
        // `session.error` — or a second factor is outstanding, and the template
        // switches to the code step on `session.status`.
      },
      error: () => this.submitting.set(false),
    });
  }

  protected onCode(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
    this.clearMessages();
  }

  protected submitCode(event: Event): void {
    event.preventDefault();
    if (this.submitting()) {
      return;
    }

    const code = this.code().trim();

    if (code.length === 0) {
      this.clientErrors.set([this.copy.codeRequired]);
      return;
    }

    this.submitting.set(true);
    this.session.completeSecondFactor(code).subscribe({
      next: (signedIn) => {
        this.submitting.set(false);
        this.code.set('');
        if (signedIn) {
          void this.router.navigateByUrl(this.returnUrl() ?? '/dashboard');
        }
      },
      error: () => this.submitting.set(false),
    });
  }

  protected startOver(): void {
    this.code.set('');
    this.password.set('');
    this.clientErrors.set([]);
    this.session.cancelSecondFactor();
  }

  private clearMessages(): void {
    if (this.clientErrors().length > 0) {
      this.clientErrors.set([]);
    }
    if (this.serverError()) {
      this.session.clearError();
    }
  }
}
