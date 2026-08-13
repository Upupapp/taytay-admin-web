import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import {
  DEFAULT_PAGE_REQUEST,
  formatPersonName,
  ROLE_DEFINITIONS,
  STAFF_REPOSITORY,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';
import { BRAND_COPY } from '@shared/brand/brand.copy';
import { MunicipalSeal } from '@shared/brand/municipal-seal';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import type { Page } from '@domain/index';

/**
 * Account selection stand-in.
 *
 * Credential-based sign-in belongs to the authentication TAB; until then this
 * screen exercises the real `STAFF_REPOSITORY.signInAs` port so the session,
 * guards and permission-gated navigation can be verified across every role.
 * It reads no mock module directly and will not need rewriting when the API
 * adapter takes over — only replacing.
 */
@Component({
  selector: 'app-sign-in-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, MunicipalSeal],
  templateUrl: './sign-in-page.html',
  styleUrl: './sign-in-page.scss',
})
export class SignInPage {
  private readonly repository = inject(STAFF_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly state = toSignal(
    toViewState(this.repository.list({}, { ...DEFAULT_PAGE_REQUEST, pageSize: 50 })),
    { initialValue: LOADING as ViewState<Page<StaffUser>> },
  );

  protected readonly accounts = computed(() => valueOf(this.state())?.items ?? []);
  protected readonly error = this.session.error;
  protected readonly copy = BRAND_COPY;

  protected describe(staff: StaffUser): string {
    const definition = ROLE_DEFINITIONS[staff.role];
    return `${definition.label} · ${definition.description}`;
  }

  protected label(staff: StaffUser): string {
    return formatPersonName(staff.name);
  }

  protected signIn(id: StaffUserId): void {
    this.session.signInAs(id).subscribe({
      next: (user) => {
        if (user) {
          void this.router.navigate(['/dashboard']);
        }
      },
    });
  }
}
