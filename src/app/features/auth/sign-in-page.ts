import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { RETURN_URL_PARAM, safeReturnUrl } from '@core/access/access.guards';
import { SessionStore } from '@core/auth/session.store';
import { isPlausibleEmail, isPlausiblePassword } from '@domain/index';
import { BRAND_COPY } from '@shared/brand/brand.copy';
import { MunicipalSeal } from '@shared/brand/municipal-seal';

import { AUTH_COPY } from './auth.copy';

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
 */
@Component({
  selector: 'app-sign-in-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MunicipalSeal],
  templateUrl: './sign-in-page.html',
  styleUrl: './sign-in-page.scss',
})
export class SignInPage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly copy = AUTH_COPY;
  protected readonly brand = BRAND_COPY;

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly passwordVisible = signal(false);
  protected readonly submitting = signal(false);
  /** Client-side messages only. Server refusals live on `session.error`. */
  protected readonly clientErrors = signal<readonly string[]>([]);

  protected readonly serverError = this.session.error;

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

  protected togglePasswordVisible(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.submitting()) {
      return;
    }

    const email = this.email().trim();
    const password = this.password();

    // Shape errors are named specifically, because they are about what the
    // user typed. Credential errors never are.
    const problems: string[] = [];
    if (!isPlausibleEmail(email)) {
      problems.push(this.copy.emailRequired);
    }
    if (!isPlausiblePassword(password)) {
      problems.push(this.copy.passwordRequired);
    }
    if (problems.length > 0) {
      this.clientErrors.set(problems);
      return;
    }

    this.submitting.set(true);
    this.session.signIn({ email, password }).subscribe({
      next: (ok) => {
        this.submitting.set(false);
        if (ok) {
          // Cleared so a password never lingers in memory longer than needed.
          this.password.set('');
          void this.router.navigateByUrl(this.returnUrl() ?? '/dashboard');
        }
      },
      error: () => this.submitting.set(false),
    });
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
