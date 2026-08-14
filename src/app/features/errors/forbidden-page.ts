import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import { EmptyState } from '@shared/ui/empty-state/empty-state';

import { ERRORS_COPY } from './errors.copy';

@Component({
  selector: 'app-forbidden-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState],
  template: `
    <div class="card">
      <app-empty-state
        variant="forbidden"
        [heading]="copy.forbiddenHeading"
        [message]="copy.forbiddenBody(session.displayName())"
        [actionLabel]="copy.forbiddenAction"
        (actionSelected)="goHome()"
      />
    </div>
  `,
})
export class ForbiddenPage {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);
  protected readonly copy = ERRORS_COPY;

  protected goHome(): void {
    void this.router.navigate(['/dashboard']);
  }
}
