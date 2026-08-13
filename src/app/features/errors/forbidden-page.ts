import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import { EmptyState } from '@shared/ui/empty-state/empty-state';

@Component({
  selector: 'app-forbidden-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState],
  template: `
    <div class="card">
      <app-empty-state
        variant="forbidden"
        heading="You do not have access to that section"
        [message]="
          'Your account is signed in as ' +
          session.displayName() +
          '. If you need this access, ask the MSWDO head or a system administrator to adjust your role.'
        "
        actionLabel="Back to dashboard"
        (actionSelected)="goHome()"
      />
    </div>
  `,
})
export class ForbiddenPage {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);

  protected goHome(): void {
    void this.router.navigate(['/dashboard']);
  }
}
